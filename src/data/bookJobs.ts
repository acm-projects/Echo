import type { DocumentPickerAsset } from 'expo-document-picker';

import { USER_IDS } from '../mock/users';
import { VOICE_SERVER_URL } from './voiceServer';

export type BookJob = {
  jobId: string;
  status: 'processing' | 'done' | 'error';
  stage: string;
  result?: { roster?: Array<{ name: string }> };
  error?: string;
};

const POLL_INTERVAL_MS = 3000;

async function readJson<T>(response: Response) {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Voice server request failed with ${response.status}.`);
  return data;
}

// Starts a book job and polls until it finishes, reporting each stage change.
export async function processBook(file: DocumentPickerAsset, onStage: (stage: string) => void) {
  const form = new FormData();
  // Web passes the File object; native passes a { uri, name, type } descriptor.
  if (file.file) {
    form.append('book', file.file, file.name);
  } else {
    form.append('book', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
  }
  const headers = { 'x-echo-user': USER_IDS.current };
  let job = await readJson<BookJob>(await fetch(`${VOICE_SERVER_URL}/api/books/process`, { method: 'POST', body: form, headers }));
  onStage(job.stage);
  while (job.status === 'processing') {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      job = await readJson<BookJob>(await fetch(`${VOICE_SERVER_URL}/api/books/jobs/${job.jobId}`, { headers }));
      onStage(job.stage);
    } catch (error) {
      // A dropped poll (app backgrounded, brief network loss) is retried; the job keeps running on the server.
      if (error instanceof Error && /not found/i.test(error.message)) throw error;
    }
  }
  if (job.status === 'error') throw new Error(job.error ?? 'Book processing failed.');
  return job;
}
