import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, access, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { PDFParse } from 'pdf-parse';
import AdmZip from 'adm-zip';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');
const TMP_ROOT = path.join(SERVER_ROOT, 'tmp');
const MODEL_ROOT = path.join(REPO_ROOT, 'workers', 'indextts');
const PYTHON = path.join(MODEL_ROOT, '.venv', 'bin', 'python');
const WORKER = path.join(REPO_ROOT, 'workers', 'reader', 'reader.py');
const MODEL_OUTPUTS = path.join(MODEL_ROOT, 'outputs');
const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
const SEGMENT_SILENCE_SECONDS = 0.2;

const loadEnvFile = (process as typeof process & { loadEnvFile?: (file?: string) => void }).loadEnvFile;
loadEnvFile?.(path.join(REPO_ROOT, '.env'));

const PORT = Number(process.env.VOICE_SERVER_PORT ?? 8787);
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const CLAUDE_API_KEY = process.env.ECHO_API_KEY ?? process.env.CLAUDE_API_KEY;
const GEMINI_MODEL = 'gemini-3.8-flash-tts';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-5-20250929';

const requestSchema = z.object({
  voiceDescription: z.string().trim().min(10).max(500),
  text: z.string().trim().min(1).max(5000),
  emotion: z.string().trim().max(120).default('neutral, natural audiobook delivery'),
  displayName: z.string().trim().min(1).max(80).default('Echo sample voice'),
  languageCode: z.string().trim().default('en-US'),
});

const rosterSchema = z.object({
  characters: z.array(z.object({
    name: z.string().min(1),
    aliases: z.array(z.string()),
    voiceDescription: z.string().min(10),
  })).min(1),
});

const segmentsSchema = z.object({
  segments: z.array(z.object({
    speaker: z.string().min(1),
    kind: z.enum(['dialogue', 'narration']),
    text: z.string().min(1),
    emotion: z.string().min(1).max(120),
  })).min(1),
});

type WorkerMessage = { type: string; jobId?: string; outputPath?: string; message?: string; traceback?: string };

type PendingJob = { resolve: (path: string) => void; reject: (error: Error) => void };
let worker: ChildProcessWithoutNullStreams | undefined;
let workerBuffer = '';
const pending = new Map<string, PendingJob>();

function ensureConfiguration() {
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY is not configured in the repository .env file.');
}

function ensureClaudeConfiguration() {
  if (!CLAUDE_API_KEY) throw new Error('ECHO_API_KEY or CLAUDE_API_KEY is not configured in the repository .env file.');
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

async function extractBookText(fileName: string, buffer: Buffer) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === '.pdf') {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text.trim();
  }
  if (extension === '.txt' || extension === '.md') return buffer.toString('utf8').trim();
  if (extension === '.epub') {
    const zip = new AdmZip(buffer);
    const html = zip.getEntries()
      .filter((entry) => /\.(x?html?|htm)$/i.test(entry.entryName))
      .map((entry) => entry.getData().toString('utf8'))
      .join('\n');
    return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  }
  throw new Error('Supported book formats are PDF, EPUB, TXT, and MD.');
}

async function claudeToolCall<T>(name: string, description: string, input: string, schema: z.ZodType<T>) {
  ensureClaudeConfiguration();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 8192,
        tools: [{ name, description, input_schema: schemaToJsonSchema(schema) }],
        tool_choice: { type: 'tool', name },
        messages: [{ role: 'user', content: input }],
      }),
    });
    const data = await response.json() as { error?: { message?: string }; content?: Array<{ type: string; input?: unknown }> };
    if (!response.ok) throw new Error(data.error?.message ?? `Claude request failed with ${response.status}.`);
    const toolUse = data.content?.find((item) => item.type === 'tool_use');
    const parsed = schema.safeParse(toolUse?.input);
    if (parsed.success) return parsed.data;
    if (attempt === 1) throw new Error(`Claude returned invalid ${name} JSON: ${parsed.error.message}`);
  }
  throw new Error(`Claude ${name} failed.`);
}

function schemaToJsonSchema(schema: z.ZodType) {
  // The schemas are kept explicit here so Claude receives strict object contracts.
  if (schema === rosterSchema) return { type: 'object', additionalProperties: false, required: ['characters'], properties: { characters: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'aliases', 'voiceDescription'], properties: { name: { type: 'string' }, aliases: { type: 'array', items: { type: 'string' } }, voiceDescription: { type: 'string' } } } } } };
  return { type: 'object', additionalProperties: false, required: ['segments'], properties: { segments: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['speaker', 'kind', 'text', 'emotion'], properties: { speaker: { type: 'string' }, kind: { type: 'string', enum: ['dialogue', 'narration'] }, text: { type: 'string' }, emotion: { type: 'string' } } } } } };
}

async function latestNarratorReference() {
  const files = (await readdir(TMP_ROOT)).filter((file) => file.endsWith('.wav'));
  if (!files.length) throw new Error('No existing Gemini narrator reference WAV was found in server/tmp. Generate one in Voice Lab first.');
  const entries = await Promise.all(files.map(async (file) => ({ file, modified: (await stat(path.join(TMP_ROOT, file))).mtimeMs })));
  entries.sort((a, b) => b.modified - a.modified);
  return path.join(TMP_ROOT, entries[0].file);
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

function runProcess(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}: ${stderr.trim().slice(-1000)}`));
    });
  });
}

async function stitchSegments(jobId: string, segmentPaths: string[]) {
  if (!segmentPaths.length) throw new Error('Cannot stitch an empty segment list.');

  const wavPath = path.join(TMP_ROOT, `${jobId}.wav`);
  const mp3Path = path.join(TMP_ROOT, `${jobId}.mp3`);
  const inputArgs: string[] = [];
  const labels: string[] = [];
  let inputIndex = 0;

  for (const [index, segmentPath] of segmentPaths.entries()) {
    inputArgs.push('-i', segmentPath);
    labels.push(`[${inputIndex}:a]`);
    inputIndex += 1;
    if (index < segmentPaths.length - 1) {
      inputArgs.push('-f', 'lavfi', '-t', String(SEGMENT_SILENCE_SECONDS), '-i', 'anullsrc=r=22050:cl=mono');
      labels.push(`[${inputIndex}:a]`);
      inputIndex += 1;
    }
  }

  const filter = `${labels.join('')}concat=n=${labels.length}:v=0:a=1[loud];[loud]loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  await runProcess(FFMPEG, [
    '-y', ...inputArgs, '-filter_complex', filter, '-map', '[out]',
    '-ar', '22050', '-ac', '1', '-c:a', 'pcm_s16le', wavPath,
  ]);
  await runProcess(FFMPEG, ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-q:a', '4', mp3Path]);
  return { wavPath, mp3Path };
}

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });
await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024, files: 1 } });
await mkdir(TMP_ROOT, { recursive: true });
await mkdir(MODEL_OUTPUTS, { recursive: true });

app.get('/health', async () => ({
  ok: true,
  googleKeyConfigured: Boolean(GOOGLE_API_KEY),
  model: GEMINI_MODEL,
  indexTtsCheckpointPath: MODEL_ROOT,
  claudeKeyConfigured: Boolean(CLAUDE_API_KEY),
}));

app.post('/api/books/process', async (request, reply) => {
  try {
    ensureClaudeConfiguration();
    ensureConfiguration();
    const upload = await request.file();
    if (!upload) return reply.code(400).send({ error: 'Attach a book file in the book field.' });
    const bookText = await extractBookText(upload.filename, await upload.toBuffer());
    if (bookText.length < 40) return reply.code(400).send({ error: 'The uploaded file did not contain enough readable text.' });

    const roster = await claudeToolCall(
      'extract_roster',
      'Extract a stable character roster from the book excerpt. Always include Narrator. Voice descriptions must describe generic vocal traits only, never imitate a real person or celebrity.',
      `Build a character roster for this book text. Include canonical names, aliases, and one or two sentences describing permanent vocal traits (age range, timbre, accent, pacing). Include Narrator.\n\n${bookText.slice(0, 30000)}`,
      rosterSchema,
    );

    const chunks = [];
    for (let offset = 0; offset < bookText.length; offset += 12000) chunks.push(bookText.slice(offset, offset + 12000));
    const allSegments: z.infer<typeof segmentsSchema>['segments'] = [];
    for (const chunk of chunks) {
      const parsed = await claudeToolCall(
        'split_segments',
        'Split the provided book chunk into ordered narration and dialogue segments. Use only roster names, preserve text verbatim, and label the emotion that should guide delivery.',
        `Use this roster consistently:\n${JSON.stringify(roster)}\n\nSplit this chunk into ordered segments. Do not summarize or rewrite the text.\n\n${chunk}`,
        segmentsSchema,
      );
      allSegments.push(...parsed.segments);
    }

    const narratorReference = await latestNarratorReference();
    const references = new Map<string, string>([['Narrator', narratorReference]]);
    for (const character of roster.characters.filter((item) => item.name !== 'Narrator')) {
      const voice = await generateVoicePreview({
        voiceDescription: character.voiceDescription,
        displayName: `Echo - ${character.name}`,
        text: 'This is a neutral reference line for a fictional audiobook character.',
        emotion: 'neutral',
        languageCode: 'en-US',
      });
      if (!voice.sample_audio?.data || !voice.id) throw new Error(`Gemini did not return a reference for ${character.name}.`);
      const referencePath = path.join(TMP_ROOT, `${voice.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.wav`);
      await writeFile(referencePath, Buffer.from(voice.sample_audio.data, 'base64'));
      references.set(character.name, referencePath);
    }

    const jobId = randomUUID();
    const outputSegments = [];
    for (const [index, segment] of allSegments.entries()) {
      const speaker = references.has(segment.speaker) ? segment.speaker : 'Narrator';
      const outputPath = await runIndexTts(references.get(speaker)!, segment.text, segment.emotion);
      outputSegments.push({ index, speaker, kind: segment.kind, text: segment.text, emotion: segment.emotion, outputPath });
    }
    const manifestPath = path.join(TMP_ROOT, `${jobId}.json`);
    const compiled = await stitchSegments(jobId, outputSegments.map((segment) => segment.outputPath));
    await writeFile(manifestPath, JSON.stringify({ jobId, roster, segments: outputSegments, compiled }, null, 2));
    return { jobId, roster, segments: outputSegments, compiled, manifestPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Book processing failed.';
    app.log.error({ error }, 'Book processing failed');
    return reply.code(400).send({ error: message });
  }
});

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
