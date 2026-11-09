// One-time copy of what the voice server kept on local disk before storage moved to S3:
//   server/data/narrators/  -> narrators/index.json and narrators/<user>/<voice>/{reference,preview}.wav
//   server/tmp/<voice>.wav  -> voice-lab/<voice>.wav   (Voice Lab references)
//   server/tmp/<job>.mp3    -> books/<job>/audio.mp3 and manifest.json
// Run from server/: npm run migrate-storage [-- --owner <user id>]
// Narrators made before the x-echo-user header was read were all saved as "local"; --owner reassigns them
// (default: the app's mock signed-in user). Re-running is safe: voices already in the store are skipped.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
(process as typeof process & { loadEnvFile?: (file?: string) => void }).loadEnvFile?.(path.join(SERVER_ROOT, '..', '.env'));
const { initStorage, putBytes, putFile, readText, storageMode } = await import('./storage.js');

const ownerFlag = process.argv.indexOf('--owner');
const owner = ownerFlag > -1 ? process.argv[ownerFlag + 1] : '11111111-1111-4111-8111-111111111111';
if (!owner || !/^[a-zA-Z0-9_-]{1,64}$/.test(owner)) throw new Error('--owner needs a user id.');

await initStorage(SERVER_ROOT);
console.log(`Copying into ${storageMode}`);
const exists = (file: string) => stat(file).then(() => true, () => false);

type OldVoice = { id: string; userId: string; name: string; description: string; sampleText: string; createdAt: string; referencePath: string; previewPath: string };
type NewVoice = Omit<OldVoice, 'referencePath' | 'previewPath'> & { referenceKey: string; previewKey: string };

const oldStoreFile = path.join(SERVER_ROOT, 'data', 'narrators', 'narrators.json');
if (await exists(oldStoreFile)) {
  const old = JSON.parse(await readFile(oldStoreFile, 'utf8')) as { voices: OldVoice[]; selected: Record<string, string> };
  const current = JSON.parse(await readText('narrators/index.json') ?? '{"voices":[],"selected":{}}') as { voices: NewVoice[]; selected: Record<string, string> };
  const userFor = (id: string) => (id === 'local' ? owner : id);
  for (const voice of old.voices) {
    if (current.voices.some((item) => item.id === voice.id)) continue;
    if (!(await exists(voice.referencePath)) || !(await exists(voice.previewPath))) {
      console.warn(`  skipped narrator ${voice.name} (${voice.id}): audio files missing`);
      continue;
    }
    const { referencePath, previewPath, ...rest } = voice;
    const userId = userFor(voice.userId);
    const folder = `narrators/${userId}/${voice.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    await putFile(`${folder}/reference.wav`, referencePath);
    await putFile(`${folder}/preview.wav`, previewPath);
    current.voices.push({ ...rest, userId, referenceKey: `${folder}/reference.wav`, previewKey: `${folder}/preview.wav` });
    console.log(`  narrator ${voice.name} -> ${folder}/`);
  }
  for (const [user, voiceId] of Object.entries(old.selected)) current.selected[userFor(user)] ??= voiceId;
  await putBytes('narrators/index.json', JSON.stringify(current, null, 2));
}

const tmp = path.join(SERVER_ROOT, 'tmp');
const tmpFiles = await readdir(tmp).catch(() => [] as string[]);
// Oldest first, so the newest Voice Lab reference is also the newest object and stays the default narrator.
const modified = new Map(await Promise.all(tmpFiles.map(async (file) => [file, (await stat(path.join(tmp, file))).mtimeMs] as const)));
tmpFiles.sort((a, b) => modified.get(a)! - modified.get(b)!);
const JOB = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.mp3$/i;
for (const file of tmpFiles) {
  const job = JOB.exec(file)?.[1];
  if (job) {
    await putFile(`books/${job}/audio.mp3`, path.join(tmp, file));
    if (tmpFiles.includes(`${job}.json`)) await putFile(`books/${job}/manifest.json`, path.join(tmp, `${job}.json`));
    console.log(`  book ${job} -> books/${job}/`);
  } else if (/^voice_[a-zA-Z0-9_-]+\.wav$/.test(file)) {
    await putFile(`voice-lab/${file}`, path.join(tmp, file));
    console.log(`  voice lab ${file}`);
  }
}
console.log('Done. The local copies were left in place; delete server/data/narrators once the app plays from S3.');
