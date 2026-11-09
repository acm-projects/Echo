import type { DocumentPickerAsset } from 'expo-document-picker';

import { VOICE_SERVER_URL, voiceServerHeaders } from './voiceServer';

export type BookJobChapter = { index: number; title: string; status: 'queued' | 'processing' | 'ready' | 'failed'; durationMs?: number; error?: string };

// The job id is also the book's id in Supabase, so a finished chapter can be opened in Book Details straight away.
export type BookJob = {
  jobId: string;
  status: 'processing' | 'done' | 'error';
  stage: string;
  chapters?: BookJobChapter[];
  result?: { roster?: { characters: Array<{ name: string }> } };
  // On a finished job, notes chapters that couldn't be narrated.
  error?: string;
};

const POLL_INTERVAL_MS = 3000;

async function readJson<T>(response: Response) {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Voice server request failed with ${response.status}.`);
  return data;
}

// Starts a book job and polls until it finishes, reporting the job (stage and per-chapter progress) on every poll.
// With characterVoices off, the narrator reads the whole book, dialogue included.
export async function processBook(file: DocumentPickerAsset, onUpdate: (job: BookJob) => void, options: { characterVoices: boolean }) {
  const form = new FormData();
  // Fields go before the file: the server reads the upload as a stream and only sees fields sent ahead of it.
  form.append('characterVoices', String(options.characterVoices));
  // Web passes the File object; native passes a { uri, name, type } descriptor.
  if (file.file) {
    form.append('book', file.file, file.name);
  } else {
    form.append('book', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
  }
  const headers = await voiceServerHeaders();
  let job = await readJson<BookJob>(await fetch(`${VOICE_SERVER_URL}/api/books/process`, { method: 'POST', body: form, headers }));
  onUpdate(job);
  while (job.status === 'processing') {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      job = await readJson<BookJob>(await fetch(`${VOICE_SERVER_URL}/api/books/jobs/${job.jobId}`, { headers }));
      onUpdate(job);
    } catch (error) {
      // A dropped poll (app backgrounded, brief network loss) is retried; the job keeps running on the server.
      if (error instanceof Error && /not found/i.test(error.message)) throw error;
    }
  }
  if (job.status === 'error') throw new Error(job.error ?? 'Book processing failed.');
  return job;
}

async function bookAction<T>(method: 'POST' | 'DELETE', path: string, body?: unknown) {
  const headers = { ...(await voiceServerHeaders()), ...(body ? { 'content-type': 'application/json' } : {}) };
  return readJson<T>(await fetch(`${VOICE_SERVER_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }));
}

/** Removes a book the reader made: its audio and files on the server, and the book from their library. */
export const removeBook = (bookId: string) => bookAction<{ removed: boolean }>('DELETE', `/api/books/${bookId}`);

/** Narrates again every chapter that failed or never ran, keeping the cast, voices and Claude's scene splits. */
export const retryBook = (bookId: string) => bookAction<{ retried: number }>('POST', `/api/books/${bookId}/retry`);

/** Narrates the whole book again with the reader's currently selected narrator. */
export const renarrateBook = (bookId: string) => bookAction<{ jobId: string }>('POST', `/api/books/${bookId}/renarrate`);

/** Narrates a public-domain classic from Project Gutenberg; the returned job id is the new book's id. */
export const importClassic = (input: { gutenbergId: number; title: string; author: string; characterVoices: boolean }) =>
  bookAction<{ jobId: string; chapterCount: number }>('POST', '/api/books/import', input);
