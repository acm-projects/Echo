import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');
const TMP_ROOT = path.join(SERVER_ROOT, 'tmp');
const MODEL_ROOT = path.join(REPO_ROOT, 'workers', 'indextts');
const PYTHON = path.join(MODEL_ROOT, '.venv', 'bin', 'python');
const WORKER = path.join(REPO_ROOT, 'workers', 'reader', 'reader.py');
const MODEL_OUTPUTS = path.join(MODEL_ROOT, 'outputs');

const loadEnvFile = (process as typeof process & { loadEnvFile?: (file?: string) => void }).loadEnvFile;
loadEnvFile?.(path.join(REPO_ROOT, '.env'));

const PORT = Number(process.env.VOICE_SERVER_PORT ?? 8787);
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = 'gemini-3.8-flash-tts';

const requestSchema = z.object({
  voiceDescription: z.string().trim().min(10).max(500),
  text: z.string().trim().min(1).max(5000),
  emotion: z.string().trim().max(120).default('neutral, natural audiobook delivery'),
  displayName: z.string().trim().min(1).max(80).default('Echo sample voice'),
  languageCode: z.string().trim().default('en-US'),
});

type WorkerMessage = { type: string; jobId?: string; outputPath?: string; message?: string; traceback?: string };

type PendingJob = { resolve: (path: string) => void; reject: (error: Error) => void };
let worker: ChildProcessWithoutNullStreams | undefined;
let workerBuffer = '';
const pending = new Map<string, PendingJob>();

function ensureConfiguration() {
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY is not configured in the repository .env file.');
}

function startWorker() {
  if (worker) return worker;
  worker = spawn(PYTHON, [WORKER], { cwd: MODEL_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
  worker.stdout.on('data', (chunk: Buffer) => {
    workerBuffer += chunk.toString();
    const lines = workerBuffer.split('\n');
    workerBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let message: WorkerMessage;
      try {
        message = JSON.parse(line) as WorkerMessage;
      } catch {
        process.stderr.write(`[indextts:stdout] ${line}\n`);
        continue;
      }
      if (message.type === 'result' && message.jobId && message.outputPath) {
        pending.get(message.jobId)?.resolve(message.outputPath);
        pending.delete(message.jobId);
      }
      if (message.type === 'error' && message.jobId) {
        const details = [message.message, message.traceback].filter(Boolean).join('\n');
        pending.get(message.jobId)?.reject(new Error(details || 'IndexTTS worker failed.'));
        pending.delete(message.jobId);
      }
    }
  });
  worker.stderr.on('data', (chunk: Buffer) => process.stderr.write(`[indextts] ${chunk}`));
  worker.on('exit', (code) => {
    for (const job of pending.values()) job.reject(new Error(`IndexTTS worker exited with code ${code}.`));
    pending.clear();
    worker = undefined;
  });
  return worker;
}

async function postJson(url: string, body: unknown) {
  let lastError = 'Google API request failed.';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${url}?key=${encodeURIComponent(GOOGLE_API_KEY!)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json() as { error?: { message?: string }; id?: string; sample_audio?: { data?: string } };
    if (response.ok) return data;
    lastError = data.error?.message ?? `Google API request failed with ${response.status}.`;
    if (response.status < 500 || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new Error(lastError);
}

async function generateVoicePreview(input: z.infer<typeof requestSchema>) {
  return postJson('https://generativelanguage.googleapis.com/v1beta/voices', {
    store: true,
    voice: {
      model: GEMINI_MODEL,
      type: 'prompted',
      display_name: input.displayName,
      language_code: input.languageCode,
      prompted: { input: input.voiceDescription },
    },
  });
}

function runIndexTts(referencePath: string, text: string, emotion: string) {
  const jobId = randomUUID();
  const digest = createHash('sha256').update(`${referencePath}:${text}:${emotion}`).digest('hex').slice(0, 20);
  const outputPath = path.join(MODEL_OUTPUTS, `${digest}.wav`);
  return access(outputPath).then(
    () => outputPath,
    () => new Promise<string>((resolve, reject) => {
      pending.set(jobId, { resolve, reject });
      startWorker().stdin.write(`${JSON.stringify({ jobId, referencePath, outputPath, text, emotion, language: 'EN' })}\n`);
    }),
  );
}

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });
await app.register(cors, { origin: true });
await mkdir(TMP_ROOT, { recursive: true });
await mkdir(MODEL_OUTPUTS, { recursive: true });

app.get('/health', async () => ({
  ok: true,
  googleKeyConfigured: Boolean(GOOGLE_API_KEY),
  model: GEMINI_MODEL,
  indexTtsCheckpointPath: MODEL_ROOT,
}));

app.post('/api/voice/generate', async (request, reply) => {
  try {
    ensureConfiguration();
    const input = requestSchema.parse(request.body);
    app.log.info('Creating Gemini voice');
    const voice = await generateVoicePreview(input);
    const previewData = voice.sample_audio?.data;
    if (!previewData || !voice.id) throw new Error('Gemini created no voice preview audio.');

    const referencePath = path.join(TMP_ROOT, `${voice.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.wav`);
    await writeFile(referencePath, Buffer.from(previewData, 'base64'));
    app.log.info({ voiceId: voice.id, referencePath }, 'Gemini voice reference created');
    app.log.info({ voiceId: voice.id }, 'Starting IndexTTS narration');
    const outputPath = await runIndexTts(referencePath, input.text, input.emotion);
    const audio = await readFile(outputPath);
    app.log.info({ voiceId: voice.id, outputPath }, 'IndexTTS narration created');
    return { voiceId: voice.id, referencePath, outputPath, mimeType: 'audio/wav', audioBase64: audio.toString('base64') };
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join('; ') : error instanceof Error ? error.message : 'Voice generation failed.';
    app.log.error({ error }, 'Voice generation failed');
    return reply.code(400).send({ error: message });
  }
});

app.listen({ port: PORT, host: '127.0.0.1' }).then(() => {
  console.log(`Echo voice server listening at http://127.0.0.1:${PORT}`);
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
