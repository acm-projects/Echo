import Fastify, { type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile, access, readdir, stat, rm } from 'node:fs/promises';
import { hostname, networkInterfaces } from 'node:os';
import { createReadStream, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { chunkText, extractBook, gutenbergBook, wordCount, type ExtractedBook } from './book-text.js';
import { clearLocalCopies, deletePrefix, dropLocalCopies, initStorage, listKeys, localCopy, playbackSource, putBytes, putBytesKeepingLocal, putFile, readText, storageMode } from './storage.js';
import { dbMode, deleteNarratorVoice, failInterruptedBooks, getBookOwner, getStaleBookIds, getNarratorVoices, getVoiceUsage, initDb, setBookCast, setBookChapters, setBookDeleted, setBookFailed, setBookProcessing, setBookQueued, setBookReady, setBookSource, setChapterAudio, setChapterStatus, setCharacterVoice, setNarratorSample, setNarratorVoice, setSelectedNarrator, touchBook, userFromAuthorization } from './db.js';

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

// A heading is a chapter or section title: read by the Narrator, followed by a longer pause.
const segmentsSchema = z.object({
  segments: z.array(z.object({
    speaker: z.string().min(1),
    kind: z.enum(['dialogue', 'narration', 'heading']),
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

// Line audio (workers/indextts/outputs) still needed, by the chapters using it. Identical lines share one file, so a
// file is deleted only when the last chapter using it has its MP3 safely in storage.
const lineAudioUsers = new Map<string, Set<string>>();

function useLineAudio(outputPath: string, user: string) {
  const users = lineAudioUsers.get(outputPath) ?? new Set<string>();
  users.add(user);
  lineAudioUsers.set(outputPath, users);
}

/** Lets go of a chapter's line audio; with deleteUnused, files no other chapter is using are deleted. */
async function releaseLineAudio(user: string, deleteUnused: boolean) {
  const unused: string[] = [];
  for (const [outputPath, users] of lineAudioUsers) {
    if (!users.delete(user) || users.size) continue;
    lineAudioUsers.delete(outputPath);
    unused.push(outputPath);
  }
  if (deleteUnused) await Promise.all(unused.map((file) => rm(file, { force: true })));
}

function ensureConfiguration() {
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY is not configured in the repository .env file.');
}

function ensureClaudeConfiguration() {
  if (!CLAUDE_API_KEY) throw new Error('ECHO_API_KEY or CLAUDE_API_KEY is not configured in the repository .env file.');
}

// The narration model takes most of a 16 GB Mac's memory, and two copies (two voice servers on one computer) crashed
// it, so a lock file lets only one server on the machine run the worker at a time.
const WORKER_LOCK = path.join(MODEL_ROOT, '.worker.lock');

function workerLockHolder() {
  let pid: number;
  try {
    pid = Number(readFileSync(WORKER_LOCK, 'utf8'));
  } catch {
    return undefined;
  }
  if (!pid || pid === process.pid) return undefined;
  try {
    process.kill(pid, 0);
    return pid;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM' ? pid : undefined;
  }
}

const releaseWorkerLock = () => {
  if (workerLockHolder() === undefined) rmSync(WORKER_LOCK, { force: true });
};
process.on('exit', releaseWorkerLock);

function startWorker() {
  if (worker) return worker;
  const holder = workerLockHolder();
  if (holder) throw new Error(`Another voice server on this computer (process ${holder}) is already running the narration model. Stop it first: two copies don't fit in memory.`);
  writeFileSync(WORKER_LOCK, String(process.pid));
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
    releaseWorkerLock();
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

// Narrator voices: designed by Gemini, previewed with the cheaper lite TTS model, stored per user.
// Prompted voice design is only available on Gemini's default creation model (currently 3.8 Flash TTS),
// so `voice.model` is omitted on creation; designed voices can then speak through any TTS model.
const NARRATOR_PREVIEW_MODEL = process.env.NARRATOR_GEMINI_MODEL ?? 'gemini-3.8-flash-lite-tts';
const NARRATOR_DAILY_LIMIT = 5;
// Uploaded recordings cost no Gemini credit, only this machine's time to render a preview.
const UPLOAD_DAILY_LIMIT = 10;
const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
// IndexTTS clones from the first 15 s of a reference; a little more is kept so a slow start isn't all of it.
const UPLOAD_CLIP_SECONDS = 20;
const UPLOAD_MIN_SECONDS = 3;
const REFERENCE_SAMPLE_RATE = 24000;
const NARRATOR_STORE = 'narrators/index.json';
const DEFAULT_NARRATOR_SAMPLE = 'The room beneath the stars was silent, except for the soft turning of a page. Somewhere far below, a door opened, and the story began.';

const narratorRequestSchema = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().min(20, 'Describe the voice in at least 20 characters.').max(400),
  sampleText: z.string().trim().min(1).max(500).optional(),
});

// A voice in the studio: designed by Gemini from a description, or cloned from a recording the user uploaded. Older
// store entries have no kind and are designed.
type NarratorVoice = {
  id: string;
  userId: string;
  name: string;
  description: string;
  sampleText: string;
  createdAt: string;
  referenceKey: string;
  previewKey: string;
  kind?: 'designed' | 'uploaded';
  // An uploaded voice's preview is the recording itself until IndexTTS has read the sample line with it.
  previewPending?: boolean;
};
const voiceKind = (voice: NarratorVoice) => voice.kind ?? (voice.id.startsWith('upload_') ? 'uploaded' : 'designed');
type NarratorStore = { voices: NarratorVoice[]; selected: Record<string, string> };

// Serializes read-modify-write cycles on the JSON store.
let narratorStoreLock: Promise<unknown> = Promise.resolve();
const narratorCreationsInFlight = new Map<string, number>();

async function readNarratorStore(): Promise<NarratorStore> {
  // A missing store is a fresh start; a store that can't be read must not be overwritten with an empty one.
  const text = await readText(NARRATOR_STORE);
  return text ? JSON.parse(text) as NarratorStore : { voices: [], selected: {} };
}

function updateNarratorStore<T>(change: (store: NarratorStore) => T | Promise<T>) {
  const run = narratorStoreLock.then(async () => {
    const store = await readNarratorStore();
    const result = await change(store);
    await putBytes(NARRATOR_STORE, JSON.stringify(store, null, 2));
    return result;
  });
  narratorStoreLock = run.catch(() => {});
  return run;
}

function narratorUserId(request: { headers: Record<string, string | string[] | undefined> }) {
  const header = request.headers['x-echo-user'];
  const value = (Array.isArray(header) ? header[0] : header)?.trim();
  return value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : 'local';
}

// Who a request is for. A verified Supabase session makes the signed-in user the owner, and only then are rows
// written to Supabase. The x-echo-user id (the app's mock user) stays as `testId`, so the test narrators made
// before sign-in keep showing up alongside the user's own while the app still runs on mock data.
type Requester = { id: string; testId: string; signedIn: boolean };

async function requester(request: { headers: Record<string, string | string[] | undefined> }): Promise<Requester> {
  const testId = narratorUserId(request);
  const userId = await userFromAuthorization(request.headers.authorization).catch(() => undefined);
  return { id: userId ?? testId, testId, signedIn: Boolean(userId) };
}

const canUseNarrator = (voice: NarratorVoice, who: Requester) => voice.userId === who.id || voice.userId === who.testId;
const selectedNarratorId = (store: NarratorStore, who: Requester) => store.selected[who.id] ?? store.selected[who.testId];

function localDay(date: Date) {
  return date.toLocaleDateString('en-CA');
}

function narratorQuota(store: NarratorStore, userId: string) {
  const today = localDay(new Date());
  const madeToday = (kind: 'designed' | 'uploaded') => store.voices.filter((voice) => voice.userId === userId && voiceKind(voice) === kind && localDay(new Date(voice.createdAt)) === today).length;
  const usedToday = madeToday('designed');
  const uploadsToday = madeToday('uploaded');
  const resetsAt = new Date();
  resetsAt.setHours(24, 0, 0, 0);
  return {
    dailyLimit: NARRATOR_DAILY_LIMIT, usedToday, remainingToday: Math.max(0, NARRATOR_DAILY_LIMIT - usedToday),
    uploadDailyLimit: UPLOAD_DAILY_LIMIT, uploadsToday, uploadsRemainingToday: Math.max(0, UPLOAD_DAILY_LIMIT - uploadsToday),
    resetsAt: resetsAt.toISOString(),
  };
}

type VoiceUsage = Map<string, Array<{ bookId: string; title: string; as: string[] }>>;

// Which books read with each voice (as the narrator, or as a character the reader gave it to). Only books recorded in
// Supabase are known; test-mode books aren't.
async function voiceUsage(who: Requester, voices: NarratorVoice[]): Promise<VoiceUsage> {
  const usage: VoiceUsage = new Map();
  if (!who.signedIn) return usage;
  const uses = await getVoiceUsage(who.id, voices.map((voice) => voice.id)).catch((error: unknown) => {
    app.log.warn({ error }, 'Could not read voice usage from Supabase');
    return [];
  });
  for (const use of uses) {
    const books = usage.get(use.voiceId) ?? [];
    const book = books.find((item) => item.bookId === use.bookId) ?? (books.push({ bookId: use.bookId, title: use.title, as: [] }), books.at(-1)!);
    book.as.push(use.character);
    usage.set(use.voiceId, books);
  }
  return usage;
}

// previewPath is played through /api/media/url like any stored audio, so only the voice's owner can hear it.
function publicNarrator(voice: NarratorVoice, usage?: VoiceUsage) {
  return {
    id: voice.id, name: voice.name, description: voice.description, sampleText: voice.sampleText, createdAt: voice.createdAt,
    kind: voiceKind(voice), previewPath: voice.previewKey, previewPending: Boolean(voice.previewPending),
    usedIn: usage?.get(voice.id) ?? [],
  };
}

// Narrators a signed-in user made through another machine's server are in Supabase and the shared bucket but not
// in this server's store; they're added to it so they can be previewed and selected here too.
async function adoptSupabaseNarrators(who: Requester) {
  if (!who.signedIn) return;
  const rows = await getNarratorVoices(who.id).catch((error: unknown) => {
    app.log.warn({ error }, 'Could not read narrator voices from Supabase');
    return [];
  });
  const store = await readNarratorStore();
  const missing = rows.filter((row) => !store.voices.some((voice) => voice.id === row.voice_id));
  if (!missing.length) return;
  await updateNarratorStore((latest) => {
    for (const row of missing) {
      if (latest.voices.some((voice) => voice.id === row.voice_id)) continue;
      latest.voices.push({ id: row.voice_id, userId: who.id, name: row.name, description: row.description, sampleText: row.sample_text, createdAt: row.created_at, referenceKey: row.reference_path, previewKey: row.preview_path, kind: row.voice_id.startsWith('upload_') ? 'uploaded' : 'designed' });
      if (row.is_selected) latest.selected[who.id] ??= row.voice_id;
    }
  });
}

async function narratorState(who: Requester) {
  await adoptSupabaseNarrators(who);
  const store = await readNarratorStore();
  const voices = store.voices.filter((voice) => canUseNarrator(voice, who)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const usage = await voiceUsage(who, voices);
  return { voices: voices.map((voice) => publicNarrator(voice, usage)), selectedId: selectedNarratorId(store, who) ?? null, previewModel: NARRATOR_PREVIEW_MODEL, ...narratorQuota(store, who.id) };
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

async function createNarratorVoice(who: Requester, input: z.infer<typeof narratorRequestSchema>) {
  const userId = who.id;
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
  const folder = `narrators/${userId}/${voice.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const referenceKey = `${folder}/reference.wav`;
  const previewKey = `${folder}/preview.wav`;
  // Gemini's design sample is a long, neutral read, which makes the better IndexTTS cloning reference.
  await putBytes(referenceKey, Buffer.from(voice.sample_audio.data, 'base64'));
  await putBytes(previewKey, await speakWithVoice(NARRATOR_PREVIEW_MODEL, voice.id, sampleText));
  const narrator: NarratorVoice = { id: voice.id, userId, name: input.name, description: input.description, sampleText, createdAt: new Date().toISOString(), referenceKey, previewKey, kind: 'designed' };
  const selected = await updateNarratorStore((store) => {
    store.voices.push(narrator);
    store.selected[userId] ??= narrator.id;
    return store.selected[userId] === narrator.id;
  });
  if (who.signedIn) {
    await setNarratorVoice({ userId, voiceId: narrator.id, name: narrator.name, description: narrator.description, sampleText, referencePath: referenceKey, previewPath: previewKey, selected })
      .catch((error: unknown) => app.log.warn({ error, voiceId: narrator.id }, 'Narrator saved to S3 but not recorded in Supabase'));
  }
  return narrator;
}

// A voice cloned from the reader's own recording. The clip is made mono at the model's rate with any silent lead-in
// cut, and becomes the cloning reference. It doubles as the preview until IndexTTS has read the sample line with it.
async function createUploadedVoice(who: Requester, input: { name: string; fileName: string; buffer: Buffer }) {
  const id = `upload_${randomBytes(6).toString('hex')}`;
  const extension = path.extname(input.fileName).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin';
  const rawPath = path.join(TMP_ROOT, `${id}-raw${extension}`);
  const clipPath = path.join(TMP_ROOT, `${id}-clip.wav`);
  try {
    await writeFile(rawPath, input.buffer);
    await runProcess(FFMPEG, [
      '-y', '-i', rawPath,
      '-af', `silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,aresample=${REFERENCE_SAMPLE_RATE}`,
      '-t', String(UPLOAD_CLIP_SECONDS), '-ac', '1', '-c:a', 'pcm_s16le', clipPath,
    ]).catch((error: unknown) => {
      throw new Error(`That file couldn't be read as audio. Use a WAV, MP3, M4A or OGG recording. (${error instanceof Error ? error.message.split('\n').at(-1) : error})`);
    });
    const seconds = ((await stat(clipPath)).size - 44) / (REFERENCE_SAMPLE_RATE * 2);
    if (seconds < UPLOAD_MIN_SECONDS) throw new Error(`The recording needs at least ${UPLOAD_MIN_SECONDS} seconds of speech; this one has ${seconds.toFixed(1)}.`);
    const folder = `narrators/${who.id}/${id}`;
    const referenceKey = `${folder}/reference.wav`;
    const previewKey = `${folder}/preview.wav`;
    const clip = readFileSync(clipPath);
    await putBytesKeepingLocal(referenceKey, clip);
    await putBytes(previewKey, clip);
    const narrator: NarratorVoice = {
      id, userId: who.id, name: input.name, description: `Cloned from your recording (${Math.round(seconds)} s).`, sampleText: DEFAULT_NARRATOR_SAMPLE,
      createdAt: new Date().toISOString(), referenceKey, previewKey, kind: 'uploaded', previewPending: true,
    };
    const selected = await updateNarratorStore((store) => {
      store.voices.push(narrator);
      store.selected[who.id] ??= narrator.id;
      return store.selected[who.id] === narrator.id;
    });
    if (who.signedIn) {
      await setNarratorVoice({ userId: who.id, voiceId: id, name: narrator.name, description: narrator.description, sampleText: narrator.sampleText, referencePath: referenceKey, previewPath: previewKey, selected })
        .catch((error: unknown) => app.log.warn({ error, voiceId: id }, 'Uploaded voice saved to S3 but not recorded in Supabase'));
    }
    void renderNarratorPreview(narrator);
    return narrator;
  } finally {
    await rm(rawPath, { force: true });
    await rm(clipPath, { force: true });
  }
}

// Reads the sample line in the cloned voice, so the studio preview is what books will sound like. Runs after the
// upload has been answered: the model can take a minute to load, longer than a phone waits on a request.
async function renderNarratorPreview(voice: NarratorVoice) {
  try {
    const referencePath = await localCopy(voice.referenceKey);
    if (!referencePath) throw new Error('reference missing');
    const calm = EMOTIONS.map((emotion) => (emotion === 'calm' ? 0.5 : 0));
    const outputPath = await runIndexTts(referencePath, voice.sampleText, 'calm, even narration', calm, pacingFor(voice.sampleText, true));
    await putFile(voice.previewKey, outputPath);
    await rm(outputPath, { force: true });
    await updateNarratorStore((store) => {
      const entry = store.voices.find((item) => item.id === voice.id);
      if (entry) entry.previewPending = false;
    });
    app.log.info({ voiceId: voice.id }, 'Uploaded voice preview rendered');
  } catch (error) {
    // The recording itself stays as the preview.
    app.log.warn({ voiceId: voice.id, error: error instanceof Error ? error.message : error }, 'Uploaded voice preview not rendered');
    await updateNarratorStore((store) => {
      const entry = store.voices.find((item) => item.id === voice.id);
      if (entry) entry.previewPending = false;
    }).catch(() => {});
  }
}

async function selectedNarrator(who: Requester) {
  const store = await readNarratorStore();
  const selectedId = selectedNarratorId(store, who);
  const voice = store.voices.find((item) => canUseNarrator(item, who) && item.id === selectedId);
  if (!voice) return undefined;
  const referencePath = await localCopy(voice.referenceKey);
  return referencePath ? { voice, referencePath } : undefined;
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

// Voice Lab keeps each Gemini reference under voice-lab/; the newest one narrates books for users with no narrator.
async function latestNarratorReference() {
  const entries = (await listKeys('voice-lab/')).filter(({ key }) => key.endsWith('.wav'));
  if (!entries.length) throw new Error('No Voice Lab narrator reference was found. Create a narrator or generate one in Voice Lab first.');
  entries.sort((a, b) => b.modified - a.modified);
  const referencePath = await localCopy(entries[0].key);
  if (!referencePath) throw new Error('The newest Voice Lab narrator reference could not be downloaded.');
  return { key: entries[0].key, referencePath };
}

// IndexTTS reads a little slowly for audiobook narration. A duration factor below 1 makes the same voice speak faster
// at the same pitch (it shortens the generated speech rather than speeding up the audio).
const NARRATOR_PACE = Number(process.env.NARRATOR_PACE ?? 0.9);
// Short narrator lines between dialogue ("Walter said.") come out especially drawn out, so they're quickened more.
const SPEECH_TAG_PACE = Number(process.env.SPEECH_TAG_PACE ?? 0.85);
const SPEECH_TAG_MAX_WORDS = 8;
// IndexTTS generates 50 speech tokens a second, and on very short text it tends to run on past the words. Lines of
// up to 12 words are capped at the length of slow speech (1.5 words a second) plus a second of slack.
const SPEECH_TOKENS_PER_SECOND = 50;
const SHORT_LINE_MAX_WORDS = 12;
// IndexTTS's default beam search (3 beams) runs its slowest step three times over. 1 is the lever to try for speed;
// kept at the default until the two have been compared by ear.
const INDEXTTS_NUM_BEAMS = Number(process.env.INDEXTTS_NUM_BEAMS ?? 3);

function pacingFor(text: string, isNarration: boolean) {
  const words = wordCount(text);
  return {
    durationFactor: isNarration ? (words <= SPEECH_TAG_MAX_WORDS ? SPEECH_TAG_PACE : NARRATOR_PACE) : 1,
    maxMelTokens: words <= SHORT_LINE_MAX_WORDS ? Math.ceil((words / 1.5 + 1) * SPEECH_TOKENS_PER_SECOND) : undefined,
  };
}

type Pacing = { durationFactor?: number; maxMelTokens?: number };

// user: the chapter the line is for, which keeps the file from being cleaned up until that chapter is saved. It's
// registered before the cache check, so another chapter finishing can't delete the file between the check and its use.
function runIndexTts(referencePath: string, text: string, emotion: string, emotionVector?: number[], pacing: Pacing = {}, user?: string) {
  const jobId = randomUUID();
  const { durationFactor = 1, maxMelTokens } = pacing;
  // Default pacing keeps the old cache key, so audio made before pacing existed is still reused.
  const pacingKey = durationFactor !== 1 || maxMelTokens ? `:${durationFactor}:${maxMelTokens ?? ''}` : '';
  const digest = createHash('sha256').update(`${referencePath}:${text}:${emotion}:${emotionVector?.join(',') ?? ''}${pacingKey}`).digest('hex').slice(0, 20);
  const outputPath = path.join(MODEL_OUTPUTS, `${digest}.wav`);
  if (user) useLineAudio(outputPath, user);
  return access(outputPath).then(
    () => outputPath,
    () => new Promise<string>((resolve, reject) => {
      pending.set(jobId, { resolve, reject });
      startWorker().stdin.write(`${JSON.stringify({ jobId, referencePath, outputPath, text, emotion, emotionVector, durationFactor, maxMelTokens, numBeams: INDEXTTS_NUM_BEAMS, language: 'EN' })}\n`);
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

// IndexTTS pads each clip with up to half a second of silence, which drags short lines out; the gap between segments
// comes from SEGMENT_SILENCE_SECONDS instead. -50 dB sits below a whisper, and the reverse pass trims the end.
const TRIM_EDGES = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse';

type LoudnessMeasurement = { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string };

// First pass of ffmpeg's two-pass loudnorm: measures the file without writing audio.
async function measureLoudness(filePath: string) {
  const stderr = await runProcess(FFMPEG, ['-hide_banner', '-nostats', '-i', filePath, '-af', `loudnorm=${LOUDNORM_TARGETS}:print_format=json`, '-f', 'null', '-']);
  const json = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1);
  return JSON.parse(json) as LoudnessMeasurement;
}

// Each segment is gain-matched to the target (plus its delivery offset) so voices sit at the same level,
// then the whole book gets one linear gain so the final file lands on -16 LUFS.
// gainOffsetDb shifts a segment's target away from -16 LUFS (e.g. -10 dB for a whisper); pauseAfterSec adds silence
// after a segment on top of the usual gap (after a chapter heading, say).
async function stitchSegments(jobId: string, segments: Array<{ path: string; gainOffsetDb: number; pauseAfterSec?: number }>) {
  if (!segments.length) throw new Error('Cannot stitch an empty segment list.');

  const workDir = path.join(TMP_ROOT, `${jobId}-segments`);
  const premasterPath = path.join(TMP_ROOT, `${jobId}-premaster.wav`);
  const wavPath = path.join(TMP_ROOT, `${jobId}.wav`);
  const mp3Path = path.join(TMP_ROOT, `${jobId}.mp3`);
  await mkdir(workDir, { recursive: true });
  try {
    const silences = new Map<number, string>();
    const silenceFor = async (seconds: number) => {
      let silencePath = silences.get(seconds);
      if (!silencePath) {
        silencePath = path.join(workDir, `silence-${Math.round(seconds * 1000)}.wav`);
        await runProcess(FFMPEG, ['-y', '-f', 'lavfi', '-t', String(seconds), '-i', `anullsrc=r=${SAMPLE_RATE}:cl=mono`, ...PCM_ARGS, silencePath]);
        silences.set(seconds, silencePath);
      }
      return silencePath;
    };

    const leveledPaths = await mapWithConcurrency(segments, 4, async ({ path: segmentPath, gainOffsetDb }, index) => {
      const measured = Number((await measureLoudness(segmentPath)).input_i);
      // Clips too short or quiet to measure (under ~400ms) keep their original level, plus the delivery offset.
      const gain = Number.isFinite(measured) && measured > -70 ? Math.max(-20, Math.min(20, TARGET_LUFS + gainOffsetDb - measured)) : gainOffsetDb;
      const leveledPath = path.join(workDir, `${String(index).padStart(5, '0')}.wav`);
      await runProcess(FFMPEG, [
        '-y', '-i', segmentPath,
        '-af', `aresample=${SAMPLE_RATE},${TRIM_EDGES},volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:level=0`,
        ...PCM_ARGS, leveledPath,
      ]);
      return leveledPath;
    });

    const listPath = path.join(workDir, 'list.txt');
    const quote = (file: string) => `file '${file.replace(/'/g, "'\\''")}'`;
    const entries: string[] = [];
    // When each segment starts in the finished file (16-bit mono PCM, so a file's size gives its length).
    const startsSec: number[] = [];
    let elapsedSec = 0;
    for (const [index, file] of leveledPaths.entries()) {
      startsSec.push(Math.round(elapsedSec * 100) / 100);
      entries.push(file);
      elapsedSec += ((await stat(file)).size - 44) / (SAMPLE_RATE * 2);
      if (index < leveledPaths.length - 1) {
        const gapSec = SEGMENT_SILENCE_SECONDS + (segments[index].pauseAfterSec ?? 0);
        entries.push(await silenceFor(gapSec));
        elapsedSec += gapSec;
      }
    }
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
    return { wavPath, mp3Path, startsSec };
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
await initStorage(SERVER_ROOT);
initDb();

app.get('/health', async () => ({
  ok: true,
  googleKeyConfigured: Boolean(GOOGLE_API_KEY),
  model: GEMINI_MODEL,
  indexTtsCheckpointPath: MODEL_ROOT,
  claudeKeyConfigured: Boolean(CLAUDE_API_KEY),
  storage: storageMode,
  supabase: dbMode,
}));

type JobChapter = { index: number; title: string; status: 'queued' | 'processing' | 'ready' | 'failed'; audioKey?: string; durationMs?: number; error?: string };

// A member of the cast as the app shows it: who they are, the voice they'll be read with, and where it came from.
type CastEntry = { name: string; gender: string; voiceDescription: string; samplePath?: string; source: 'designed' | 'narrator'; narratorId?: string; narratorName?: string; hasDesigned: boolean };

type BookJob = {
  status: 'processing' | 'done' | 'error';
  stage: string;
  userId: string;
  // Whether userId is a signed-in account (see isOwner).
  account: boolean;
  updatedAt: string;
  // Each chapter's progress, so the app can play finished chapters while later ones are still being narrated.
  chapters?: JobChapter[];
  // The voices are ready and narration waits for the reader to approve or change them.
  awaitingCast?: boolean;
  cast?: CastEntry[];
  result?: unknown;
  error?: string;
};
// Book processing takes minutes, longer than mobile HTTP idle timeouts (iOS NSURLRequest defaults to 60s)
// and longer than an app may stay foregrounded, so clients start a job and poll its status instead.
const bookJobs = new Map<string, BookJob>();

// Everything a book keeps sits under books/<jobId>/: the uploaded file, the finished audio (audio.mp3 for a one-chapter
// book, chapters/000.mp3... otherwise), its manifest, job state, and the character voice references.
const bookFolder = (jobId: string) => `books/${jobId}`;
const chapterAudioKey = (jobId: string, index: number, chapterCount: number) =>
  chapterCount > 1 ? `${bookFolder(jobId)}/chapters/${String(index).padStart(3, '0')}.mp3` : `${bookFolder(jobId)}/audio.mp3`;
const jobStateKey = (jobId: string) => `${bookFolder(jobId)}/job.json`;
// One marker per book still being narrated, so a restarted server carries on where it stopped. A marker names its
// machine, so two servers sharing a bucket don't both pick the same book up.
const activeMarkerFolder = (jobId: string) => `jobs/active/${jobId}/`;
const SERVER_NAME = hostname();
const isBookId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// Smaller chunks leave output-token room for an emotion vector on every segment.
const SEGMENT_CHUNK_CHARS = 8000;
// Claude calls for one chapter's chunks are independent, so a few run at once.
const SEGMENT_CONCURRENCY = 3;
// Extra silence after a chapter or section heading, on top of the usual gap between segments.
const HEADING_PAUSE_SECONDS = 1;
// The cast is read from the book's opening; chapters past it are checked for new speakers before they're split.
const ROSTER_EXCERPT_CHARS = 30000;
// A narrating book touches its Supabase row this often; one silent for STALE_MINUTES is swept as interrupted.
const HEARTBEAT_MS = 2 * 60_000;
const STALE_MINUTES = 15;

type Roster = z.infer<typeof rosterSchema>;
type RosterCharacter = Roster['characters'][number];
type Segment = z.infer<typeof segmentsSchema>['segments'][number];
const newCharactersSchema = z.object({ characters: z.array(rosterSchema.shape.characters.element) });

type ChapterState = { index: number; title: string; text: string; startOffset: number; status: JobChapter['status']; audioKey?: string; durationMs?: number; error?: string };
// source: designed by Gemini for this book, or one of the reader's studio voices (then narratorId/label say which).
type VoiceRef = { voiceId?: string; referenceKey: string; samplePath: string; source?: 'designed' | 'narrator'; narratorId?: string; label?: string };
type TimelineEntry = { startSec: number; speaker: string };

// Everything needed to carry a book on after a restart, a retry or a change of narrator, saved at books/<id>/job.json:
// the chapters, Claude's cast and scene splits, and the S3 keys of every voice's reference recording.
type JobState = {
  jobId: string;
  userId: string;
  testId: string;
  signedIn: boolean;
  server: string;
  sourceKey: string;
  title: string;
  author?: string;
  characterVoices: boolean;
  status: BookJob['status'];
  error?: string;
  chapters: ChapterState[];
  roster?: Roster;
  castReady?: boolean;
  // With character voices, narration waits after the voices are made until the reader approves the cast.
  reviewCast?: boolean;
  castApproved?: boolean;
  voices: Record<string, VoiceRef>;
  // The Gemini voice made for each character, kept so a swapped character can go back to it.
  designedVoices?: Record<string, VoiceRef>;
  segments: Record<string, Segment[]>;
  narrated: Record<string, { audioKey: string; durationMs: number; timeline: TimelineEntry[]; segments: unknown[] }>;
};

// Books narrating on this server (with their state, so cleanup can see which voices they still use), and books
// removed mid-narration (their run stops at the next line).
const running = new Map<string, JobState>();
const cancelled = new Set<string>();
// Books whose voices are made and wait for the reader's approval. Kept in memory so a cast change edits the same state
// the (still running) scene splitting writes to, and the approval carries it on without reloading.
const waitingBooks = new Map<string, JobState>();

async function loadJob(jobId: string) {
  const text = await readText(jobStateKey(jobId)).catch(() => undefined);
  return text ? (JSON.parse(text) as JobState) : undefined;
}

const awaitingCast = (state: JobState) => Boolean(state.reviewCast && state.castReady && !state.castApproved);

// The voice Gemini designed for a character. Books made before designedVoices existed only have it while it's still
// in use (an unlabelled entry in voices).
const designedVoiceOf = (state: JobState, name: string) =>
  state.designedVoices?.[name] ?? (name !== 'Narrator' && state.voices[name] && !state.voices[name].source ? state.voices[name] : undefined);

function castOf(state: JobState): CastEntry[] {
  const narrator = state.voices.Narrator;
  return (state.roster?.characters ?? []).map((character) => {
    const voice = state.voices[character.name];
    const hasDesigned = Boolean(designedVoiceOf(state, character.name));
    if (!voice) return { name: character.name, gender: character.gender, voiceDescription: character.voiceDescription, samplePath: narrator?.samplePath, source: 'narrator', narratorId: narrator?.narratorId, narratorName: narrator?.label ?? 'your narrator', hasDesigned };
    return { name: character.name, gender: character.gender, voiceDescription: character.voiceDescription, samplePath: voice.samplePath, source: voice.source ?? (character.name === 'Narrator' ? 'narrator' : 'designed'), narratorId: voice.narratorId, narratorName: voice.label, hasDesigned };
  });
}

function publishJob(state: JobState, patch: Partial<BookJob> = {}) {
  const previous = bookJobs.get(state.jobId);
  bookJobs.set(state.jobId, {
    stage: previous?.stage ?? 'Queued',
    result: previous?.result,
    status: state.status,
    userId: state.userId,
    account: state.signedIn,
    updatedAt: new Date().toISOString(),
    chapters: state.chapters.map(({ index, title, status, audioKey, durationMs, error }) => ({ index, title, status, audioKey, durationMs, error })),
    awaitingCast: awaitingCast(state),
    cast: state.castReady ? castOf(state) : undefined,
    error: state.error,
    ...patch,
  });
}

// Adjacent lines by the same speaker with the same delivery are read in one go, up to this many characters: fewer
// generations, and the model carries the voice's rhythm across sentences instead of restarting at each one.
const MERGE_MAX_CHARS = 500;

function mergeSegments(segments: Segment[]): Segment[] {
  const merged: Segment[] = [];
  for (const segment of segments) {
    const last = merged.at(-1);
    const joinable = last && segment.kind !== 'heading' && last.kind === segment.kind && last.speaker === segment.speaker && last.delivery === segment.delivery
      && last.text.length + segment.text.length + 1 <= MERGE_MAX_CHARS;
    if (!joinable) {
      merged.push({ ...segment, emotionVector: { ...segment.emotionVector } });
      continue;
    }
    // The joined line takes the mean of its parts' emotions, weighted by length, and keeps the first label.
    const total = last.text.length + segment.text.length;
    for (const emotion of EMOTIONS) last.emotionVector[emotion] = Math.round(((last.emotionVector[emotion] * last.text.length + segment.emotionVector[emotion] * segment.text.length) / total) * 100) / 100;
    last.text = `${last.text} ${segment.text}`;
  }
  return merged;
}

// The order lines are generated in: grouped by voice, in the order the voices first speak, and in text order within a
// group. IndexTTS keeps the conditioning for the last reference it saw, so a run of lines in one voice skips the
// cloning step that every change of voice costs.
function generationOrder(speakers: string[]) {
  const firstSeen = new Map<string, number>();
  speakers.forEach((speaker, index) => { if (!firstSeen.has(speaker)) firstSeen.set(speaker, index); });
  return speakers.map((speaker, index) => index).sort((a, b) => firstSeen.get(speakers[a])! - firstSeen.get(speakers[b])! || a - b);
}

async function splitSegments(roster: Roster, text: string) {
  const chunks = chunkText(text, SEGMENT_CHUNK_CHARS);
  const parsed = await mapWithConcurrency(chunks, SEGMENT_CONCURRENCY, (chunk) => claudeStructuredOutput(
    'split_segments',
    'Split the provided book chunk into ordered narration, dialogue and heading segments. Use only roster names, preserve text verbatim, and score the emotion that should guide delivery.',
    `Use this roster consistently:\n${JSON.stringify(roster.characters.map(({ name, aliases }) => ({ name, aliases })))}\n\nSplit this chunk into ordered segments. Do not summarize or rewrite the text. Narration and speech tags ("she said") use the Narrator speaker. A chapter or section title (for example "Chapter 3: The Storm" or "Epilogue") is its own segment with kind "heading", speaker Narrator, normal delivery and a calm emotion.\n\n${EMOTION_GUIDE}\n\nChunk:\n${chunk}`,
    segmentsSchema,
    'medium',
  ));
  return parsed.flatMap((result) => result.segments);
}

// The listener's selected narrator, or the newest Voice Lab voice when they haven't picked one.
async function narratorVoiceRef(who: Requester): Promise<VoiceRef> {
  const selected = await selectedNarrator(who);
  if (selected) return studioVoiceRef(selected.voice);
  const fallback = await latestNarratorReference();
  return { referenceKey: fallback.key, samplePath: fallback.key, source: 'narrator', label: 'Voice Lab sample' };
}

const studioVoiceRef = (voice: NarratorVoice): VoiceRef => ({ voiceId: voice.id, referenceKey: voice.referenceKey, samplePath: voice.previewKey, source: 'narrator', narratorId: voice.id, label: voice.name });

/** Creates a book from an upload or a catalog import and starts narrating it. The job id is also the book's id. */
function startBook(input: { who: Requester; fileName: string; buffer: Buffer; book: ExtractedBook; characterVoices: boolean; title?: string; author?: string }) {
  const jobId = randomUUID();
  const multi = input.book.chapters.length > 1;
  const title = input.title ?? path.basename(input.fileName, path.extname(input.fileName)).replace(/[_-]+/g, ' ').trim();
  let offset = 0;
  const chapters = input.book.chapters.map((chapter, index) => {
    const startOffset = offset;
    offset += chapter.text.length + 2;
    return { index, title: chapter.title ?? (multi ? `Chapter ${index + 1}` : title), text: chapter.text, startOffset, status: 'queued' as const };
  });
  const state: JobState = {
    jobId, userId: input.who.id, testId: input.who.testId, signedIn: input.who.signedIn, server: SERVER_NAME,
    sourceKey: `${bookFolder(jobId)}/source${path.extname(input.fileName).toLowerCase() || '.txt'}`,
    title, author: input.author, characterVoices: input.characterVoices, status: 'processing', chapters, voices: {}, segments: {}, narrated: {},
    // With one voice there's nothing to review.
    reviewCast: input.characterVoices,
  };
  publishJob(state, { stage: 'Queued' });
  void runBook(state, input.buffer);
  return jobId;
}

// Narrates every chapter that isn't ready yet, one at a time, so a reader can start on chapter 1 while the rest are
// made. Each step is saved to the job state, so a retry, a restart or a new narrator picks up without redoing Claude's
// work. With characterVoices off (the app's Character Voices switch), the narrator reads every line.
async function runBook(state: JobState, sourceBuffer?: Buffer) {
  const { jobId } = state;
  if (running.has(jobId)) return;
  running.set(jobId, state);
  waitingBooks.delete(jobId);
  const folder = bookFolder(jobId);
  const who: Requester = { id: state.userId, testId: state.testId, signedIn: state.signedIn };
  const multi = state.chapters.length > 1;
  const setStage = (stage: string) => publishJob(state, { stage });
  const lineAudioUser = (index: number) => `${jobId}:${index}`;
  const checkCancelled = () => {
    if (cancelled.has(jobId)) throw new Error('The book was removed.');
  };
  const save = async () => {
    if (!cancelled.has(jobId)) await putBytes(jobStateKey(jobId), JSON.stringify(state));
  };
  // Supabase rows are a record of what's in S3, so a failed write is logged and the audiobook still finishes.
  let recordInSupabase = state.signedIn;
  const record = async (what: string, write: () => Promise<unknown>) => {
    if (!recordInSupabase) return;
    await write().catch((error: unknown) => {
      app.log.warn({ error: error instanceof Error ? error.message : error, jobId }, `Supabase ${what} not recorded`);
      if (what === 'book') recordInSupabase = false;
    });
  };
  // The marker's beatAt tells other servers sharing the bucket that this book is alive, even if Supabase writes fail.
  const writeMarker = () => putBytes(`${activeMarkerFolder(jobId)}marker.json`, JSON.stringify({ server: SERVER_NAME, beatAt: new Date().toISOString() }));
  const heartbeat = setInterval(() => {
    void record('heartbeat', () => touchBook(jobId));
    if (!cancelled.has(jobId)) void writeMarker().catch(() => {});
  }, HEARTBEAT_MS);
  const references = new Map<string, string>();
  try {
    state.status = 'processing';
    state.error = undefined;
    state.server = SERVER_NAME;
    if (sourceBuffer) {
      await putBytes(state.sourceKey, sourceBuffer);
      await record('book', () => setBookSource({ id: jobId, userId: state.userId, title: state.title, author: state.author, sourcePath: state.sourceKey, sizeBytes: sourceBuffer.length }));
    } else {
      await record('book', () => setBookProcessing(jobId));
    }
    await writeMarker();
    await save();
    app.log.info({ jobId, chapterCount: state.chapters.length, titles: state.chapters.map((chapter) => chapter.title) }, 'Chapters found');

    if (!state.roster) {
      setStage('Reading the book with Claude');
      app.log.info('Calling Claude to extract roster');
      const excerpt = state.chapters.map((chapter) => chapter.text).join('\n\n').slice(0, ROSTER_EXCERPT_CHARS);
      state.roster = await claudeStructuredOutput(
        'extract_roster',
        'Extract a stable character roster from the book excerpt. Always include Narrator. Voice descriptions must be safe, generic audio descriptions of adult voices.',
        `Build a character roster for this book text. For each speaking character include the canonical name, aliases, gender (female, male, or neutral, inferred from names, pronouns, and context), and a voiceDescription of their permanent vocal traits. State the gender explicitly in every voiceDescription. Include Narrator.\n\n${VOICE_SAFETY_RULES}\n\nBook text:\n${excerpt}`,
        rosterSchema,
        'low',
      );
      app.log.info({ characterCount: state.roster.characters.length }, 'Roster extracted');
      await save();
    }
    const roster = state.roster;
    const castFor = (characters: RosterCharacter[]) => characters.map((character) => ({ ...character, voiceId: state.voices[character.name]?.voiceId, voiceSamplePath: state.voices[character.name]?.samplePath }));

    const designVoice = async (character: RosterCharacter, index: number) => {
      app.log.info({ character: character.name }, 'Generating voice preview');
      try {
        const { voice, description } = await createCharacterVoice(character, index);
        character.voiceDescription = description;
        const fileBase = voice.id!.replace(/[^a-zA-Z0-9_-]/g, '_');
        const key = `${folder}/voices/${fileBase}.wav`;
        // Stored, and kept as the local copy IndexTTS reads; it's removed with the book's other copies when it ends.
        references.set(character.name, await putBytesKeepingLocal(key, Buffer.from(voice.sample_audio!.data!, 'base64')));
        state.voices[character.name] = { voiceId: voice.id, referenceKey: key, samplePath: key, source: 'designed' };
        (state.designedVoices ??= {})[character.name] = state.voices[character.name];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        app.log.warn({ character: character.name, error: message }, 'Voice generation blocked after all fallbacks, using narrator voice');
      }
    };

    // Characters the opening didn't reach are found chapter by chapter, given voices, and added to the cast.
    const extendRoster = async (chapter: ChapterState) => {
      if (chapter.startOffset + chapter.text.length <= ROSTER_EXCERPT_CHARS) return;
      const found = await claudeStructuredOutput(
        'extend_roster',
        'Find speaking characters in a book chapter who are missing from an existing roster. Voice descriptions must be safe, generic audio descriptions of adult voices.',
        `Existing roster:\n${JSON.stringify(roster.characters.map(({ name, aliases }) => ({ name, aliases })))}\n\nList only characters who speak in this chapter and are not in the existing roster (check names and aliases). For each include the canonical name, aliases, gender (female, male, or neutral), and a voiceDescription of their permanent vocal traits that states the gender. Return an empty list if there are none.\n\n${VOICE_SAFETY_RULES}\n\nChapter:\n${chapter.text.slice(0, ROSTER_EXCERPT_CHARS)}`,
        newCharactersSchema,
        'low',
      );
      const known = new Set(roster.characters.flatMap((character) => [character.name, ...character.aliases].map((name) => name.toLowerCase())));
      const added = found.characters.filter((character) => character.name !== 'Narrator' && !known.has(character.name.toLowerCase()));
      if (!added.length) return;
      roster.characters.push(...added);
      if (state.characterVoices) for (const character of added) await designVoice(character, roster.characters.length);
      app.log.info({ jobId, chapter: chapter.index, added: added.map((character) => character.name) }, 'New characters added to the cast');
      await record('cast additions', () => setBookCast(jobId, castFor(added)));
      await save();
    };

    // Segmenting runs a chapter ahead of narration: Claude is a network call and IndexTTS runs locally, so the two
    // overlap. Splits are saved, so a retry or a new narrator reuses them.
    const segmentations = new Map<number, Promise<Segment[]>>();
    const segmentsFor = (index: number) => {
      if (!segmentations.has(index)) {
        const cached = state.segments[index];
        const split = cached ? Promise.resolve(cached) : (async () => {
          await extendRoster(state.chapters[index]);
          const segments = await splitSegments(roster, state.chapters[index].text);
          state.segments[index] = segments;
          await save();
          return segments;
        })();
        split.catch(() => {}); // Awaited (and reported) when its chapter comes up.
        segmentations.set(index, split);
      }
      return segmentations.get(index)!;
    };
    const pending = state.chapters.filter((chapter) => chapter.status !== 'ready');
    if (pending[0] && state.chapters[pending[0].index].startOffset < ROSTER_EXCERPT_CHARS) segmentsFor(pending[0].index);

    if (!state.castReady) {
      setStage(state.characterVoices ? 'Designing character voices' : 'Preparing the narrator');
      state.voices.Narrator = await narratorVoiceRef(who);
      app.log.info({ narrator: state.voices.Narrator.referenceKey }, 'Narrator reference chosen');
      if (state.characterVoices) {
        for (const [index, character] of roster.characters.filter((item) => item.name !== 'Narrator').entries()) await designVoice(character, index);
      } else {
        app.log.info({ jobId }, 'Character voices off: the narrator reads every line');
      }
      if (!roster.characters.some((character) => character.name === 'Narrator')) {
        roster.characters.unshift({ name: 'Narrator', aliases: [], gender: 'neutral', voiceDescription: 'The narrator.' });
      }
      await record('cast', () => setBookCast(jobId, castFor(roster.characters)));
      await record('chapters', () => setBookChapters(jobId, state.chapters.map(({ index, title, text }) => ({ index, title, wordCount: wordCount(text) }))));
      state.castReady = true;
      await save();
    }
    // Local copies of every reference recording; after a restart they're downloaded again from storage.
    for (const [name, voice] of Object.entries(state.voices)) {
      if (references.has(name)) continue;
      const local = await localCopy(voice.referenceKey);
      if (local) references.set(name, local);
    }
    if (!references.has('Narrator')) throw new Error('The narrator voice recording could not be found.');

    if (awaitingCast(state)) {
      // The voices are ready to hear. Narration starts when the reader approves the cast (PUT /api/books/:id/cast).
      // The book isn't "processing" meanwhile, so no server's stale sweep marks it failed, and it has no active
      // marker, so a restart doesn't pick it up.
      await save();
      await record('book queued', () => setBookQueued(jobId));
      await deletePrefix(activeMarkerFolder(jobId)).catch(() => {});
      publishJob(state, { stage: 'Review the cast' });
      waitingBooks.set(jobId, state);
      app.log.info({ jobId, cast: castOf(state).map((entry) => `${entry.name}: ${entry.source}`) }, 'Waiting for the reader to approve the cast');
      return;
    }

    // The manifest is rewritten after every chapter, so finished chapters are on record even if a later one fails.
    const manifestKey = `${folder}/manifest.json`;
    const writeManifest = () => putBytes(manifestKey, JSON.stringify({
      jobId, userId: state.userId, sourceKey: state.sourceKey, characterVoices: state.characterVoices, roster,
      cast: roster.characters.map(({ name }) => ({ name, voiceId: state.voices[name]?.voiceId, voiceSamplePath: state.voices[name]?.samplePath })),
      chapters: state.chapters.filter((chapter) => state.narrated[chapter.index]).map((chapter) => ({ index: chapter.index, title: chapter.title, ...state.narrated[chapter.index] })),
    }, null, 2));

    for (const chapter of pending) {
      const stage = (what: string) => setStage(multi ? `Chapter ${chapter.index + 1} of ${state.chapters.length} · ${what}` : what);
      try {
        checkCancelled();
        chapter.status = 'processing';
        chapter.error = undefined;
        publishJob(state);
        await record('chapter status', () => setChapterStatus(jobId, chapter.index, 'processing'));
        stage('Splitting scenes');
        const segments = await segmentsFor(chapter.index);
        const upcoming = pending.find((item) => item.index > chapter.index);
        if (upcoming) segmentsFor(upcoming.index);
        app.log.info({ jobId, chapter: chapter.index, segmentCount: segments.length }, 'Starting IndexTTS generation');

        const lines = mergeSegments(segments);
        const speakers = lines.map((segment) => (references.has(segment.speaker) ? segment.speaker : 'Narrator'));
        const outputSegments: Array<{ index: number; speaker: string; kind: Segment['kind']; text: string; emotion: string; emotionVector: Segment['emotionVector']; delivery: Segment['delivery']; speechText?: string; requestedEmotionVector?: Segment['emotionVector']; outputPath: string }> = [];
        let adjustedVectors = 0;
        let generated = 0;
        for (const index of generationOrder(speakers)) {
          const segment = lines[index];
          checkCancelled();
          stage(`Narrating (${++generated}/${lines.length})`);
          const speaker = speakers[index];
          // Dialogue from characters without their own voice falls back to the narrator voice but keeps its emotion.
          const isNarration = segment.speaker === 'Narrator' || segment.kind !== 'dialogue';
          const { capped, changed } = isNarration ? capNarratorEmotion(segment.emotionVector) : shapeDialogueEmotion(segment.emotionVector);
          const delivery = isNarration ? 'normal' : segment.delivery;
          if (changed) adjustedVectors += 1;
          const emotionVector = EMOTIONS.map((emotion) => capped[emotion]);
          const speechText = segment.kind === 'dialogue' ? dialogueSpeechText(segment.text) : segment.text;
          const outputPath = await runIndexTts(references.get(speaker)!, speechText, segment.emotion, emotionVector, pacingFor(speechText, isNarration), lineAudioUser(chapter.index));
          outputSegments[index] = {
            index, speaker, kind: segment.kind, text: segment.text, emotion: segment.emotion, emotionVector: capped, delivery,
            ...(speechText !== segment.text ? { speechText } : {}),
            ...(changed ? { requestedEmotionVector: segment.emotionVector } : {}),
            outputPath,
          };
        }
        app.log.info({ chapter: chapter.index, adjustedVectors, generatedCount: outputSegments.length, mergedFrom: segments.length }, 'IndexTTS generation complete');

        stage('Mixing the audio');
        const { wavPath, mp3Path, startsSec } = await stitchSegments(`${jobId}-${chapter.index}`, outputSegments.map((segment) => ({
          path: segment.outputPath,
          gainOffsetDb: DELIVERY_GAIN_DB[segment.delivery],
          pauseAfterSec: segment.kind === 'heading' ? HEADING_PAUSE_SECONDS : undefined,
        })));
        // Only the MP3 is kept; the WAV master is several times larger and nothing plays it.
        checkCancelled();
        stage('Saving the audio');
        const audioKey = chapterAudioKey(jobId, chapter.index, state.chapters.length);
        await putFile(audioKey, mp3Path);
        // 16-bit mono PCM at SAMPLE_RATE, so the WAV's size gives the running time.
        const durationMs = Math.round(((await stat(wavPath)).size - 44) / (SAMPLE_RATE * 2) * 1000);
        const sizeBytes = (await stat(mp3Path)).size;
        await rm(wavPath, { force: true });
        await rm(mp3Path, { force: true });
        await record('chapter', () => setChapterAudio(jobId, { index: chapter.index, title: chapter.title, audioPath: audioKey, durationMs, sizeBytes, wordCount: wordCount(chapter.text) }));
        Object.assign(chapter, { status: 'ready', audioKey, durationMs });
        // Who speaks when, so the player can show the current speaker.
        state.narrated[chapter.index] = { audioKey, durationMs, timeline: outputSegments.map((segment, index) => ({ startSec: startsSec[index], speaker: segment.speaker })), segments: outputSegments };
        timelineCache.delete(`${jobId}:${chapter.index}`);
        await save();
        await writeManifest();
        publishJob(state);
        // The chapter's MP3 is in storage, so its line audio is no longer needed here.
        await releaseLineAudio(lineAudioUser(chapter.index), true);
        app.log.info({ jobId, chapter: chapter.index, audioKey, durationMs }, 'Chapter ready');
      } catch (error) {
        if (cancelled.has(jobId)) throw error;
        // One chapter failing (a refusal, say) leaves the others listenable.
        const message = error instanceof Error ? error.message : 'Chapter narration failed.';
        app.log.error({ error, message, jobId, chapter: chapter.index }, 'Chapter failed');
        Object.assign(chapter, { status: 'failed', error: message });
        // Lines already made are kept for a retry, which reuses them instead of narrating them again.
        await releaseLineAudio(lineAudioUser(chapter.index), false);
        publishJob(state);
        await record('chapter status', () => setChapterStatus(jobId, chapter.index, 'failed', message));
        await save();
      }
    }
    const ready = state.chapters.filter((chapter) => chapter.status === 'ready');
    const failed = state.chapters.filter((chapter) => chapter.status === 'failed');
    if (!ready.length) throw new Error(failed[0]?.error ?? 'No chapter could be narrated.');

    const problem = failed.length ? `${failed.length} of ${state.chapters.length} chapters could not be narrated: ${failed.map((chapter) => `${chapter.title} (${chapter.error})`).join('; ')}` : undefined;
    const durationMs = ready.reduce((total, chapter) => total + (chapter.durationMs ?? 0), 0);
    await record('book status', () => setBookReady(jobId, { chapters: state.chapters.length, durationMs, problem, modelInfo: { roster: CLAUDE_MODEL, voices: GEMINI_MODEL, speech: 'IndexTTS2', characterVoices: state.characterVoices ? 'on' : 'off' } }));
    state.status = 'done';
    state.error = problem;
    await save();
    await deletePrefix(activeMarkerFolder(jobId)).catch(() => {});
    app.log.info({ jobId, narrated: ready.length, failed: failed.length }, 'Book processing complete');
    publishJob(state, { stage: 'Complete', result: { jobId, roster, chapters: bookJobs.get(jobId)?.chapters } });
  } catch (error) {
    if (cancelled.has(jobId)) {
      app.log.info({ jobId }, 'Narration stopped: the book was removed');
      return;
    }
    const message = error instanceof Error ? error.message : 'Book processing failed.';
    app.log.error({ error, message, jobId }, 'Book processing failed');
    for (const chapter of state.chapters) if (chapter.status === 'processing') Object.assign(chapter, { status: 'failed', error: message });
    state.status = 'error';
    state.error = message;
    publishJob(state, { stage: 'Failed' });
    await record('failure', () => setBookFailed(jobId, message));
    // The source, voices and Claude's splits are kept, so the book can be retried without starting over.
    await save().catch(() => {});
    await deletePrefix(activeMarkerFolder(jobId)).catch(() => {});
  } finally {
    clearInterval(heartbeat);
    running.delete(jobId);
    for (const chapter of state.chapters) await releaseLineAudio(lineAudioUser(chapter.index), cancelled.has(jobId)).catch(() => {});
    // Local copies of the voices this book used, unless another book narrating here still reads them (a shared
    // narrator). Everything is in storage, and a retry downloads what it needs again.
    const stillUsed = new Set([...running.values()].flatMap((other) => Object.values(other.voices).map((voice) => voice.referenceKey)));
    await dropLocalCopies([`${folder}/`, ...Object.values(state.voices).map((voice) => voice.referenceKey).filter((key) => !stillUsed.has(key))]).catch(() => {});
    if (cancelled.has(jobId)) {
      // Anything written after the removal (a chapter that was mid-upload) is cleared too.
      await deletePrefix(`${folder}/`).catch(() => {});
      await deletePrefix(activeMarkerFolder(jobId)).catch(() => {});
      cancelled.delete(jobId);
    }
  }
}

function readCharacterVoices(fields: Record<string, unknown> | undefined) {
  const field = fields?.characterVoices as { value?: unknown } | Array<unknown> | undefined;
  return (field && !Array.isArray(field) && 'value' in field ? String(field.value) : 'true') !== 'false';
}

app.post('/api/books/process', async (request, reply) => {
  try {
    ensureClaudeConfiguration();
    ensureConfiguration();
    app.log.info('Starting book processing');
    const upload = await request.file();
    if (!upload) return reply.code(400).send({ error: 'Attach a book file in the book field.' });
    app.log.info({ filename: upload.filename }, 'File received');
    const buffer = await upload.toBuffer();
    const book = await extractBook(upload.filename, buffer);
    const words = wordCount(book.text);
    app.log.info({ textLength: book.text.length, wordCount: words, chapterCount: book.chapters.length }, 'Text extracted from file');
    if (words < 10) return reply.code(400).send({ error: 'The uploaded file did not contain enough readable text (minimum 10 words).' });
    // Sent as a form field ahead of the file; anything but "false" keeps character voices on.
    const characterVoices = readCharacterVoices(upload.fields);
    const jobId = startBook({ who: await requester(request), fileName: upload.filename, buffer, book, characterVoices });
    return reply.code(202).send({ jobId, status: 'processing', stage: 'Queued' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Book processing failed.';
    app.log.error({ error, message }, 'Book processing failed');
    return reply.code(400).send({ error: message });
  }
});

// Narrates a public-domain book from Project Gutenberg, the same way as an uploaded TXT file.
app.post('/api/books/import', async (request, reply) => {
  try {
    ensureClaudeConfiguration();
    ensureConfiguration();
    const input = z.object({
      gutenbergId: z.number().int().positive(),
      title: z.string().trim().min(1).max(300),
      author: z.string().trim().max(300).optional(),
      characterVoices: z.boolean().default(true),
    }).parse(request.body);
    const book = await gutenbergBook(input.gutenbergId);
    if (wordCount(book.text) < 10) return reply.code(400).send({ error: 'That book had no readable text.' });
    app.log.info({ gutenbergId: input.gutenbergId, chapterCount: book.chapters.length, wordCount: wordCount(book.text) }, 'Catalog book downloaded');
    const jobId = startBook({ who: await requester(request), fileName: `gutenberg-${input.gutenbergId}.txt`, buffer: book.buffer, book, characterVoices: input.characterVoices, title: input.title, author: input.author });
    return reply.code(202).send({ jobId, status: 'processing', stage: 'Queued', chapterCount: book.chapters.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not import that book.';
    app.log.error({ error, message }, 'Catalog import failed');
    return reply.code(400).send({ error: message });
  }
});

// A book's job state, if the requester made the book. Books made before job state existed have none.
async function ownedJob(jobId: string, who: Requester) {
  if (!isBookId(jobId)) return undefined;
  const state = waitingBooks.get(jobId) ?? await loadJob(jobId);
  return state && isOwner({ userId: state.userId, account: state.signedIn }, who) ? state : undefined;
}

app.get('/api/books/jobs/:jobId', async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  const who = await requester(request);
  let job = bookJobs.get(jobId);
  // After a restart the job isn't in memory; its saved state still answers.
  if (!job) {
    const state = await ownedJob(jobId, who);
    if (state) {
      publishJob(state, { stage: state.status === 'done' ? 'Complete' : state.status === 'error' ? 'Failed' : awaitingCast(state) ? 'Review the cast' : 'Waiting to resume' });
      job = bookJobs.get(jobId);
    }
  }
  if (!job || !isOwner({ userId: job.userId, account: job.account }, who)) return reply.code(404).send({ error: 'Book job not found.' });
  return { jobId, status: job.status, stage: job.stage, updatedAt: job.updatedAt, chapters: job.chapters, awaitingCast: job.awaitingCast, cast: job.cast, result: job.result, error: job.error };
});

// The cast and the voice each member is read with.
app.get('/api/books/:jobId/cast', async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  const state = await ownedJob(jobId, await requester(request));
  if (!state) return reply.code(404).send({ error: 'Book not found.' });
  return { cast: state.castReady ? castOf(state) : [], awaitingCast: awaitingCast(state), characterVoices: state.characterVoices, narrating: running.has(jobId) };
});

// Changes who reads which part. Each entry gives a character one of the reader's studio voices, or (designed: true)
// the voice Gemini made for them. On a book waiting for approval, `start` begins narration with the cast as it stands.
// On a narrated book, every chapter the changed voices speak in is narrated again.
const castChangeSchema = z.object({
  voices: z.record(z.string().min(1), z.union([z.object({ narratorId: z.string().min(1) }), z.object({ designed: z.literal(true) })])).default({}),
  start: z.boolean().default(false),
});

app.put('/api/books/:jobId/cast', async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  const who = await requester(request);
  const state = await ownedJob(jobId, who);
  if (!state) return reply.code(404).send({ error: 'Book not found.' });
  if (running.has(jobId)) return reply.code(409).send({ error: 'This book is being narrated. Wait for it to finish, then change its voices.' });
  if (!state.castReady) return reply.code(409).send({ error: 'The cast isn\u2019t ready yet.' });
  const input = castChangeSchema.parse(request.body);
  const store = await readNarratorStore();
  const changed = new Set<string>();
  for (const [name, choice] of Object.entries(input.voices)) {
    if (!state.roster?.characters.some((character) => character.name === name)) return reply.code(400).send({ error: `${name} isn\u2019t in this book\u2019s cast.` });
    let next: VoiceRef | undefined;
    if ('narratorId' in choice) {
      const voice = store.voices.find((item) => item.id === choice.narratorId && canUseNarrator(item, who));
      if (!voice) return reply.code(404).send({ error: 'That voice isn\u2019t in your studio.' });
      next = studioVoiceRef(voice);
    } else {
      if (name === 'Narrator') return reply.code(400).send({ error: 'The narrator needs one of your studio voices.' });
      next = designedVoiceOf(state, name);
    }
    const current = state.voices[name];
    // Swapping an old book's character away from its designed voice is the moment to remember that voice.
    if (current && !current.source && name !== 'Narrator') (state.designedVoices ??= {})[name] = { ...current, source: 'designed' };
    if ((current?.referenceKey ?? '') === (next?.referenceKey ?? '')) continue;
    if (next) state.voices[name] = next;
    else delete state.voices[name];
    changed.add(name);
    if (state.signedIn) {
      const record = name === 'Narrator'
        ? setNarratorSample(jobId, { voiceId: next!.voiceId, path: next!.samplePath })
        : setCharacterVoice(jobId, name, next ? { voiceId: next.voiceId, samplePath: next.samplePath, voiceName: next.label } : { voiceId: state.voices.Narrator?.voiceId, samplePath: state.voices.Narrator?.samplePath, voiceName: state.voices.Narrator?.label });
      await record.catch((error: unknown) => app.log.warn({ error, jobId, name }, 'Voice change not recorded in Supabase'));
    }
  }
  const waiting = awaitingCast(state);
  if (!waiting && changed.size) {
    // Chapters the changed voices speak in go back in the queue. A new narrator touches every chapter: narration,
    // and any character who has no voice of their own.
    const everything = changed.has('Narrator');
    for (const chapter of state.chapters) {
      const spoken = state.segments[chapter.index]?.some((segment) => changed.has(segment.speaker)) ?? true;
      if (!everything && !spoken) continue;
      Object.assign(chapter, { status: 'queued', audioKey: undefined, durationMs: undefined, error: undefined });
      delete state.narrated[chapter.index];
      if (state.signedIn) await setChapterStatus(jobId, chapter.index, 'queued').catch(() => {});
    }
  }
  if (waiting && input.start) state.castApproved = true;
  await putBytes(jobStateKey(jobId), JSON.stringify(state));
  app.log.info({ jobId, changed: [...changed], start: input.start }, waiting ? 'Cast reviewed' : 'Cast changed');
  const startNow = (waiting && input.start) || (!waiting && changed.size > 0);
  if (startNow) {
    publishJob(state, { stage: 'Queued', result: undefined });
    void runBook(state);
  } else {
    publishJob(state, { stage: waiting ? 'Review the cast' : state.status === 'done' ? 'Complete' : 'Failed' });
  }
  return { cast: castOf(state), awaitingCast: awaitingCast(state), narrating: startNow, changed: [...changed] };
});

// Retries every chapter that failed or never ran, reusing the cast, voices and Claude's splits.
app.post('/api/books/:jobId/retry', async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  const who = await requester(request);
  const state = await ownedJob(jobId, who);
  if (!state) return reply.code(isBookId(jobId) && (await bookOwnerOf(jobId)) ? 409 : 404).send({ error: 'This book was made before retrying was possible, or it isn’t yours.' });
  if (running.has(jobId)) return reply.code(409).send({ error: 'This book is already being narrated.' });
  const retried = state.chapters.filter((chapter) => chapter.status !== 'ready');
  if (!retried.length && state.castReady) return reply.code(409).send({ error: 'Every chapter is already narrated.' });
  // A retry from a book still waiting on its cast means "go ahead with these voices".
  if (awaitingCast(state)) state.castApproved = true;
  for (const chapter of retried) {
    Object.assign(chapter, { status: 'queued', error: undefined });
    if (state.signedIn) await setChapterStatus(jobId, chapter.index, 'queued').catch(() => {});
  }
  publishJob(state, { stage: 'Queued', result: undefined });
  void runBook(state);
  return reply.code(202).send({ jobId, status: 'processing', retried: retried.length });
});

// Narrates the whole book again with the listener's currently selected narrator. Character voices are kept.
app.post('/api/books/:jobId/renarrate', async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  const who = await requester(request);
  const state = await ownedJob(jobId, who);
  if (!state) return reply.code(isBookId(jobId) && (await bookOwnerOf(jobId)) ? 409 : 404).send({ error: 'This book was made before re-narrating was possible, or it isn’t yours.' });
  if (running.has(jobId)) return reply.code(409).send({ error: 'This book is already being narrated.' });
  if (!state.castReady) return reply.code(409).send({ error: 'This book hasn’t finished its first narration yet. Retry it instead.' });
  try {
    state.voices.Narrator = await narratorVoiceRef(who);
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : 'No narrator voice is available.' });
  }
  for (const chapter of state.chapters) Object.assign(chapter, { status: 'queued', audioKey: undefined, durationMs: undefined, error: undefined });
  state.narrated = {};
  if (state.signedIn) {
    await setNarratorSample(jobId, { voiceId: state.voices.Narrator.voiceId, path: state.voices.Narrator.samplePath }).catch(() => {});
    await setBookChapters(jobId, state.chapters.map(({ index, title, text }) => ({ index, title, wordCount: wordCount(text) }))).catch(() => {});
  }
  publishJob(state, { stage: 'Queued', result: undefined });
  void runBook(state);
  return reply.code(202).send({ jobId, status: 'processing' });
});

// Removes a book: its stored files, its job state, and (soft-deleted) its Supabase row. Narration in progress stops.
app.delete('/api/books/:jobId', async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  const who = await requester(request);
  const owner = isBookId(jobId) ? await bookOwnerOf(jobId) : undefined;
  if (!owner || !isOwner(owner, who)) return reply.code(404).send({ error: 'Book not found.' });
  if (running.has(jobId)) cancelled.add(jobId);
  await deletePrefix(`${bookFolder(jobId)}/`);
  await deletePrefix(activeMarkerFolder(jobId)).catch(() => {});
  await setBookDeleted(jobId).catch((error: unknown) => app.log.warn({ error, jobId }, 'Could not mark the book deleted in Supabase'));
  bookJobs.delete(jobId);
  waitingBooks.delete(jobId);
  ownerCache.delete(jobId);
  app.log.info({ jobId }, 'Book removed');
  return { jobId, removed: true };
});

const timelineCache = new Map<string, TimelineEntry[]>();

// Who speaks when in a chapter's audio, for the player's "is speaking" line.
app.get('/api/books/:jobId/chapters/:index/timeline', async (request, reply) => {
  const { jobId, index } = request.params as { jobId: string; index: string };
  if (!isBookId(jobId) || !/^\d+$/.test(index)) return reply.code(404).send({ error: 'Not found.' });
  if (!(await canReadBook(request, jobId))) return reply.code(403).send({ error: 'This book isn’t yours.' });
  const cacheKey = `${jobId}:${index}`;
  if (!timelineCache.has(cacheKey)) timelineCache.set(cacheKey, (await loadJob(jobId))?.narrated[index]?.timeline ?? []);
  return { timeline: timelineCache.get(cacheKey) };
});

app.get('/api/narrators', async (request) => narratorState(await requester(request)));

app.post('/api/narrators', async (request, reply) => {
  const who = await requester(request);
  const userId = who.id;
  try {
    ensureConfiguration();
    const input = narratorRequestSchema.parse(request.body);
    if (UNSAFE_VOICE_TERMS.test(input.description)) {
      return reply.code(400).send({ error: 'Narrator voices must be adults. Describe the sound instead (e.g. "light, bright, high-pitched young adult voice") without words like child, kid, boy, girl, or teen.' });
    }
    const inFlight = narratorCreationsInFlight.get(userId) ?? 0;
    const { remainingToday } = narratorQuota(await readNarratorStore(), userId);
    if (remainingToday - inFlight <= 0) {
      return reply.code(429).send({ error: `You can create ${NARRATOR_DAILY_LIMIT} narrator voices per day. Try again tomorrow.`, ...await narratorState(who) });
    }
    narratorCreationsInFlight.set(userId, inFlight + 1);
    try {
      app.log.info({ userId }, 'Creating narrator voice');
      const narrator = await createNarratorVoice(who, input);
      app.log.info({ userId, voiceId: narrator.id }, 'Narrator voice created');
      return { voice: publicNarrator(narrator), ...await narratorState(who) };
    } finally {
      narratorCreationsInFlight.set(userId, (narratorCreationsInFlight.get(userId) ?? 1) - 1);
    }
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join('; ') : error instanceof Error ? error.message : 'Narrator creation failed.';
    app.log.error({ error, userId }, 'Narrator creation failed');
    return reply.code(400).send({ error: message });
  }
});

// A recording of a voice to clone. Fields come before the file: name, and consent ("true": the reader made the recording
// or has the speaker's permission), then the audio under `audio`.
app.post('/api/narrators/upload', async (request, reply) => {
  const who = await requester(request);
  try {
    const upload = await request.file({ limits: { fileSize: UPLOAD_MAX_BYTES } });
    if (!upload) return reply.code(400).send({ error: 'Attach a recording in the audio field.' });
    const field = (name: string) => {
      const value = upload.fields[name] as { value?: unknown } | undefined;
      return value && 'value' in value ? String(value.value) : '';
    };
    const name = field('name').trim().slice(0, 40) || 'My voice';
    if (field('consent') !== 'true') return reply.code(400).send({ error: 'Confirm that this is your own recording, or that the speaker agreed to it being cloned.' });
    const { uploadsRemainingToday } = narratorQuota(await readNarratorStore(), who.id);
    if (uploadsRemainingToday <= 0) return reply.code(429).send({ error: `You can upload ${UPLOAD_DAILY_LIMIT} recordings a day. Try again tomorrow.`, ...await narratorState(who) });
    const buffer = await upload.toBuffer();
    if (upload.file.truncated) return reply.code(400).send({ error: `Recordings can be up to ${UPLOAD_MAX_BYTES / 1024 / 1024} MB.` });
    app.log.info({ userId: who.id, fileName: upload.filename, bytes: buffer.length }, 'Cloning an uploaded voice');
    const narrator = await createUploadedVoice(who, { name, fileName: upload.filename, buffer });
    return { voice: publicNarrator(narrator), ...await narratorState(who) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The recording could not be used.';
    app.log.error({ error, userId: who.id }, 'Voice upload failed');
    return reply.code(400).send({ error: message });
  }
});

// Removes a voice that no book reads with. A book keeps pointing at its voices' recordings, so a voice in use stays.
app.delete('/api/narrators/:voiceId', async (request, reply) => {
  const { voiceId } = request.params as { voiceId: string };
  const who = await requester(request);
  const voice = (await readNarratorStore()).voices.find((item) => item.id === voiceId && canUseNarrator(item, who));
  if (!voice) return reply.code(404).send({ error: 'Voice not found.' });
  if (voice.previewPending) return reply.code(409).send({ error: 'This voice is still being prepared. Try again in a minute.' });
  const books = (await voiceUsage(who, [voice])).get(voiceId) ?? [];
  const narratingNow = [...running.values(), ...waitingBooks.values()].some((state) => Object.values(state.voices).some((ref) => ref.referenceKey === voice.referenceKey));
  if (books.length || narratingNow) return reply.code(409).send({ error: `${voice.name} is used by ${books.length ? books.map((book) => book.title).join(', ') : 'a book being narrated'}. Give those parts another voice first.` });
  await updateNarratorStore((store) => {
    store.voices = store.voices.filter((item) => item.id !== voiceId);
    for (const [user, selected] of Object.entries(store.selected)) if (selected === voiceId) delete store.selected[user];
  });
  await deletePrefix(`narrators/${voice.userId}/${voice.id.replace(/[^a-zA-Z0-9_-]/g, '_')}/`).catch((error: unknown) => app.log.warn({ error, voiceId }, 'Voice files not removed'));
  if (who.signedIn) await deleteNarratorVoice(voiceId).catch((error: unknown) => app.log.warn({ error, voiceId }, 'Voice row not removed from Supabase'));
  app.log.info({ voiceId, userId: who.id }, 'Voice removed');
  return narratorState(who);
});

app.put('/api/narrators/selected', async (request, reply) => {
  const who = await requester(request);
  const { voiceId } = z.object({ voiceId: z.string().min(1) }).parse(request.body);
  const voice = await updateNarratorStore((store) => {
    const match = store.voices.find((item) => canUseNarrator(item, who) && item.id === voiceId);
    if (match) store.selected[who.id] = voiceId;
    return match;
  });
  if (!voice) return reply.code(404).send({ error: 'Narrator voice not found.' });
  // Test narrators belong to the mock user, who has no Supabase row, so only the user's own are recorded.
  if (who.signedIn && voice.userId === who.id) {
    await setSelectedNarrator(who.id, voiceId).catch((error: unknown) => app.log.warn({ error, voiceId }, 'Narrator selection not recorded in Supabase'));
  }
  return narratorState(who);
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

// Stored audio is played from a short-lived signed S3 link (S3 handles the range requests), or streamed from disk
// when the server runs without a bucket. The stable server URL lets a player come back after a link expires.
async function sendStoredAudio(request: { headers: Record<string, string | string[] | undefined> }, reply: FastifyReply, key: string) {
  const source = await playbackSource(key);
  if (!source) return reply.code(404).send({ error: 'Audio not found.' });
  if ('url' in source) return reply.header('cache-control', 'no-store').redirect(source.url, 302);
  return sendAudioFile(request, reply, source.filePath);
}

// A voice's preview, for its owner. The app plays previews through /api/media/url (players can't send the sign-in
// headers on every platform); this route stays for tools that can.
app.get('/api/narrators/:voiceId/audio', async (request, reply) => {
  const { voiceId } = request.params as { voiceId: string };
  const voice = (await readNarratorStore()).voices.find((item) => item.id === voiceId);
  if (!voice || !canUseNarrator(voice, await requester(request))) return reply.code(404).send({ error: 'Narrator voice not found.' });
  return sendStoredAudio(request, reply, voice.previewKey);
});

// A book, its audio, its job and its controls (retry, re-narrate, remove) are only for the person who made it, or a
// short-lived signed link the server handed them (/api/media/url). Narrator previews and Voice Lab samples aren't
// book data and stay open. Owners come from Supabase, else the book's job state, else an older book's manifest; a
// book with none of those is closed to everyone.
const MEDIA_SECRET = randomBytes(32);
const MEDIA_LINK_MS = 6 * 60 * 60 * 1000;
const signMedia = (key: string, expires: number) => createHmac('sha256', MEDIA_SECRET).update(`${key}:${expires}`).digest('hex').slice(0, 32);

// account: the book was made by a signed-in account. Those open only for that account's sign-in, checked with
// Supabase, because the x-echo-user header alone can be set to anyone's id. Books made without signing in belong to
// the test id the app sends (the same on every copy of the app), so they're a test-mode convenience, not private.
type BookOwner = { userId: string; account: boolean };
const ownerCache = new Map<string, { owner: BookOwner | undefined; until: number }>();

function isOwner(owner: BookOwner, who: Requester) {
  return owner.account ? who.signedIn && who.id === owner.userId : who.id === owner.userId || who.testId === owner.userId;
}

async function bookOwnerOf(bookId: string): Promise<BookOwner | undefined> {
  const hit = ownerCache.get(bookId);
  if (hit && hit.until > Date.now()) return hit.owner;
  let owner: BookOwner | undefined;
  const accountId = await getBookOwner(bookId).catch(() => undefined);
  if (accountId) owner = { userId: accountId, account: true };
  if (!owner) {
    const state = await loadJob(bookId);
    if (state) owner = { userId: state.userId, account: state.signedIn };
  }
  if (!owner) {
    const manifest = await readText(`${bookFolder(bookId)}/manifest.json`).catch(() => undefined);
    const userId = manifest ? (JSON.parse(manifest) as { userId?: string }).userId : undefined;
    if (userId) owner = { userId, account: false };
  }
  ownerCache.set(bookId, { owner, until: Date.now() + 5 * 60 * 1000 });
  return owner;
}

async function canReadBook(request: { headers: Record<string, string | string[] | undefined> }, bookId: string) {
  const owner = await bookOwnerOf(bookId);
  return Boolean(owner && isOwner(owner, await requester(request)));
}

// Book audio is the book owner's; a voice's clips are its owner's; Voice Lab samples are open.
async function canReadFile(request: { headers: Record<string, string | string[] | undefined>; query: unknown }, key: string) {
  const bookId = key.match(/^books\/([0-9a-f-]{36})\//i)?.[1];
  const narratorFile = key.startsWith('narrators/');
  if (!bookId && !narratorFile) return true;
  const { expires, sig } = (request.query ?? {}) as { expires?: string; sig?: string };
  if (sig && expires && Number(expires) > Date.now() && sig === signMedia(key, Number(expires))) return true;
  if (bookId) return canReadBook(request, bookId);
  const voice = (await readNarratorStore()).voices.find((item) => item.previewKey === key || item.referenceKey === key);
  return Boolean(voice && canUseNarrator(voice, await requester(request)));
}

// Plays a path stored in a Supabase row (chapters.audio_s3_url, characters.voice_sample_path,
// narrator_voices.preview_path). Only listening files are served; uploaded books and cloning references are not.
const PLAYABLE_PATH = /^(books\/[0-9a-f-]{36}\/(audio\.mp3|chapters\/\d{3}\.mp3|voices\/[\w-]+\.wav)|narrators\/[\w-]+\/[\w-]+\/preview\.wav|voice-lab\/[\w-]+\.wav)$/i;
app.get('/api/files/*', async (request, reply) => {
  const key = (request.params as { '*': string })['*'];
  if (!PLAYABLE_PATH.test(key)) return reply.code(404).send({ error: 'File not found.' });
  if (!(await canReadFile(request, key))) return reply.code(403).send({ error: 'That audio isn\u2019t yours.' });
  return sendStoredAudio(request, reply, key);
});

// A playable link for a stored path, checked against the app's sign-in. Audio elements can't send headers on every
// platform, so the app asks here first and plays the link: a signed S3 link, or a signed /api/files link on disk.
app.get('/api/media/url', async (request, reply) => {
  const { path: key } = z.object({ path: z.string().min(1) }).parse(request.query);
  if (!PLAYABLE_PATH.test(key)) return reply.code(404).send({ error: 'File not found.' });
  if (!(await canReadFile(request, key))) return reply.code(403).send({ error: 'That audio isn\u2019t yours.' });
  const source = await playbackSource(key);
  if (!source) return reply.code(404).send({ error: 'File not found.' });
  if ('url' in source) return { url: source.url };
  const expires = Date.now() + MEDIA_LINK_MS;
  return { url: `${request.protocol}://${request.headers.host}/api/files/${key}?expires=${expires}&sig=${signMedia(key, expires)}` };
});

app.get('/api/books/:jobId/audio', async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  if (!isBookId(jobId)) return reply.code(404).send({ error: 'Audio not found.' });
  if (!(await canReadBook(request, jobId))) return reply.code(403).send({ error: 'This book isn\u2019t yours.' });
  return sendStoredAudio(request, reply, `${bookFolder(jobId)}/audio.mp3`);
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
    await putFile(`voice-lab/${path.basename(referencePath)}`, referencePath);
    app.log.info({ voiceId: voice.id, referencePath }, 'Gemini voice reference created');
    app.log.info({ voiceId: voice.id }, 'Starting IndexTTS narration');
    const outputPath = await runIndexTts(referencePath, input.text, input.emotion).finally(() => rm(referencePath, { force: true }));
    app.log.info({ voiceId: voice.id, outputPath }, 'IndexTTS narration created');
    return { voiceId: voice.id, referencePath, outputPath, mimeType: 'audio/wav', audioUrl: `/api/voice/audio/${path.basename(outputPath)}` };
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join('; ') : error instanceof Error ? error.message : 'Voice generation failed.';
    app.log.error({ error }, 'Voice generation failed');
    return reply.code(400).send({ error: message });
  }
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
      // Skips the S3 download cache and any in-progress segment folders.
      if (stats.isFile() && stats.mtimeMs < cutoffTime) {
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

// --- Local voice playground (optional dev tool) -------------------------------------------
// Registers /api/playground/* only when server/playground/routes.ts exists on this machine; that
// folder is excluded from git, so this block does nothing elsewhere. Safe to delete with the folder.
const PLAYGROUND_ROUTES = path.join(SERVER_ROOT, 'playground', 'routes.ts');
if (await access(PLAYGROUND_ROUTES).then(() => true, () => false)) {
  const { registerPlayground } = await import(pathToFileURL(PLAYGROUND_ROUTES).href);
  await registerPlayground(app, { postJson, runIndexTts, speakWithVoice, runProcess, sendAudioFile, ensureConfiguration, shapeDialogueEmotion, capNarratorEmotion, dialogueSpeechText, EMOTIONS, FFMPEG });
}
// --- End local voice playground -----------------------------------------------------------

// Books this machine was narrating when it stopped carry on; books whose server went quiet are marked failed.
async function resumeInterruptedBooks() {
  const markers = (await listKeys('jobs/active/')).filter(({ key }) => key.endsWith('/marker.json'));
  for (const { key } of markers) {
    const jobId = key.split('/')[2];
    const marker = JSON.parse((await readText(key)) ?? '{}') as { server?: string };
    if (marker.server !== SERVER_NAME) continue;
    const state = await loadJob(jobId);
    if (!state) {
      await deletePrefix(activeMarkerFolder(jobId)).catch(() => {});
      continue;
    }
    for (const chapter of state.chapters) if (chapter.status === 'processing') chapter.status = 'queued';
    app.log.info({ jobId, title: state.title }, 'Resuming a book interrupted by a restart');
    publishJob(state, { stage: 'Resuming' });
    void runBook(state);
  }
}

// Whether another server sharing the bucket is still narrating a book: its marker's heartbeat is recent. (A quiet
// Supabase row alone isn't proof, because that server's database writes can fail while narration carries on.)
async function aliveElsewhere(jobId: string) {
  const text = await readText(`${activeMarkerFolder(jobId)}marker.json`).catch(() => undefined);
  if (!text) return false;
  const marker = JSON.parse(text) as { server?: string; beatAt?: string };
  return marker.server !== SERVER_NAME && Boolean(marker.beatAt) && Date.now() - Date.parse(marker.beatAt!) < STALE_MINUTES * 60_000;
}

// Only books this pipeline made (they have saved job state) are swept: the database is shared with seed and test rows
// that sit in other states on purpose.
async function sweepStaleBooks() {
  try {
    const ours = [];
    for (const id of await getStaleBookIds(STALE_MINUTES)) if (!running.has(id) && (await loadJob(id)) && !(await aliveElsewhere(id))) ours.push(id);
    await failInterruptedBooks(ours);
    if (ours.length) app.log.warn({ ids: ours }, 'Marked interrupted books as failed');
  } catch (error) {
    app.log.warn({ error }, 'Stale book sweep failed');
  }
}

// Local files left behind by a crash or an older version of the server. Everything here is either already in storage
// (downloaded copies, voice references, finished audio) or a line of audio a retry could reuse, kept for a week.
const LEFTOVER_LINE_AUDIO_DAYS = 7;
async function clearLeftovers() {
  // Another server on this computer narrating right now is using these files.
  if (workerLockHolder()) return;
  await clearLocalCopies();
  const cutoff = Date.now() - LEFTOVER_LINE_AUDIO_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const file of await readdir(MODEL_OUTPUTS)) {
    const filePath = path.join(MODEL_OUTPUTS, file);
    const info = await stat(filePath).catch(() => undefined);
    if (info?.isFile() && (file.includes('.tmp.') || info.mtimeMs < cutoff)) {
      await rm(filePath, { force: true });
      removed += 1;
    }
  }
  // Loose files in server/tmp from before storage moved to S3 go once their stored copy is confirmed: a book's audio,
  // its WAV master and manifest (books/<id>/), a character voice (books/*/voices/), a Voice Lab voice (voice-lab/).
  // Anything without a confirmed copy (logs, test files) stays.
  if (storageMode !== 'local disk') {
    const stored = new Set([...(await listKeys('books/')), ...(await listKeys('voice-lab/'))].map(({ key }) => key));
    const storedVoices = new Set([...stored].filter((key) => key.includes('/voices/')).map((key) => path.basename(key)));
    const copyOf = (file: string) => {
      const book = /^([0-9a-f-]{36})\.(mp3|wav|json)$/i.exec(file);
      if (book) return stored.has(`books/${book[1]}/${book[2] === 'json' ? 'manifest.json' : 'audio.mp3'}`) || stored.has(`books/${book[1]}/job.json`);
      if (/^char-voice_[\w-]+\.wav$/.test(file)) return storedVoices.has(file.slice('char-'.length));
      if (/^voice_[\w-]+\.wav$/.test(file)) return stored.has(`voice-lab/${file}`);
      return false;
    };
    for (const file of await readdir(TMP_ROOT)) {
      const filePath = path.join(TMP_ROOT, file);
      const info = await stat(filePath).catch(() => undefined);
      if (info?.isFile() && copyOf(file)) {
        await rm(filePath, { force: true });
        removed += 1;
      }
    }
  }
  if (removed) app.log.info({ removed }, 'Cleared leftover local files');
}

app.listen({ port: PORT, host: HOST }).then(async () => {
  console.log(`Echo voice server listening at http://127.0.0.1:${PORT}`);
  await clearLeftovers().catch((error: unknown) => app.log.warn({ error }, 'Could not clear leftover local files'));
  await resumeInterruptedBooks().catch((error: unknown) => app.log.error({ error }, 'Could not resume interrupted books'));
  await sweepStaleBooks();
  setInterval(() => void sweepStaleBooks(), 10 * 60_000).unref();
  console.log(`  Storage: ${storageMode}`);
  console.log(`  Supabase records: ${dbMode}`);
  if (HOST === '0.0.0.0') {
    const lanAddresses = Object.values(networkInterfaces()).flat().filter((item) => item?.family === 'IPv4' && !item.internal).map((item) => item!.address);
    for (const address of lanAddresses) console.log(`  On your network: http://${address}:${PORT}`);
  }
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
