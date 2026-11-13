import type { DocumentPickerAsset } from 'expo-document-picker';

import { mediaUrl, VOICE_SERVER_URL, voiceServerHeaders } from './voiceServer';

export { VOICE_SERVER_URL };

// The reader's voices, from the voice server: ones Gemini designed from a description and ones cloned from a recording
// they uploaded. Signed-in users' voices are also recorded in Supabase's narrator_voices; the test narrators made under
// the mock user show up alongside them.

export type VoiceUse = { bookId: string; title: string; as: string[] };

export type NarratorVoice = {
  id: string;
  name: string;
  description: string;
  sampleText: string;
  createdAt: string;
  kind: 'designed' | 'uploaded';
  // Stored path of the preview clip; play it through narratorPreviewUrl, which checks it's the reader's.
  previewPath: string;
  // An uploaded voice's preview is the recording itself until the model has read the sample line with it.
  previewPending: boolean;
  // Books read with this voice, and as whom ("Narrator", or a character's name). Empty when it isn't used.
  usedIn: VoiceUse[];
};

export type NarratorState = {
  voices: NarratorVoice[];
  selectedId: string | null;
  previewModel: string;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  uploadDailyLimit: number;
  uploadsToday: number;
  uploadsRemainingToday: number;
  resetsAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${VOICE_SERVER_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...await voiceServerHeaders(), ...init?.headers },
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Voice server request failed with ${response.status}.`);
  return data;
}

/** A playable link for a voice's preview, valid for hours. */
export const narratorPreviewUrl = (voice: NarratorVoice) => mediaUrl(voice.previewPath);

export function getNarrators() {
  return request<NarratorState>('/api/narrators');
}

export function createNarrator(input: { name: string; description: string; sampleText?: string }) {
  return request<NarratorState & { voice: NarratorVoice }>('/api/narrators', { method: 'POST', body: JSON.stringify(input) });
}

/** Clones a voice from a recording the reader picked. `consent`: it's their own recording, or the speaker agreed. */
export async function uploadNarrator(input: { name: string; file: DocumentPickerAsset; consent: boolean }) {
  const form = new FormData();
  // Fields go before the file: the server reads the upload as a stream and only sees fields sent ahead of it.
  form.append('name', input.name);
  form.append('consent', String(input.consent));
  if (input.file.file) form.append('audio', input.file.file, input.file.name);
  else form.append('audio', { uri: input.file.uri, name: input.file.name, type: input.file.mimeType ?? 'audio/mpeg' } as unknown as Blob);
  const response = await fetch(`${VOICE_SERVER_URL}/api/narrators/upload`, { method: 'POST', body: form, headers: await voiceServerHeaders() });
  const data = await response.json() as NarratorState & { voice: NarratorVoice; error?: string };
  if (!response.ok) throw new Error(data.error ?? `Voice server request failed with ${response.status}.`);
  return data;
}

export function selectNarrator(voiceId: string) {
  return request<NarratorState>('/api/narrators/selected', { method: 'PUT', body: JSON.stringify({ voiceId }) });
}

/** Removes a voice no book uses. The server refuses while a book still reads with it. */
export function deleteNarrator(voiceId: string) {
  return request<NarratorState>(`/api/narrators/${encodeURIComponent(voiceId)}`, { method: 'DELETE' });
}

// ---- a book's cast -----------------------------------------------------------------------------------------------

/** A member of a book's cast and the voice they're read with: one Gemini designed, or one of the reader's voices. */
export type CastMember = {
  name: string;
  gender: string;
  voiceDescription: string;
  samplePath?: string;
  source: 'designed' | 'narrator';
  narratorId?: string;
  narratorName?: string;
  // A voice was designed for them, so they can go back to it after being given one of the reader's.
  hasDesigned: boolean;
};

export type BookCast = { cast: CastMember[]; awaitingCast: boolean; characterVoices?: boolean; narrating: boolean };

/** Which of the reader's voices each character should get; `designed` goes back to the voice made for them. */
export type CastChoice = { narratorId: string } | { designed: true };

export function getBookCast(bookId: string) {
  return request<BookCast>(`/api/books/${bookId}/cast`);
}

/**
 * Applies voice choices. On a book waiting for approval, `start` begins narration; on a narrated book, the chapters the
 * changed voices speak in are narrated again.
 */
export function setBookCast(bookId: string, input: { voices: Record<string, CastChoice>; start?: boolean }) {
  return request<BookCast & { changed: string[] }>(`/api/books/${bookId}/cast`, { method: 'PUT', body: JSON.stringify(input) });
}
