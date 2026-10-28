#!/usr/bin/env node
/**
 * Builds the GitHub Pages site into pages-dist/: the landing page (site/) at the root and the demo at demo/,
 * with a service worker that mocks the sample APIs (no server on Pages). Run `npm run build` first.
 *
 *   PAGES_BASE=/<repo>/ node scripts/build-pages.mjs
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'pages-dist');
const base = process.env.PAGES_BASE ?? '/Adaptive-Generative-UI-Library/';
const demoBase = `${base.replace(/\/?$/, '/')}demo/`;
const demoDir = path.join(root, 'apps/demo');
const vite = path.join(root, 'node_modules/.bin/vite');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const run = (args, env = {}) => execFileSync(vite, args, { cwd: demoDir, stdio: 'inherit', env: { ...process.env, ...env } });
run(['build', '--mode', 'pages', '--base', demoBase, '--outDir', path.join(out, 'demo'), '--emptyOutDir']);
run(['build', '-c', 'vite.sw.config.ts'], { AGUL_SW_OUT_DIR: path.join(out, 'demo') });

cpSync(path.join(root, 'site'), out, { recursive: true });
// GitHub Pages serves 404.html for unknown paths: hand deep links like /demo/tickets/T-1001 to the demo app
copyFileSync(path.join(out, 'demo/index.html'), path.join(out, '404.html'));
writeFileSync(path.join(out, '.nojekyll'), '');

if (!existsSync(path.join(out, 'demo/mock-sw.js'))) throw new Error('mock-sw.js missing');
console.log(`\nPages site ready in ${path.relative(root, out)}/ (demo at ${demoBase})`);
