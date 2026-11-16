
import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { VOICE_SERVER_URL, voiceServerHeaders } from './voiceServer';
import { File } from 'expo-file-system';

type CoverResponse = {
  cover_image_path?: string;
  error?: string;
};

async function readResponse(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as CoverResponse;

  if (!response.ok) {
    throw new Error(data.error ?? 'Could not update the cover.');
  }

  if (!data.cover_image_path) {
    throw new Error('The server did not return a cover path.');
  }

  return data.cover_image_path;
}

export async function uploadBookCover(
  bookId: string,
  asset: ImagePickerAsset
): Promise<string> {
  const mimeType =
    asset.mimeType ??
    (asset.uri.toLowerCase().split('?')[0].endsWith('.png')
      ? 'image/png'
      : asset.uri.toLowerCase().split('?')[0].endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg');

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  }

  if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 5 MB.');
  }

  const extension =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : 'jpg';

  const form = new FormData();

  if (Platform.OS === 'web') {
    const file: Blob = asset.file
        ? asset.file
        : await fetch(asset.uri).then((response) => response.blob());

    form.append('cover', file, `cover.${extension}`);
  } else {
    const file = new File(asset.uri);
    form.append('cover', file, `cover.${extension}`);
  }

  const response = await fetch(
    `${VOICE_SERVER_URL}/api/books/${encodeURIComponent(bookId)}/cover`,
    {
      method: 'POST',
      headers: await voiceServerHeaders(),
      body: form,
    }
  );

  return readResponse(response);
}

export async function restoreBookCover(bookId: string): Promise<string> {
  const response = await fetch(
    `${VOICE_SERVER_URL}/api/books/${encodeURIComponent(bookId)}/cover/restore`,
    {
      method: 'POST',
      headers: await voiceServerHeaders(),
    }
  );

  return readResponse(response);
}
