import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, NoSuchKey, PutObjectCommand, S3Client, paginateListObjectsV2 } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import path from 'node:path';
import process from 'node:process';

// Everything the voice server keeps (uploaded books, finished audio, narrator and character voices) lives under one
// key space. With ECHO_S3_BUCKET set it is an S3 bucket; without it, a folder on this machine, so the server still
// runs for anyone who has no AWS access. IndexTTS and ffmpeg need real files, so S3 objects they read are pulled
// into a local cache first.

// Long enough to finish an audiobook chapter from one link; players re-request through the server after that.
const SIGNED_URL_SECONDS = 6 * 60 * 60;

let localRoot = '';
let cacheRoot = '';
let BUCKET: string | undefined;
let s3: S3Client | undefined;
export let storageMode = 'local disk';

// Settings are read here rather than at import, because the server loads .env after its imports have run.
export async function initStorage(serverRoot: string) {
  BUCKET = process.env.ECHO_S3_BUCKET?.trim() || undefined;
  const region = process.env.ECHO_S3_REGION?.trim() || process.env.AWS_REGION || 'us-east-2';
  s3 = BUCKET ? new S3Client({ region }) : undefined;
  storageMode = BUCKET ? `s3://${BUCKET} (${region})` : 'local disk';
  localRoot = path.join(serverRoot, 'data', 'objects');
  cacheRoot = path.join(serverRoot, 'tmp', 'cache');
  await mkdir(BUCKET ? cacheRoot : localRoot, { recursive: true });
}

// Keys are built from ids the server generated or validated, but this keeps a bad one from escaping the folder.
function localPath(key: string) {
  const resolved = path.resolve(localRoot, key);
  if (!resolved.startsWith(`${localRoot}${path.sep}`)) throw new Error(`Invalid storage key: ${key}`);
  return resolved;
}

function cachePath(key: string) {
  const resolved = path.resolve(cacheRoot, key);
  if (!resolved.startsWith(`${cacheRoot}${path.sep}`)) throw new Error(`Invalid storage key: ${key}`);
  return resolved;
}

export function contentTypeFor(key: string) {
  const ext = path.extname(key).toLowerCase();
  return ({ '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json', '.pdf': 'application/pdf', '.epub': 'application/epub+zip', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' } as Record<string, string>)[ext] ?? 'application/octet-stream';
}

export async function putFile(key: string, filePath: string) {
  if (!s3) {
    await mkdir(path.dirname(localPath(key)), { recursive: true });
    await copyFile(filePath, localPath(key));
    return;
  }
  const { size } = await stat(filePath);
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: createReadStream(filePath), ContentLength: size, ContentType: contentTypeFor(key) }));
}

export async function putBytes(key: string, body: Buffer | string) {
  if (!s3) {
    await mkdir(path.dirname(localPath(key)), { recursive: true });
    await writeFile(localPath(key), body);
    return;
  }
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentTypeFor(key) }));
}

/** Returns the object's text, or undefined when it doesn't exist. */
export async function readText(key: string) {
  if (!s3) return readFile(localPath(key), 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  try {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return await Body!.transformToString();
  } catch (error) {
    if (error instanceof NoSuchKey) return undefined;
    throw error;
  }
}

/** A path on this machine holding the object, for tools that only read files. Undefined when it doesn't exist. */
export async function localCopy(key: string) {
  if (!s3) return stat(localPath(key)).then(() => localPath(key), () => undefined);
  const target = cachePath(key);
  if (await stat(target).then(() => true, () => false)) return target;
  try {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    await mkdir(path.dirname(target), { recursive: true });
    // Written beside the target and renamed, so a dropped download never leaves a truncated reference behind.
    const partial = `${target}.${process.pid}.part`;
    await pipeline(Body as Readable, createWriteStream(partial));
    await rename(partial, target);
    return target;
  } catch (error) {
    if (error instanceof NoSuchKey) return undefined;
    throw error;
  }
}

/** Stores bytes and keeps them as the local copy, so a file the server just made isn't downloaded again to use it. */
export async function putBytesKeepingLocal(key: string, body: Buffer) {
  await putBytes(key, body);
  if (!s3) return localPath(key);
  const target = cachePath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
  return target;
}

/**
 * Removes local copies of stored objects once nothing needs them: each key given, and everything under each folder
 * prefix (ending in /). The objects themselves stay in S3. Without a bucket the "copy" is the only file, so nothing is
 * removed.
 */
export async function dropLocalCopies(keys: string[]) {
  if (!s3) return;
  await Promise.all(keys.map((key) => rm(cachePath(key.replace(/\/$/, '')), { recursive: true, force: true }).catch(() => {})));
}

/** Empties the whole local copy cache (at startup: anything there is a leftover, and S3 has it). */
export async function clearLocalCopies() {
  if (!s3) return;
  await rm(cacheRoot, { recursive: true, force: true });
  await mkdir(cacheRoot, { recursive: true });
}

/** Where a player should fetch the object: a signed S3 link, or the local file for the server to stream. */
export async function playbackSource(key: string): Promise<{ url: string } | { filePath: string } | undefined> {
  if (!s3) return stat(localPath(key)).then(() => ({ filePath: localPath(key) }), () => undefined);
  return { url: await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: SIGNED_URL_SECONDS }) };
}

/** Keys under a prefix with their last-modified times. */
export async function listKeys(prefix: string) {
  if (!s3) {
    const dir = localPath(prefix.replace(/\/$/, '') || '.');
    const files = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
    return Promise.all(files.filter((file) => file.isFile()).map(async (file) => {
      const full = path.join(file.parentPath, file.name);
      return { key: path.relative(localRoot, full).split(path.sep).join('/'), modified: (await stat(full)).mtimeMs };
    }));
  }
  const keys: Array<{ key: string; modified: number }> = [];
  for await (const page of paginateListObjectsV2({ client: s3 }, { Bucket: BUCKET, Prefix: prefix })) {
    for (const item of page.Contents ?? []) keys.push({ key: item.Key!, modified: item.LastModified?.getTime() ?? 0 });
  }
  return keys;
}

export async function deletePrefix(prefix: string) {
  if (!prefix.endsWith('/')) throw new Error('deletePrefix needs a folder prefix ending in /.');
  if (!s3) {
    await rm(localPath(prefix.slice(0, -1)), { recursive: true, force: true });
    await rm(cachePath(prefix.slice(0, -1)), { recursive: true, force: true }).catch(() => {});
    return;
  }
  await rm(cachePath(prefix.slice(0, -1)), { recursive: true, force: true });
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }));
    const objects = (page.Contents ?? []).map((item) => ({ Key: item.Key! }));
    if (objects.length) await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: objects, Quiet: true } }));
    token = page.NextContinuationToken;
  } while (token);
}
