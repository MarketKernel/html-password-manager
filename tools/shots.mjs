/**
 * Screenshots of every main screen: builds, then runs the page's and the extension's
 * browser tests with `--shots`, both into the same folder (shots/ unless one is named).
 *
 *   npm run shots                  # -> shots/
 *   npm run shots -- shots/before  # -> shots/before/
 *
 * Its own script because `npm run test:browser -- --shots DIR` would hand the flag to the
 * last of the two tests only.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './load.mjs';

const dir = resolve(process.argv[2] ?? 'shots');
mkdirSync(dir, { recursive: true });

for (const args of [['build.mjs'], ['--experimental-websocket', 'tests/app.mjs', '--shots', dir], ['tests/extension.mjs', '--shots', dir]]) {
  const { status } = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (status !== 0) process.exit(status ?? 1);
}
console.log(`screenshots in ${dir}`);
