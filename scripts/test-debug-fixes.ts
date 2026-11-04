import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// Regression checks for the Expo 58 upgrade and related fixes:
//   - shared components live in src/components (not src/app, where Expo Router treats them as routes)
//   - every relative import still resolves after the move
//   - screens using expo-audio are wrapped in ClientOnly so web static rendering doesn't crash
//   - expo packages are all on the same SDK major
//   - the project typechecks
// Run with: node scripts/test-debug-fixes.ts [--server] [--export]
//   --server  also hit the running voice server's /health endpoint
//   --export  also run a full web export (slow; proves static rendering works end to end)

const ROOT = path.resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return SOURCE_EXTENSIONS.includes(path.extname(full)) ? [full] : [];
  });
}

const rel = (file: string) => path.relative(ROOT, file);

function resolvesTo(fromFile: string, specifier: string) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, ...SOURCE_EXTENSIONS.map((ext) => base + ext), ...SOURCE_EXTENSIONS.map((ext) => path.join(base, 'index' + ext))];
  return candidates.some((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function testComponentsMovedOutOfApp() {
  console.log('Testing components live outside src/app...');

  assert.ok(!existsSync(path.join(ROOT, 'src/app/components')), 'src/app/components should not exist; Expo Router would treat its files as routes');

  const expected = ['BookCard', 'CastCard', 'ContinueCard', 'FormField', 'GradientButton', 'MiniPlayer', 'ProgressBar', 'Screen'];
  for (const name of expected) {
    assert.ok(existsSync(path.join(ROOT, 'src/components', `${name}.tsx`)), `Missing src/components/${name}.tsx`);
  }

  console.log('Components location passed.');
}

function testRelativeImportsResolve() {
  console.log('Testing relative imports resolve...');

  const files = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'lib'))];
  const importPattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
  const broken: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const [, specifier] of source.matchAll(importPattern)) {
      if (!resolvesTo(file, specifier)) broken.push(`${rel(file)} -> ${specifier}`);
    }
  }

  assert.deepEqual(broken, [], `Unresolved imports:\n  ${broken.join('\n  ')}`);

  console.log(`Relative imports passed (${files.length} files).`);
}

function testAudioScreensAreClientOnly() {
  console.log('Testing expo-audio screens are wrapped in ClientOnly...');

  const routes = walk(path.join(ROOT, 'src/app')).filter((file) => !path.basename(file).startsWith('_'));
  const audioRoutes = routes.filter((file) => /from\s+['"]expo-audio['"]/.test(readFileSync(file, 'utf8')));
  assert.ok(audioRoutes.length > 0, 'Expected at least one route using expo-audio');

  for (const file of audioRoutes) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /import\s*\{\s*ClientOnly\s*\}\s*from\s*['"][^'"]*lib\/ClientOnly['"]/, `${rel(file)} must import ClientOnly`);

    const defaultExport = source.match(/export default function (\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(defaultExport, `${rel(file)} must have a default exported function component`);
    assert.match(defaultExport[2], /<ClientOnly>/, `${rel(file)}: default export ${defaultExport[1]} must render inside <ClientOnly>`);
    assert.doesNotMatch(defaultExport[2], /useAudioPlayer/, `${rel(file)}: audio hooks must not run in the default export (it renders on the server)`);
  }

  console.log(`ClientOnly wrapping passed (${audioRoutes.map(rel).join(', ')}).`);
}

function testExpoVersionsAligned() {
  console.log('Testing expo package versions are aligned...');

  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
  const major = (version: string) => Number(version.replace(/^[~^]/, '').split('.')[0]);

  const sdk = major(deps.expo);
  const expoPackages = Object.keys(deps).filter((name) => name.startsWith('expo-') || name === '@expo/ui');
  const mismatched = expoPackages.filter((name) => major(deps[name]) !== sdk).map((name) => `${name}@${deps[name]}`);
  assert.deepEqual(mismatched, [], `Expected all expo packages on SDK ${sdk}`);

  assert.equal(deps.react, deps['react-dom'], 'react and react-dom versions must match');

  // The installed version is what actually runs; catch a package.json edit without a reinstall.
  const installed = JSON.parse(readFileSync(path.join(ROOT, 'node_modules/expo/package.json'), 'utf8')).version;
  assert.equal(major(installed), sdk, `node_modules has expo ${installed}; run npm install`);

  console.log(`Expo versions passed (SDK ${sdk}, ${expoPackages.length} packages).`);
}

function run(label: string, command: string, commandArgs: string[]) {
  const result = spawnSync(command, commandArgs, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  assert.equal(result.status, 0, `${label} failed:\n${output.split('\n').slice(-30).join('\n')}`);
}

function testTypecheck() {
  console.log('Testing typecheck...');
  run('tsc --noEmit', path.join(ROOT, 'node_modules/.bin/tsc'), ['--noEmit', '-p', '.']);
  console.log('Typecheck passed.');
}

async function testVoiceServerHealth() {
  console.log('Testing voice server /health...');

  const url = `${process.env.EXPO_PUBLIC_VOICE_SERVER_URL ?? 'http://127.0.0.1:8787'}/health`;
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  } catch (error) {
    throw new Error(`Voice server not reachable at ${url}; start it with: cd server && npm run dev`, { cause: error });
  }
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);

  console.log('Voice server health passed.');
}

function testWebExport() {
  console.log('Testing web export (this takes a while)...');
  const outputDir = path.join('server', 'tmp', 'web-export-test');
  run('expo export --platform web', path.join(ROOT, 'node_modules/.bin/expo'), ['export', '--platform', 'web', '--output-dir', outputDir]);
  assert.ok(existsSync(path.join(ROOT, outputDir, 'index.html')), 'Web export produced no index.html');
  console.log('Web export passed.');
}

async function main() {
  testComponentsMovedOutOfApp();
  testRelativeImportsResolve();
  testAudioScreensAreClientOnly();
  testExpoVersionsAligned();
  testTypecheck();
  if (args.has('--server')) await testVoiceServerHealth();
  if (args.has('--export')) testWebExport();

  console.log('All debug-fix tests passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
