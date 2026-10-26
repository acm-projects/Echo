import { USER_IDS } from '../mock/users';
import { VOICE_SERVER_URL } from './voiceServer';

export { VOICE_SERVER_URL };

// Narrator voices live on the local voice server for now, keyed by the current (mock) user.

export type NarratorVoice = {
  id: string;
  name: string;
  description: string;
  sampleText: string;
  createdAt: string;
  previewUrl: string;
};

export type NarratorState = {
  voices: NarratorVoice[];
  selectedId: string | null;
  previewModel: string;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  resetsAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${VOICE_SERVER_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-echo-user': USER_IDS.current, ...init?.headers },
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Voice server request failed with ${response.status}.`);
  return data;
}

export function narratorPreviewUri(voice: NarratorVoice) {
  return `${VOICE_SERVER_URL}${voice.previewUrl}`;
}

export function getNarrators() {
  return request<NarratorState>('/api/narrators');
}

export function createNarrator(input: { name: string; description: string; sampleText?: string }) {
  return request<NarratorState & { voice: NarratorVoice }>('/api/narrators', { method: 'POST', body: JSON.stringify(input) });
}

export function selectNarrator(voiceId: string) {
  return request<NarratorState>('/api/narrators/selected', { method: 'PUT', body: JSON.stringify({ voiceId }) });
}
