import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { File } from 'expo-file-system';
import { VOICE_SERVER_URL, mediaUrl, voiceServerHeaders } from './voiceServer';

// Profile pictures live in storage (avatars/<user>/...) with the path in users.avatar_url, uploaded through the voice
// server like custom book covers. Showing one takes a signed link, cached here so a room full of faces asks once each.

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
// Signed links last hours; refreshed well before that.
const LINK_MS = 60 * 60 * 1000;
const links = new Map<string, { url: Promise<string | null>; at: number }>();

function linkFor(path: string) {
  const cached = links.get(path);
  if (cached && Date.now() - cached.at < LINK_MS) return cached.url;
  const url = mediaUrl(path).catch(() => null);
  links.set(path, { url, at: Date.now() });
  return url;
}

/** A displayable link for a stored avatar path, or null (no picture, or it couldn't be opened). */
export function useAvatarUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (path?.startsWith('avatars/')) linkFor(path).then((next) => active && setUrl(next));
    return () => { active = false; };
  }, [path]);
  return url;
}

async function readResponse(response: Response) {
  const data = (await response.json().catch(() => ({}))) as { avatar_url?: string | null; error?: string };
  if (!response.ok) throw new Error(data.error ?? 'Could not update your picture.');
  return data.avatar_url ?? null;
}

/** Uploads a picture the reader picked as their profile picture; returns its stored path. */
export async function uploadAvatar(asset: ImagePickerAsset) {
  const lower = asset.uri.toLowerCase().split('?')[0];
  const mimeType = asset.mimeType ?? (lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
  const extension = TYPES[mimeType];
  if (!extension) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.');
  const form = new FormData();
  if (Platform.OS === 'web') form.append('avatar', asset.file ?? (await fetch(asset.uri).then((r) => r.blob())), `avatar.${extension}`);
  else form.append('avatar', new File(asset.uri) as unknown as Blob, `avatar.${extension}`);
  const response = await fetch(`${VOICE_SERVER_URL}/api/me/avatar`, { method: 'POST', headers: await voiceServerHeaders(), body: form });
  return readResponse(response);
}

export async function removeAvatar() {
  const response = await fetch(`${VOICE_SERVER_URL}/api/me/avatar`, { method: 'DELETE', headers: await voiceServerHeaders() });
  return readResponse(response);
}

export type ProfileView = {
  id: string; username: string; displayName: string | null; avatarUrl: string | null; bio: string | null;
  // Null when the person keeps their profile private (or friends-only and you aren't friends).
  stats: { books: number; listenSeconds: number; streak: number } | null;
  sharedRooms: Array<{ id: string; name: string; bookTitle: string }>;
  mutualFriends: Array<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }>;
};

/** Another reader's profile: their stats, the book rooms you're both in, and friends you have in common. */
export async function getProfile(userId: string) {
  const response = await fetch(`${VOICE_SERVER_URL}/api/users/${encodeURIComponent(userId)}/profile`, { headers: await voiceServerHeaders() });
  const data = (await response.json().catch(() => ({}))) as ProfileView & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Couldn’t open this profile (${response.status}).`);
  return data;
}
