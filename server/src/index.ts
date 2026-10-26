import Fastify, { type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, access, readdir, stat, rm } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { createReadStream } from 'node:fs';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
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
// 0.0.0.0 lets phones and emulators on the same network reach the dev server; set 127.0.0.1 to keep it local-only.
const HOST = process.env.VOICE_SERVER_HOST ?? '0.0.0.0';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const CLAUDE_API_KEY = process.env.ECHO_API_KEY ?? process.env.CLAUDE_API_KEY;
const GEMINI_MODEL = 'gemini-3.8-flash-tts';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5-5';

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
    gender: z.enum(['female', 'male', 'neutral']),
    voiceDescription: z.string().min(10),
  })).min(1),
});

const voiceRewriteSchema = z.object({
  voiceDescription: z.string().min(10).max(400),
});

// Order matters: this is the vector order IndexTTS2 expects for emo_vector.
const EMOTIONS = ['happy', 'angry', 'sad', 'afraid', 'disgusted', 'melancholic', 'surprised', 'calm'] as const;
const emotionWeight = z.number().min(0).max(1);
const emotionVectorSchema = z.object({
  happy: emotionWeight, angry: emotionWeight, sad: emotionWeight, afraid: emotionWeight,
  disgusted: emotionWeight, melancholic: emotionWeight, surprised: emotionWeight, calm: emotionWeight,
});

const segmentsSchema = z.object({
  segments: z.array(z.object({
    speaker: z.string().min(1),
    kind: z.enum(['dialogue', 'narration']),
    text: z.string().min(1),
    emotion: z.string().min(1).max(120),
    emotionVector: emotionVectorSchema,
    delivery: z.enum(['whisper', 'soft', 'normal', 'loud']),
  })).min(1),
});

// Voice-design APIs (Gemini, ElevenLabs) refuse prompts that describe minors or sensitive content.
const VOICE_SAFETY_RULES = `These descriptions are sent to a voice-design text-to-speech service with strict safety filters. Any description that trips them is rejected, so follow every rule:
- Describe only how the voice sounds: perceived gender, an ADULT age bracket (early twenties, thirties, middle-aged, elderly), pitch, timbre/texture, pace, energy, accent or dialect, and general speaking style.
- Every voice must be an adult. For children or teenagers, describe a youthful adult instead, e.g. "A light, bright, high-pitched young adult female voice in her early twenties with quick, energetic pacing."
- Never use these words: child, children, kid, boy, girl, teen, teenage, teenager, adolescent, toddler, baby, infant, little, minor, juvenile, schoolboy, schoolgirl, or any age under 20.
- Never include character names, plot events, relationships, violence, weapons, injuries, crime, drugs, alcohol, sexual or romantic content, insults, or words like menacing, sinister, evil, seductive, sultry, drunk, or villainous. Convey those qualities through neutral audio terms (e.g. "low, gravelly, slow and deliberate").
- Never describe volume, force, or aggression: avoid loud, booming, shouting, yelling, forceful, aggressive, harsh, intense, or projection. These push the service toward generating shouted samples, which are often flagged. Describe resonance and presence instead (e.g. "deep, resonant, with a commanding presence").
- Never reference real people, celebrities, actors, or characters from existing films, games, or franchises.
- Use neutral, professional casting-sheet language in one or two sentences, under 300 characters.`;

const UNSAFE_VOICE_TERMS = /\b(child|children|kids?|boys?|girls?|teens?|teenage|teenagers?|adolescents?|toddlers?|bab(y|ies)|infants?|little|minors?|juvenile|preteen|tween|school(boy|girl)s?|youngsters?)\b|\b(1[0-9]|[1-9])[- ]?(years?|yrs?)[- ]?old\b/i;

const EMOTION_GUIDE = `Each segment needs an "emotion" label and an "emotionVector". The vector drives the IndexTTS2 emotion engine directly. It blends exactly eight emotions, each weighted 0 to 1:
- happy: joy, amusement, warmth, excitement, relief, pride, playful teasing
- angry: anger, frustration, irritation, indignation, defiance, threat
- sad: grief, sorrow, hurt, heartbreak, crying, regret
- afraid: fear, anxiety, nervousness, panic, dread, worry
- disgusted: disgust, contempt, revulsion, scorn, distaste
- melancholic: wistfulness, weariness, resignation, nostalgia, quiet gloom, low energy
- surprised: shock, astonishment, disbelief, sudden realization
- calm: neutral, even, matter-of-fact, steady

How to choose weights:
- Judge dialogue from context, not only the words: what just happened, the speech tag attached to it ("she snapped", "he whispered"), punctuation, and what the character wants in that moment.
- Use one main emotion and at most one secondary emotion, with the secondary no more than half the main. The engine caps the whole vector at 0.8 total and scales everything down to fit, so extra emotions dilute the main one and blur the delivery. Do not add sad or afraid as seasoning. Nervous excitement = happy 0.4 + afraid 0.2. Bitter sarcasm = angry 0.4 + disgusted 0.2. Tearful relief = happy 0.5 + sad 0.2. Exhausted defeat = melancholic 0.5 + sad 0.2.
- Intensity (total of all weights, never above 0.8): subtle 0.2-0.3, clear 0.35-0.55, strong 0.6-0.8.
- How each emotion sounds in this engine: afraid and angry raise pitch sharply at high weights, which can push a light or tenor voice into a much higher register, so use afraid only for real fear (not urgency) and keep intensity lower for light or high voices. A shout or demand is angry; an excited cry is happy or surprised. Surprised makes the end of a line rise like a question, so use it only for genuine shock or realization, never for quiet or whispered lines. Sad and melancholic lower energy and make lines sink, so keep them out of shouts and exclamations.
- A pure calm vector sounds flat and robotic. Use calm only for genuinely neutral delivery, never alongside a strong emotion, and prefer adding a little color (a friendly greeting = calm 0.3 + happy 0.2).
- Narration, including speech tags, is read by a steady storyteller. Give it only a slight tint of the scene's mood: at most 0.3 total across the non-calm emotions, with calm at least 0.3. Tense chase = afraid 0.2 + calm 0.4; somber funeral = melancholic 0.2 + calm 0.4; cheerful morning = happy 0.2 + calm 0.4.
- Speech tags describe a character's emotion; the narrator must not perform it. "he roared." and "she sobbed." are narration read evenly (e.g. calm 0.5 + angry 0.1), never with the character's anger or grief.
- Dialogue should match the speaker's feeling in that moment and carries the story's emotional intensity.
- Set all unused emotions to 0.
- The emotion label is two to six plain English words naming the delivery, e.g. "nervous, hopeful whisper".
- delivery is how loudly the line is spoken, taken from speech tags and context: whisper (whispered, breathed, under her breath), soft (quietly, murmured, muttered), loud (shouted, roared, yelled, cried out), otherwise normal. The emotion vector cannot express volume, so set this even when the emotion already implies it. Narration is always normal.
- Start a new segment only when the speaker changes (a speech tag between quotes is its own Narrator segment). Keep consecutive narration sentences together in one segment, up to about 300 characters, rather than splitting them by mood.`;

// Caps narrator emotion regardless of what Claude returns, so speech tags and
// narration stay an even storytelling voice instead of mirroring the characters.
const NARRATOR_MAX_EMOTION = 0.3;
const NARRATOR_MIN_CALM = 0.3;

function capNarratorEmotion(vector: z.infer<typeof emotionVectorSchema>) {
  const intensity = EMOTIONS.reduce((sum, emotion) => sum + (emotion === 'calm' ? 0 : vector[emotion]), 0);
  const scale = intensity > NARRATOR_MAX_EMOTION ? NARRATOR_MAX_EMOTION / intensity : 1;
  const capped = Object.fromEntries(EMOTIONS.map((emotion) => [emotion, emotion === 'calm' ? Math.max(vector.calm, NARRATOR_MIN_CALM) : Math.round(vector[emotion] * scale * 100) / 100])) as z.infer<typeof emotionVectorSchema>;
  return { capped, changed: scale < 1 || vector.calm < NARRATOR_MIN_CALM };
}

// IndexTTS scales any vector above 0.8 total down proportionally, so stacked emotions dilute the main one
// (e.g. angry 0.5 + sad 0.3 + afraid 0.5 left fear leading a shouted line). Keep the main emotion and at
// most one secondary at no more than half its weight, then fit the total under the cap ourselves.
const DIALOGUE_MAX_TOTAL = 0.8;

function shapeDialogueEmotion(vector: z.infer<typeof emotionVectorSchema>) {
  const [main, secondary, ...rest] = EMOTIONS.filter((emotion) => emotion !== 'calm' && vector[emotion] > 0).sort((a, b) => vector[b] - vector[a]);
  const shaped = Object.fromEntries(EMOTIONS.map((emotion) => [emotion, 0])) as z.infer<typeof emotionVectorSchema>;
  shaped.calm = vector.calm;
  if (main) shaped[main] = vector[main];
  if (secondary) shaped[secondary] = Math.min(vector[secondary], vector[main] / 2);
  const total = EMOTIONS.reduce((sum, emotion) => sum + shaped[emotion], 0);
  const scale = total > DIALOGUE_MAX_TOTAL ? DIALOGUE_MAX_TOTAL / total : 1;
  for (const emotion of EMOTIONS) shaped[emotion] = Math.round(shaped[emotion] * scale * 100) / 100;
  return { capped: shaped, changed: EMOTIONS.some((emotion) => shaped[emotion] !== vector[emotion]) };
}

// Volume offsets relative to the -16 LUFS target; IndexTTS can't whisper or shout on its own, and per-segment
// leveling would otherwise play every line at the same loudness.
const DELIVERY_GAIN_DB = { whisper: -10, soft: -5, normal: 0, loud: 2 } as const;

// Text sent to IndexTTS for a dialogue line, chosen by listening tests on split quotes: outer quote marks
// made fragments sound worse, and a one-word fragment ending in a comma ("Please,") was read with a full
// sentence-final drop. A longer fragment ending in a comma ("The mantle cracked,") sometimes made IndexTTS
// invent a continuation ("...cracked, the top of the"), which never happened with a period.
function dialogueSpeechText(text: string) {
  const unquoted = text.trim().replace(/^["“‘']/, '').replace(/["”’']$/, '').trim();
  if (!unquoted.endsWith(',')) return unquoted;
  return /^\S+,$/.test(unquoted) ? unquoted.slice(0, -1) : `${unquoted.slice(0, -1)}.`;
}

type WorkerMessage = { type: string; jobId?: string; outputPath?: string; message?: string; traceback?: string };

type PendingJob = { resolve: (path: string) => void; reject: (error: Error) => void };
let worker: ChildProcessWithoutNullStreams | undefined;
let workerBuffer = '';
const pending = new Map<string, PendingJob>();

// Track files created for each job for cleanup
const jobFiles = new Map<string, Set<string>>();

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

type GoogleVoiceResponse = { id?: string; sample_audio?: { data?: string } };

async function postJson<T = GoogleVoiceResponse>(url: string, body: unknown) {
  let lastError = 'Google API request failed.';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${url}?key=${encodeURIComponent(GOOGLE_API_KEY!)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json() as T & { error?: { message?: string } };
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

// Narrator voices: designed by Gemini, previewed with the cheaper lite TTS model, stored locally per user.
// Prompted voice design is only available on Gemini's default creation model (currently 3.8 Flash TTS),
// so `voice.model` is omitted on creation; designed voices can then speak through any TTS model.
const NARRATOR_PREVIEW_MODEL = process.env.NARRATOR_GEMINI_MODEL ?? 'gemini-3.8-flash-lite-tts';
const NARRATOR_DAILY_LIMIT = 5;
const NARRATOR_ROOT = path.join(SERVER_ROOT, 'data', 'narrators');
const NARRATOR_STORE = path.join(NARRATOR_ROOT, 'narrators.json');
const DEFAULT_NARRATOR_SAMPLE = 'The room beneath the stars was silent, except for the soft turning of a page. Somewhere far below, a door opened, and the story began.';

const narratorRequestSchema = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().min(20, 'Describe the voice in at least 20 characters.').max(400),
  sampleText: z.string().trim().min(1).max(500).optional(),
});

type NarratorVoice = {
  id: string;
  userId: string;
  name: string;
  description: string;
  sampleText: string;
  createdAt: string;
  referencePath: string;
  previewPath: string;
};
type NarratorStore = { voices: NarratorVoice[]; selected: Record<string, string> };

// Serializes read-modify-write cycles on the JSON store.
let narratorStoreLock: Promise<unknown> = Promise.resolve();
const narratorCreationsInFlight = new Map<string, number>();

async function readNarratorStore(): Promise<NarratorStore> {
  try {
    return JSON.parse(await readFile(NARRATOR_STORE, 'utf8')) as NarratorStore;
  } catch {
    return { voices: [], selected: {} };
  }
}

function updateNarratorStore<T>(change: (store: NarratorStore) => T | Promise<T>) {
  const run = narratorStoreLock.then(async () => {
    const store = await readNarratorStore();
    const result = await change(store);
    await writeFile(NARRATOR_STORE, JSON.stringify(store, null, 2));
    return result;
  });
  narratorStoreLock = run.catch(() => {});
  return run;
}

function narratorUserId(request: { headers: Record<string, string | string[] | undefined> }) {
  const header = request.headers['x-e`cho-user'];
  const value = (Array.isArray(header) ? header[0] : header)?.trim();
  return value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : 'local';
}

function localDay(date: Date) {
  return date.toLocaleDateString('en-CA');
}

function narratorQuota(store: NarratorStore, userId: string) {
  const today = localDay(new Date());
  const usedToday = store.voices.filter((voice) => voice.userId === userId && localDay(new Date(voice.createdAt)) === today).length;
  const resetsAt = new Date();
  resetsAt.setHours(24, 0, 0, 0);
  return { dailyLimit: NARRATOR_DAILY_LIMIT, usedToday, remainingToday: Math.max(0, NARRATOR_DAILY_LIMIT - usedToday), resetsAt: resetsAt.toISOString() };
}

function publicNarrator(voice: NarratorVoice) {
  return { id: voice.id, name: voice.name, description: voice.description, sampleText: voice.sampleText, createdAt: voice.createdAt, previewUrl: `/api/narrators/${encodeURIComponent(voice.id)}/audio` };
}

async function narratorState(userId: string) {
  const store = await readNarratorStore();
  const voices = store.voices.filter((voice) => voice.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { voices: voices.map(publicNarrator), selectedId: store.selected[userId] ?? null, previewModel: NARRATOR_PREVIEW_MODEL, ...narratorQuota(store, userId) };
}

async function speakWithVoice(model: string, voiceId: string, text: string) {
  const data = await postJson<{ candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> }>(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: voiceId } } },
    },
  );
  const audio = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!audio?.data) throw new Error('Gemini returned no narration audio.');
  return Buffer.from(audio.data, 'base64');
}

async function createNarratorVoice(userId: string, input: z.infer<typeof narratorRequestSchema>) {
  const voice = await postJson('https://generativelanguage.googleapis.com/v1beta/voices', {
    store: true,
    voice: {
      type: 'prompted',
      display_name: `Echo narrator - ${input.name}`,
      language_code: 'en-US',
      prompted: { input: input.description },
    },
  });
  if (!voice.id || !voice.sample_audio?.data) throw new Error('Gemini did not return a narrator voice.');
  const sampleText = input.sampleText ?? DEFAULT_NARRATOR_SAMPLE;
  const fileBase = voice.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const referencePath = path.join(NARRATOR_ROOT, `${fileBase}-reference.wav`);
  const previewPath = path.join(NARRATOR_ROOT, `${fileBase}-preview.wav`);
  // Gemini's design sample is a long, neutral read, which makes the better IndexTTS cloning reference.
  await writeFile(referencePath, Buffer.from(voice.sample_audio.data, 'base64'));
  await writeFile(previewPath, await speakWithVoice(NARRATOR_PREVIEW_MODEL, voice.id, sampleText));
  const narrator: NarratorVoice = { id: voice.id, userId, name: input.name, description: input.description, sampleText, createdAt: new Date().toISOString(), referencePath, previewPath };
  await updateNarratorStore((store) => {
    store.voices.push(narrator);
    store.selected[userId] ??= narrator.id;
  });
  return narrator;
}

async function selectedNarratorReference(userId: string) {
  const store = await readNarratorStore();
  const voice = store.voices.find((item) => item.userId === userId && item.id === store.selected[userId]);
  if (!voice) return undefined;
  return access(voice.referencePath).then(() => voice.referencePath, () => undefined);
}

async function extractBookText(fileName: string, buffer: Buffer) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === '.pdf') {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    // pdf-parse inserts "-- 1 of 2 --" page markers, which would otherwise be narrated.
    return result.text.replace(/^-- \d+ of \d+ --$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
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

const anthropic = CLAUDE_API_KEY ? new Anthropic({ apiKey: CLAUDE_API_KEY }) : undefined;

// Structured outputs return JSON matching the zod schema; Sonnet 5.5 rejects the forced tool_choice
// this used to rely on. Effort is set per task because Sonnet 5.5 recalibrated its levels.
async function claudeStructuredOutput<T extends z.ZodType>(name: string, instructions: string, input: string, schema: T, effort: 'low' | 'medium' | 'high') {
  ensureClaudeConfiguration();
  let lastError = `Claude ${name} failed.`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await anthropic!.beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      system: instructions,
      messages: [{ role: 'user', content: input }],
      output_config: { effort, format: zodOutputFormat(schema) },
      // Server-side fallback reruns cyber/frontier_llm declines on another model; it is Sonnet 5.5-specific.
      ...(CLAUDE_MODEL === 'claude-sonnet-5-5' ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    }).catch((error: unknown) => {
      // A response that doesn't match the zod schema surfaces as a parse error; retry once.
      if (error instanceof Anthropic.APIError) throw error;
      lastError = `Claude returned invalid ${name} JSON: ${error instanceof Error ? error.message : String(error)}`;
      return undefined;
    });
    if (!response) continue;
    if (response.stop_reason === 'refusal') {
      throw new Error(`Claude declined ${name} (${response.stop_details?.category ?? 'no category'}). ${response.stop_details?.explanation ?? ''}`.trim());
    }
    if (response.stop_reason === 'max_tokens') throw new Error(`Claude ran out of output tokens during ${name}; try a shorter chunk.`);
    if (response.parsed_output) return response.parsed_output as z.infer<T>;
  }
  throw new Error(lastError);
}

function fallbackVoiceDescription(gender: string) {
  const voice = gender === 'female' ? 'female' : gender === 'male' ? 'male' : 'gender-neutral';
  return `A clear, natural adult ${voice} voice with a medium pitch, smooth timbre, and an even, conversational pace.`;
}

async function rewriteVoiceDescription(description: string, gender: string, reason: string) {
  const result = await claudeStructuredOutput(
    'rewrite_voice_description',
    'Rewrite a voice-design prompt so it passes a text-to-speech safety filter while keeping the same vocal character.',
    `This ${gender} voice description was rejected or flagged (${reason}). Rewrite it so it keeps the same sound but follows every rule.\n\n${VOICE_SAFETY_RULES}\n\nOriginal description:\n${description}`,
    voiceRewriteSchema,
    'low',
  );
  return result.voiceDescription;
}

// Gemini's safety check runs on a prompt it generates from the description, so the same text can pass
// on one call and be flagged on the next (2 of 4 identical attempts failed in testing). Retry the original
// once, then try a Claude rewrite, then a generic adult voice.
async function createCharacterVoice(character: z.infer<typeof rosterSchema>['characters'][number], index: number) {
  let description = character.voiceDescription;
  if (UNSAFE_VOICE_TERMS.test(description)) {
    description = await rewriteVoiceDescription(description, character.gender, 'it mentions a minor or a restricted word')
      .catch(() => fallbackVoiceDescription(character.gender));
  }
  let lastError = '';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const voice = await generateVoicePreview({
        voiceDescription: description,
        displayName: `Echo character ${index + 1}`,
        text: 'This is a neutral reference line for a fictional audiobook character.',
        emotion: 'neutral',
        languageCode: 'en-US',
      });
      if (!voice.sample_audio?.data || !voice.id) throw new Error('Gemini returned no reference audio.');
      app.log.info({ character: character.name, attempt, description, voiceId: voice.id }, 'Gemini voice created');
      return { voice, description };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      app.log.warn({ character: character.name, attempt, description, error: lastError }, 'Gemini voice creation rejected');
      if (attempt === 1) {
        description = await rewriteVoiceDescription(description, character.gender, lastError).catch(() => fallbackVoiceDescription(character.gender));
      } else if (attempt === 2) {
        description = fallbackVoiceDescription(character.gender);
      }
    }
  }
  throw new Error(lastError);
}

// Compiled books, their intermediates, and character references are prefixed so they are never mistaken for a Voice Lab narrator.
const GENERATED_TMP_FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-|char-)/i;

async function latestNarratorReference() {
  const files = (await readdir(TMP_ROOT)).filter((file) => file.endsWith('.wav') && !GENERATED_TMP_FILE.test(file));
  if (!files.length) throw new Error('No existing Gemini narrator reference WAV was found in server/tmp. Generate one in Voice Lab first.');
  const entries = await Promise.all(files.map(async (file) => ({ file, modified: (await stat(path.join(TMP_ROOT, file))).mtimeMs })));
  entries.sort((a, b) => b.modified - a.modified);
  return path.join(TMP_ROOT, entries[0].file);
}

function runIndexTts(referencePath: string, text: string, emotion: string, emotionVector?: number[]) {
  const jobId = randomUUID();
  const digest = createHash('sha256').update(`${referencePath}:${text}:${emotion}:${emotionVector?.join(',') ?? ''}`).digest('hex').slice(0, 20);
  const outputPath = path.join(MODEL_OUTPUTS, `${digest}.wav`);
  return access(outputPath).then(
    () => outputPath,
    () => new Promise<string>((resolve, reject) => {
      pending.set(jobId, { resolve, reject });
      startWorker().stdin.write(`${JSON.stringify({ jobId, referencePath, outputPath, text, emotion, emotionVector, language: 'EN' })}\n`);
    }),
  );
}

function runProcess(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`${command} exited with code ${code}: ${stderr.trim().slice(-1000)}`));
    });
  });
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }));
  return results;
}

const TARGET_LUFS = -16;
const TARGET_TRUE_PEAK = -1.5;
const TARGET_LRA = 11;
const SAMPLE_RATE = 22050;
const PCM_ARGS = ['-ar', String(SAMPLE_RATE), '-ac', '1', '-c:a', 'pcm_s16le'];
const LOUDNORM_TARGETS = `I=${TARGET_LUFS}:TP=${TARGET_TRUE_PEAK}:LRA=${TARGET_LRA}`;

type LoudnessMeasurement = { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string };

// First pass of ffmpeg's two-pass loudnorm: measures the file without writing audio.
async function measureLoudness(filePath: string) {
  const stderr = await runProcess(FFMPEG, ['-hide_banner', '-nostats', '-i', filePath, '-af', `loudnorm=${LOUDNORM_TARGETS}:print_format=json`, '-f', 'null', '-']);
  const json = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1);
  return JSON.parse(json) as LoudnessMeasurement;
}

// Each segment is gain-matched to the target (plus its delivery offset) so voices sit at the same level,
// then the whole book gets one linear gain so the final file lands on -16 LUFS.
// gainOffsetDb shifts a segment's target away from -16 LUFS (e.g. -10 dB for a whisper).
async function stitchSegments(jobId: string, segments: Array<{ path: string; gainOffsetDb: number }>) {
  if (!segments.length) throw new Error('Cannot stitch an empty segment list.');

  const workDir = path.join(TMP_ROOT, `${jobId}-segments`);
  const premasterPath = path.join(TMP_ROOT, `${jobId}-premaster.wav`);
  const wavPath = path.join(TMP_ROOT, `${jobId}.wav`);
  const mp3Path = path.join(TMP_ROOT, `${jobId}.mp3`);
  await mkdir(workDir, { recursive: true });
  try {
    const silencePath = path.join(workDir, 'silence.wav');
    await runProcess(FFMPEG, ['-y', '-f', 'lavfi', '-t', String(SEGMENT_SILENCE_SECONDS), '-i', `anullsrc=r=${SAMPLE_RATE}:cl=mono`, ...PCM_ARGS, silencePath]);

    const leveledPaths = await mapWithConcurrency(segments, 4, async ({ path: segmentPath, gainOffsetDb }, index) => {
      const measured = Number((await measureLoudness(segmentPath)).input_i);
      // Clips too short or quiet to measure (under ~400ms) keep their original level, plus the delivery offset.
      const gain = Number.isFinite(measured) && measured > -70 ? Math.max(-20, Math.min(20, TARGET_LUFS + gainOffsetDb - measured)) : gainOffsetDb;
      const leveledPath = path.join(workDir, `${String(index).padStart(5, '0')}.wav`);
      await runProcess(FFMPEG, [
        '-y', '-i', segmentPath,
        '-af', `aresample=${SAMPLE_RATE},volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:level=0`,
        ...PCM_ARGS, leveledPath,
      ]);
      return leveledPath;
    });

    const listPath = path.join(workDir, 'list.txt');
    const quote = (file: string) => `file '${file.replace(/'/g, "'\\''")}'`;
    const entries = leveledPaths.flatMap((file, index) => (index < leveledPaths.length - 1 ? [file, silencePath] : [file]));
    await writeFile(listPath, `${entries.map(quote).join('\n')}\n`);
    await runProcess(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, ...PCM_ARGS, premasterPath]);

    // A plain gain, not loudnorm: loudnorm silently switches to dynamic compression whenever the loudness
    // range exceeds its LRA target, which whispers next to shouts always do, flattening the delivery offsets.
    const bookLoudness = Number((await measureLoudness(premasterPath)).input_i);
    const bookGain = Number.isFinite(bookLoudness) ? Math.max(-20, Math.min(20, TARGET_LUFS - bookLoudness)) : 0;
    await runProcess(FFMPEG, [
      '-y', '-i', premasterPath,
      '-af', `volume=${bookGain.toFixed(2)}dB,alimiter=limit=0.84:level=0`,
      ...PCM_ARGS, wavPath,
    ]);
    await runProcess(FFMPEG, ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-q:a', '4', mp3Path]);
    return { wavPath, mp3Path };
  } finally {
    await rm(workDir, { recursive: true, force: true });
    await rm(premasterPath, { force: true });
  }
}

const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });
await app.register(cors, { origin: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'] });
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024, files: 1 } });
await mkdir(TMP_ROOT, { recursive: true });
await mkdir(MODEL_OUTPUTS, { recursive: true });
await mkdir(NARRATOR_ROOT, { recursive: true });

app.get('/health', async () => ({
  ok: true,
  googleKeyConfigured: Boolean(GOOGLE_API_KEY),
  model: GEMINI_MODEL,
  indexTtsCheckpointPath: MODEL_ROOT,
  claudeKeyConfigured: Boolean(CLAUDE_API_KEY),
}));

type BookJob = {
  status: 'processing' | 'done' | 'error';
  stage: string;
  userId: string;
  updatedAt: string;
  result?: unknown;
  error?: string;
};
// Book processing takes minutes, longer than mobile HTTP idle timeouts (iOS NSURLRequest defaults to 60s)
// and longer than an app may stay foregrounded, so clients start a job and poll its status instead.
const bookJobs = new Map<string, BookJob>();

async function processBook(jobId: string, bookText: string, userId: string) {
  const setStage = (stage: string) => {
    bookJobs.set(jobId, { ...bookJobs.get(jobId)!, stage, updatedAt: new Date().toISOString() });
  };
  jobFiles.set(jobId, new Set());
  try {
    setStage('Reading the book with Claude');
    app.log.info('Calling Claude to extract roster');
    const roster = await claudeStructuredOutput(
      'extract_roster',
      'Extract a stable character roster from the book excerpt. Always include Narrator. Voice descriptions must be safe, generic audio descriptions of adult voices.',
      `Build a character roster for this book text. For each speaking character include the canonical name, aliases, gender (female, male, or neutral, inferred from names, pronouns, and context), and a voiceDescription of their permanent vocal traits. State the gender explicitly in every voiceDescription. Include Narrator.\n\n${VOICE_SAFETY_RULES}\n\nBook text:\n${bookText.slice(0, 30000)}`,
      rosterSchema,
      'low',
    );
    app.log.info({ characterCount: roster.characters.length }, 'Roster extracted');

    const chunks = [];
    // Smaller chunks leave output-token room for an emotion vector on every segment.
    for (let offset = 0; offset < bookText.length; offset += 8000) chunks.push(bookText.slice(offset, offset + 8000));
    app.log.info({ chunkCount: chunks.length }, 'Text split into chunks');
    const allSegments: z.infer<typeof segmentsSchema>['segments'] = [];
    for (const [chunkIndex, chunk] of chunks.entries()) {
      setStage(`Splitting scenes (${chunkIndex + 1}/${chunks.length})`);
      const parsed = await claudeStructuredOutput(
        'split_segments',
        'Split the provided book chunk into ordered narration and dialogue segments. Use only roster names, preserve text verbatim, and score the emotion that should guide delivery.',
        `Use this roster consistently:\n${JSON.stringify(roster.characters.map(({ name, aliases }) => ({ name, aliases })))}\n\nSplit this chunk into ordered segments. Do not summarize or rewrite the text. Narration and speech tags ("she said") use the Narrator speaker.\n\n${EMOTION_GUIDE}\n\nChunk:\n${chunk}`,
        segmentsSchema,
        'medium',
      );
      allSegments.push(...parsed.segments);
    }
    app.log.info({ segmentCount: allSegments.length }, 'Segments extracted');

    setStage('Designing character voices');
    app.log.info('Getting narrator reference');
    const selectedReference = await selectedNarratorReference(userId);
    const narratorReference = selectedReference ?? await latestNarratorReference();
    app.log.info({ narratorReference, source: selectedReference ? 'selected narrator voice' : 'newest Voice Lab WAV (no narrator selected)' }, 'Narrator reference chosen');
    const references = new Map<string, string>([['Narrator', narratorReference]]);
    for (const [index, character] of roster.characters.filter((item) => item.name !== 'Narrator').entries()) {
      app.log.info({ character: character.name }, 'Generating voice preview');
      try {
        const { voice, description } = await createCharacterVoice(character, index);
        character.voiceDescription = description;
        const referencePath = path.join(TMP_ROOT, `char-${voice.id!.replace(/[^a-zA-Z0-9_-]/g, '_')}.wav`);
        await writeFile(referencePath, Buffer.from(voice.sample_audio!.data!, 'base64'));
        jobFiles.get(jobId)!.add(referencePath);
        references.set(character.name, referencePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        app.log.warn({ character: character.name, error: message }, 'Voice generation blocked after all fallbacks, using narrator voice');
      }
    }
    app.log.info({ referenceCount: references.size }, 'Voice references generated');
    app.log.info({ jobId, segmentCount: allSegments.length }, 'Starting IndexTTS generation');
    const outputSegments = [];
    let adjustedVectors = 0;
    for (const [index, segment] of allSegments.entries()) {
      setStage(`Narrating (${index + 1}/${allSegments.length})`);
      const speaker = references.has(segment.speaker) ? segment.speaker : 'Narrator';
      // Dialogue from characters without their own voice falls back to the narrator voice but keeps its emotion.
      const isNarration = segment.speaker === 'Narrator' || segment.kind === 'narration';
      const { capped, changed } = isNarration ? capNarratorEmotion(segment.emotionVector) : shapeDialogueEmotion(segment.emotionVector);
      const delivery = isNarration ? 'normal' : segment.delivery;
      if (changed) adjustedVectors += 1;
      const emotionVector = EMOTIONS.map((emotion) => capped[emotion]);
      const speechText = segment.kind === 'dialogue' ? dialogueSpeechText(segment.text) : segment.text;
      const outputPath = await runIndexTts(references.get(speaker)!, speechText, segment.emotion, emotionVector);
      jobFiles.get(jobId)!.add(outputPath);
      outputSegments.push({
        index, speaker, kind: segment.kind, text: segment.text, emotion: segment.emotion, emotionVector: capped, delivery,
        ...(speechText !== segment.text ? { speechText } : {}),
        ...(changed ? { requestedEmotionVector: segment.emotionVector } : {}),
        outputPath,
      });
    }
    app.log.info({ adjustedVectors }, 'Segments with emotion vector capped or reshaped');
    app.log.info({ generatedCount: outputSegments.length }, 'IndexTTS generation complete');

    const manifestPath = path.join(TMP_ROOT, `${jobId}.json`);
    const wavPath = path.join(TMP_ROOT, `${jobId}.wav`);
    const mp3Path = path.join(TMP_ROOT, `${jobId}.mp3`);
    setStage('Mixing the final audio');
    app.log.info('Stitching segments');
    const compiled = await stitchSegments(jobId, outputSegments.map((segment) => ({ path: segment.outputPath, gainOffsetDb: DELIVERY_GAIN_DB[segment.delivery] })));
    await writeFile(manifestPath, JSON.stringify({ jobId, roster, segments: outputSegments, compiled }, null, 2));
    jobFiles.get(jobId)!.add(manifestPath);
    jobFiles.get(jobId)!.add(wavPath);
    jobFiles.get(jobId)!.add(mp3Path);
    app.log.info({ jobId }, 'Book processing complete');
    const result = { jobId, roster, segments: outputSegments, compiled, manifestPath };
    bookJobs.set(jobId, { status: 'done', stage: 'Complete', userId, updatedAt: new Date().toISOString(), result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Book processing failed.';
    app.log.error({ error, message, jobId }, 'Book processing failed');
    bookJobs.set(jobId, { status: 'error', stage: 'Failed', userId, updatedAt: new Date().toISOString(), error: message });
    // Clean up files for failed job
    for (const file of jobFiles.get(jobId) ?? []) await rm(file, { force: true }).catch(() => {});
    jobFiles.delete(jobId);
  }
}

app.post('/api/books/process', async (request, reply) => {
  try {
    ensureClaudeConfiguration();
    ensureConfiguration();
    app.log.info('Starting book processing');
    const upload = await request.file();
    if (!upload) return reply.code(400).send({ error: 'Attach a book file in the book field.' });
    app.log.info({ filename: upload.filename }, 'File received');
    const bookText = await extractBookText(upload.filename, await upload.toBuffer());
    const wordCount = bookText.split(/\s+/).filter(word => word.length > 0).length;
    app.log.info({ textLength: bookText.length, wordCount }, 'Text extracted from file');
    if (wordCount < 10) return reply.code(400).send({ error: 'The uploaded file did not contain enough readable text (minimum 10 words).' });

    const jobId = randomUUID();
    const userId = narratorUserId(request);
    bookJobs.set(jobId, { status: 'processing', stage: 'Queued', userId, updatedAt: new Date().toISOString() });
    void processBook(jobId, bookText, userId);
    return reply.code(202).send({ jobId, status: 'processing', stage: 'Queued' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Book processing failed.';
    app.log.error({ error, message }, 'Book processing failed');
    return reply.code(400).send({ error: message });
  }
});

app.get('/api/books/jobs/:jobId', async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  const job = bookJobs.get(jobId);
  if (!job || job.userId !== narratorUserId(request)) return reply.code(404).send({ error: 'Book job not found.' });
  return { jobId, status: job.status, stage: job.stage, updatedAt: job.updatedAt, result: job.result, error: job.error };
});

app.get('/api/narrators', async (request) => narratorState(narratorUserId(request)));

app.post('/api/narrators', async (request, reply) => {
  const userId = narratorUserId(request);
  try {
    ensureConfiguration();
    const input = narratorRequestSchema.parse(request.body);
    if (UNSAFE_VOICE_TERMS.test(input.description)) {
      return reply.code(400).send({ error: 'Narrator voices must be adults. Describe the sound instead (e.g. "light, bright, high-pitched young adult voice") without words like child, kid, boy, girl, or teen.' });
    }
    const inFlight = narratorCreationsInFlight.get(userId) ?? 0;
    const { remainingToday } = narratorQuota(await readNarratorStore(), userId);
    if (remainingToday - inFlight <= 0) {
      return reply.code(429).send({ error: `You can create ${NARRATOR_DAILY_LIMIT} narrator voices per day. Try again tomorrow.`, ...await narratorState(userId) });
    }
    narratorCreationsInFlight.set(userId, inFlight + 1);
    try {
      app.log.info({ userId }, 'Creating narrator voice');
      const narrator = await createNarratorVoice(userId, input);
      app.log.info({ userId, voiceId: narrator.id }, 'Narrator voice created');
      return { voice: publicNarrator(narrator), ...await narratorState(userId) };
    } finally {
      narratorCreationsInFlight.set(userId, (narratorCreationsInFlight.get(userId) ?? 1) - 1);
    }
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join('; ') : error instanceof Error ? error.message : 'Narrator creation failed.';
    app.log.error({ error, userId }, 'Narrator creation failed');
    return reply.code(400).send({ error: message });
  }
});

app.put('/api/narrators/selected', async (request, reply) => {
  const userId = narratorUserId(request);
  const { voiceId } = z.object({ voiceId: z.string().min(1) }).parse(request.body);
  const found = await updateNarratorStore((store) => {
    if (!store.voices.some((voice) => voice.userId === userId && voice.id === voiceId)) return false;
    store.selected[userId] = voiceId;
    return true;
  });
  if (!found) return reply.code(404).send({ error: 'Narrator voice not found.' });
  return narratorState(userId);
});

// iOS AVPlayer streams media with byte-range requests and can refuse files served without range support.
async function sendAudioFile(request: { headers: Record<string, string | string[] | undefined> }, reply: FastifyReply, filePath: string) {
  const { size } = await stat(filePath);
  reply.header('accept-ranges', 'bytes').type(filePath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav');
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(request.headers.range ?? ''));
  if (!match || (!match[1] && !match[2])) return reply.header('content-length', size).send(createReadStream(filePath));
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (start >= size || start > end) return reply.code(416).header('content-range', `bytes */${size}`).send();
  return reply.code(206)
    .header('content-range', `bytes ${start}-${end}/${size}`)
    .header('content-length', end - start + 1)
    .send(createReadStream(filePath, { start, end }));
}

// Audio players can't send custom headers on every platform, so previews are looked up by voice id only.
app.get('/api/narrators/:voiceId/audio', async (request, reply) => {
  const { voiceId } = request.params as { voiceId: string };
  const voice = (await readNarratorStore()).voices.find((item) => item.id === voiceId);
  if (!voice) return reply.code(404).send({ error: 'Narrator voice not found.' });
  return sendAudioFile(request, reply, voice.previewPath);
});

app.get('/api/voice/audio/:file', async (request, reply) => {
  const { file } = request.params as { file: string };
  if (!/^[a-f0-9]{20}\.wav$/.test(file)) return reply.code(404).send({ error: 'Audio not found.' });
  const filePath = path.join(MODEL_OUTPUTS, file);
  return access(filePath).then(() => sendAudioFile(request, reply, filePath), () => reply.code(404).send({ error: 'Audio not found.' }));
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
    app.log.info({ voiceId: voice.id, outputPath }, 'IndexTTS narration created');
    return { voiceId: voice.id, referencePath, outputPath, mimeType: 'audio/wav', audioUrl: `/api/voice/audio/${path.basename(outputPath)}` };
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join('; ') : error instanceof Error ? error.message : 'Voice generation failed.';
    app.log.error({ error }, 'Voice generation failed');
    return reply.code(400).send({ error: message });
  }
});

// Clean up files for a specific job
app.delete('/api/jobs/:jobId', async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  const files = jobFiles.get(jobId);
  if (!files) {
    return reply.code(404).send({ error: 'Job not found' });
  }
  let deletedCount = 0;
  for (const file of files) {
    try {
      await access(file).then(() => rm(file)).catch(() => {});
      deletedCount++;
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  jobFiles.delete(jobId);
  app.log.info({ jobId, deletedCount }, 'Job files cleaned up');
  return { jobId, deletedCount };
});

// Clean up all files older than specified hours (default 24)
app.post('/api/cleanup', async (request, reply) => {
  const { hours = 24 } = request.body as { hours?: number };
  const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
  let deletedCount = 0;
  try {
    const tmpFiles = await readdir(TMP_ROOT);
    for (const file of tmpFiles) {
      const filePath = path.join(TMP_ROOT, file);
      const stats = await stat(filePath);
      if (stats.mtimeMs < cutoffTime) {
        await rm(filePath);
        deletedCount++;
      }
    }
    app.log.info({ hours, deletedCount }, 'Old files cleaned up');
    return { deletedCount, hours };
  } catch (error) {
    app.log.error({ error }, 'Cleanup failed');
    return reply.code(500).send({ error: 'Cleanup failed' });
  }
});

app.listen({ port: PORT, host: HOST }).then(() => {
  console.log(`Echo voice server listening at http://127.0.0.1:${PORT}`);
  if (HOST === '0.0.0.0') {
    const lanAddresses = Object.values(networkInterfaces()).flat().filter((item) => item?.family === 'IPv4' && !item.internal).map((item) => item!.address);
    for (const address of lanAddresses) console.log(`  On your network: http://${address}:${PORT}`);
  }
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
