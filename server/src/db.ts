import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import process from 'node:process';
import type { Database } from '../../lib/database.types.js';

// Setters that record where the server put things in S3 on the Supabase rows the app reads. They write with the
// service_role key, because chapters, characters, and narrator_voices are server-written by design (RLS gives users
// read access only). Without SUPABASE_SERVICE_ROLE_KEY, or for a request with no signed-in user, every setter is a
// no-op and the server keeps working off S3 alone. Paths are bucket-relative keys (see the narrator_voices migration).

let db: SupabaseClient<Database> | undefined;
export let dbMode = 'off (no SUPABASE_SERVICE_ROLE_KEY)';

// Read here rather than at import, because the server loads .env after its imports have run.
export function initDb() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return;
  db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  dbMode = `on (${new URL(url).host})`;
}

async function run<T>(what: string, query: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(`Supabase ${what} failed: ${error.message}`);
  return data;
}

// The app's access token is checked with Supabase on each new token, then remembered until it expires.
const verified = new Map<string, { userId: string; until: number }>();

/** The signed-in Supabase user behind an `Authorization: Bearer <access token>` header, or undefined. */
export async function userFromAuthorization(header: string | string[] | undefined) {
  const token = (Array.isArray(header) ? header[0] : header)?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!db || !token) return undefined;
  const hit = verified.get(token);
  if (hit && hit.until > Date.now()) return hit.userId;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return undefined;
  if (verified.size > 500) verified.clear();
  verified.set(token, { userId: data.user.id, until: Date.now() + 5 * 60 * 1000 });
  return data.user.id;
}

const SOURCE_TYPES = ['pdf', 'epub', 'txt', 'md'] as const;

// ---- books -----------------------------------------------------------------------------------------------------

export async function setBookSource(book: { id: string; userId: string; title: string; author?: string; sourcePath: string; sizeBytes: number }) {
  if (!db) return;
  const type = book.sourcePath.split('.').pop()?.toLowerCase() as (typeof SOURCE_TYPES)[number];
  await run('setBookSource', db.from('books').upsert({
    id: book.id,
    user_id: book.userId,
    title: book.title.slice(0, 500) || 'Untitled',
    ...(book.author ? { author: book.author.slice(0, 300) } : {}),
    source_file_path: book.sourcePath,
    source_file_type: SOURCE_TYPES.includes(type) ? type : 'txt',
    source_file_size_bytes: book.sizeBytes,
    status: 'processing',
    processing_started_at: new Date().toISOString(),
  }));
}

/** Waiting for the reader to approve the cast: not processing, so no server's stale sweep touches it. */
export async function setBookQueued(bookId: string) {
  if (!db) return;
  await run('setBookQueued', db.from('books').update({ status: 'queued', processing_error: null }).eq('id', bookId));
}

/** Back to processing for a retry, a resume after a restart, or a new narrator. */
export async function setBookProcessing(bookId: string) {
  if (!db) return;
  await run('setBookProcessing', db.from('books').update({ status: 'processing', processing_error: null, processing_started_at: new Date().toISOString(), deleted_at: null }).eq('id', bookId));
}

/** Bumps updated_at while a book is being narrated, so the stale-job sweep on any server leaves it alone. */
export async function touchBook(bookId: string) {
  if (!db) return;
  await run('touchBook', db.from('books').update({ status: 'processing' }).eq('id', bookId).eq('status', 'processing'));
}

/** Books in narration whose heartbeat stopped `minutes` ago (their voice server crashed or was stopped). */
export async function getStaleBookIds(minutes: number) {
  if (!db) return [];
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  const rows = await run('getStaleBookIds', db.from('books').select('id').eq('status', 'processing').not('processing_started_at', 'is', null).lt('updated_at', cutoff));
  return (rows ?? []).map((row) => row.id);
}

/** Marks interrupted books failed, with their unfinished chapters, so they don't sit on a shelf as "processing". */
export async function failInterruptedBooks(ids: string[]) {
  if (!db || !ids.length) return;
  const message = 'Narration stopped unexpectedly (the voice server was restarted or crashed). Retry to carry on.';
  await run('failInterruptedBooks', db.from('books').update({ status: 'failed', processing_error: message, processing_finished_at: new Date().toISOString() }).in('id', ids).eq('status', 'processing'));
  await run('failInterruptedBooks chapters', db.from('chapters').update({ status: 'failed', processing_error: message }).in('book_id', ids).in('status', ['queued', 'processing']));
}

export async function setBookDeleted(bookId: string) {
  if (!db) return;
  await run('setBookDeleted', db.from('books').update({ deleted_at: new Date().toISOString() }).eq('id', bookId));
}

/** The owner of a book row, or undefined when Supabase is off or the book isn't there. */
export async function getBookOwner(bookId: string) {
  if (!db) return undefined;
  const rows = await run('getBookOwner', db.from('books').select('user_id').eq('id', bookId).limit(1));
  return rows?.[0]?.user_id;
}

export async function setBookFailed(bookId: string, message: string) {
  if (!db) return;
  await run('setBookFailed', db.from('books').update({ status: 'failed', processing_error: message.slice(0, 2000), processing_finished_at: new Date().toISOString() }).eq('id', bookId));
}

/** `problem` notes chapters that couldn't be narrated; the book is still ready to listen to without them. */
export async function setBookReady(bookId: string, totals: { chapters: number; durationMs: number; modelInfo: Record<string, string>; problem?: string }) {
  if (!db) return;
  await run('setBookReady', db.from('books').update({
    status: 'ready',
    processing_error: totals.problem?.slice(0, 2000) ?? null,
    processing_finished_at: new Date().toISOString(),
    total_chapters: totals.chapters,
    total_duration_ms: totals.durationMs,
    model_info: totals.modelInfo,
  }).eq('id', bookId));
}

// ---- characters ------------------------------------------------------------------------------------------------

type CastMember = { name: string; aliases: string[]; gender: 'female' | 'male' | 'neutral'; voiceId?: string; voiceDescription: string; voiceSamplePath?: string };

/** Records the book's cast and the S3 path of each voice sample; the Narrator becomes the book's default narrator. */
export async function setBookCast(bookId: string, cast: CastMember[]) {
  if (!db || !cast.length) return;
  // Names are unique per book ignoring case (uq_characters_book_name), and a new book has no rows to conflict with.
  const unique = cast.filter((member, index) => cast.findIndex((other) => other.name.toLowerCase() === member.name.toLowerCase()) === index);
  const rows = await run('setBookCast', db.from('characters').insert(unique.map((member) => ({
    book_id: bookId,
    name: member.name.slice(0, 200),
    aliases: member.aliases,
    gender: member.gender,
    is_narrator: member.name === 'Narrator',
    voice_id: member.voiceId ?? null,
    voice_description: member.voiceDescription,
    voice_sample_path: member.voiceSamplePath ?? null,
  }))).select('id, name'));
  const narrator = rows?.find((row) => row.name === 'Narrator');
  if (narrator) await run('setBookCast narrator', db.from('books').update({ default_narrator_id: narrator.id, narration_style: 'third_person' }).eq('id', bookId));
}

/** A new narrator for a re-narrated book: the Narrator's cast row points at the new voice sample. */
export async function setNarratorSample(bookId: string, sample: { voiceId?: string; path: string }) {
  if (!db) return;
  await run('setNarratorSample', db.from('characters').update({ voice_id: sample.voiceId ?? null, voice_sample_path: sample.path }).eq('book_id', bookId).eq('is_narrator', true));
}

/** The voice a character is read with, after the reader swaps it in the cast review. */
export async function setCharacterVoice(bookId: string, name: string, voice: { voiceId?: string; samplePath?: string; voiceName?: string }) {
  if (!db) return;
  await run('setCharacterVoice', db.from('characters').update({ voice_id: voice.voiceId ?? null, voice_sample_path: voice.samplePath ?? null, voice_name: voice.voiceName ?? null }).eq('book_id', bookId).eq('name', name));
}

// ---- chapters --------------------------------------------------------------------------------------------------

/** Lists every chapter as queued before narration starts, so the app can show the whole book while it's made. */
export async function setBookChapters(bookId: string, chapters: Array<{ index: number; title: string; wordCount: number }>) {
  if (!db || !chapters.length) return;
  await run('setBookChapters', db.from('chapters').upsert(chapters.map((chapter) => ({
    book_id: bookId,
    chapter_index: chapter.index,
    title: chapter.title.slice(0, 500),
    word_count: chapter.wordCount,
    status: 'queued' as const,
  })), { onConflict: 'book_id,chapter_index' }));
  await run('setBookChapters total', db.from('books').update({ total_chapters: chapters.length }).eq('id', bookId));
}

export async function setChapterStatus(bookId: string, index: number, status: 'queued' | 'processing' | 'failed', error?: string) {
  if (!db) return;
  await run('setChapterStatus', db.from('chapters').update({ status, processing_error: error?.slice(0, 2000) ?? null }).eq('book_id', bookId).eq('chapter_index', index));
}

export async function setChapterAudio(bookId: string, chapter: { index: number; title?: string; audioPath: string; durationMs: number; sizeBytes: number; wordCount: number }) {
  if (!db) return;
  await run('setChapterAudio', db.from('chapters').upsert({
    book_id: bookId,
    chapter_index: chapter.index,
    title: chapter.title ?? null,
    word_count: chapter.wordCount,
    audio_s3_url: chapter.audioPath,
    audio_duration_ms: chapter.durationMs,
    audio_size_bytes: chapter.sizeBytes,
    audio_format: 'mp3',
    status: 'ready',
    processing_error: null,
  }, { onConflict: 'book_id,chapter_index' }));
}

// ---- narrator voices -------------------------------------------------------------------------------------------

export async function setNarratorVoice(voice: { userId: string; voiceId: string; name: string; description: string; sampleText: string; referencePath: string; previewPath: string; selected: boolean }) {
  if (!db) return;
  await run('setNarratorVoice', db.from('narrator_voices').upsert({
    user_id: voice.userId,
    voice_id: voice.voiceId,
    name: voice.name,
    description: voice.description,
    sample_text: voice.sampleText,
    reference_path: voice.referencePath,
    preview_path: voice.previewPath,
  }, { onConflict: 'voice_id' }));
  if (voice.selected) await setSelectedNarrator(voice.userId, voice.voiceId);
}

export async function setSelectedNarrator(userId: string, voiceId: string) {
  if (!db) return;
  // Cleared first: the one-selected-per-user index would reject two selected rows mid-update.
  await run('setSelectedNarrator clear', db.from('narrator_voices').update({ is_selected: false }).eq('user_id', userId).eq('is_selected', true));
  await run('setSelectedNarrator', db.from('narrator_voices').update({ is_selected: true }).eq('user_id', userId).eq('voice_id', voiceId));
}

export async function deleteNarratorVoice(voiceId: string) {
  if (!db) return;
  await run('deleteNarratorVoice', db.from('narrator_voices').delete().eq('voice_id', voiceId));
}

export type VoiceUse = { voiceId: string; bookId: string; title: string; character: string };

/** Where a user's voices are in use: every cast row of their books that points at one of their voice ids. */
export async function getVoiceUsage(userId: string, voiceIds: string[]): Promise<VoiceUse[]> {
  if (!db || !voiceIds.length) return [];
  const rows = await run('getVoiceUsage', db.from('characters')
    .select('name, voice_id, books!characters_book_id_fkey!inner(id, title, user_id, deleted_at)')
    .in('voice_id', voiceIds)
    .eq('books.user_id', userId)
    .is('books.deleted_at', null));
  return ((rows ?? []) as unknown as Array<{ name: string; voice_id: string; books: { id: string; title: string } }>)
    .map((row) => ({ voiceId: row.voice_id, bookId: row.books.id, title: row.books.title, character: row.name }));
}

/** A user's narrator rows, for picking up voices another machine's server created. */
export async function getNarratorVoices(userId: string) {
  if (!db) return [];
  return (await run('getNarratorVoices', db.from('narrator_voices').select('voice_id, name, description, sample_text, reference_path, preview_path, is_selected, created_at').eq('user_id', userId))) ?? [];
}
