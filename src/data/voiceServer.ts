import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { USER_IDS } from '../mock/users';

const VOICE_SERVER_PORT = 8787;

// On a phone or emulator, 127.0.0.1 is the device itself, so default to the machine running the Expo dev server.
function resolveVoiceServerUrl() {
  if (process.env.EXPO_PUBLIC_VOICE_SERVER_URL) return process.env.EXPO_PUBLIC_VOICE_SERVER_URL.replace(/\/$/, '');
  if (Platform.OS === 'web') {
    const host = typeof window === 'undefined' ? '127.0.0.1' : window.location.hostname;
    return `http://${host}:${VOICE_SERVER_PORT}`;
  }
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost) return `http://${devHost}:${VOICE_SERVER_PORT}`;
  // The Android emulator reaches the host machine through 10.0.2.2.
  return `http://${Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1'}:${VOICE_SERVER_PORT}`;
}

export const VOICE_SERVER_URL = resolveVoiceServerUrl();

// Who the voice server is working for: the mock user's id, plus the Supabase session when someone is signed in,
// which lets the server record what it makes on that user's Supabase rows.
export async function voiceServerHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'x-echo-user': USER_IDS.current };
  try {
    const { supabase } = await import('../../lib/supabase');
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
  } catch {
    // No session storage outside the app (e.g. scripts); the mock user still works.
  }
  return headers;
}

/**
 * A playable URL for an S3 path stored in Supabase (chapters.audio_s3_url, characters.voice_sample_path,
 * narrator_voices.preview_path). The server swaps it for a signed S3 link. Mock paths like "mock/audio/..."
 * have no file behind them and return null.
 */
export function storedFileUrl(path: string | null | undefined) {
  if (!path || path.startsWith('mock/')) return null;
  return `${VOICE_SERVER_URL}/api/files/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * A playable link for a stored book path, checked against the signed-in reader on the server. Audio elements can't
 * send the sign-in headers on every platform, so the app asks for a signed link (valid for hours) right before
 * playing. Mock paths have no file behind them and give null.
 */
export async function mediaUrl(path: string | null | undefined) {
  if (!path || path.startsWith('mock/')) return null;
  const response = await fetch(`${VOICE_SERVER_URL}/api/media/url?path=${encodeURIComponent(path)}`, { headers: await voiceServerHeaders() });
  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error ?? `Could not open that audio (${response.status}).`);
  return data.url;
}
