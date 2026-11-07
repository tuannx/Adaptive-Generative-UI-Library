import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const packages = [
  { dir: 'packages/core', name: '@aikitstudio/agul-core' },
  { dir: 'packages/react', name: '@aikitstudio/agul-react' },
  { dir: 'packages/mcp', name: '@aikitstudio/agul-mcp' },
];

function run(cmd, cwd = root) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim();
}

console.log('Building publishable packages...');
run('npm run build --workspace=@aikitstudio/agul-core --workspace=@aikitstudio/agul-react --workspace=@aikitstudio/agul-mcp');

const packDir = mkdtempSync(join(tmpdir(), 'agul-pack-verify-'));

try {
  for (const { dir, name } of packages) {
    const pkgDir = join(root, dir);
    const tgzName = run(`npm pack --pack-destination "${packDir}"`, pkgDir);
    const tgzPath = join(packDir, tgzName);
    const listing = run(`tar -tzf "${tgzPath}"`);

    const required = [
      'package/package.json',
      'package/dist/index.js',
      'package/dist/index.d.ts',
    ];

    for (const file of required) {
      if (!listing.split('\n').includes(file)) {
        console.error(`Missing ${file} in ${name} tarball`);
        process.exit(1);
      }
    }

    const pkgJson = JSON.parse(run('cat package.json', pkgDir));
    if (pkgJson.private) {
      console.error(`${name} is still marked private`);
      process.exit(1);
    }
    if (pkgJson.publishConfig?.access !== 'public') {
      console.error(`${name} missing publishConfig.access: public`);
      process.exit(1);
    }

    console.log(`✓ ${name} pack verified (${tgzName})`);
  }

  console.log('Building validate-consumer...');
  run('npm run build --workspace=@aikitstudio/agul-validate-consumer');
  console.log('✓ validate-consumer build succeeded');
} finally {
  rmSync(packDir, { recursive: true, force: true });
}

console.log('All pack verifications passed');
