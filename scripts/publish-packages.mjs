// Publishes the library packages to npm in dependency order (core, then react, then mcp).
// Names and versions come from each package.json, so the npm scope can change without editing this file.
// A version that is already on npm is skipped, so a re-run after a partial failure is safe.
//
// Usage: node scripts/publish-packages.mjs [--dry-run]
// Run `npm run build` first. In CI, npm authenticates with trusted publishing (OIDC).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ORDER = ['packages/core', 'packages/react', 'packages/mcp'];
const dryRun = process.argv.includes('--dry-run');
const root = join(import.meta.dirname, '..');

function isPublished(name, version) {
  try {
    execFileSync('npm', ['view', `${name}@${version}`, 'version'], { stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false; // npm view exits non-zero (E404) when the package or version does not exist
  }
}

for (const dir of ORDER) {
  const { name, version, private: isPrivate } = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
  if (isPrivate) throw new Error(`${name} is private and cannot be published`);
  if (isPublished(name, version)) {
    console.log(`skip ${name}@${version} (already on npm)`);
    continue;
  }
  const args = ['publish', '--workspace', dir, '--access', 'public', ...(dryRun ? ['--dry-run'] : [])];
  console.log(`${dryRun ? 'dry-run' : 'publish'} ${name}@${version}`);
  execFileSync('npm', args, { cwd: root, stdio: 'inherit' });
}
