#!/usr/bin/env node
/**
 * Bundles the generative UI demo (apps/demo/genui.html) into ONE self-contained HTML file,
 * for sharing as a static preview. Run `npm run build` first (the demo imports the built packages).
 *
 *   node scripts/build-genui-preview.mjs [out.html]   # default apps/demo/dist/genui-preview.html
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(process.argv[2] ?? path.join(root, 'apps/demo/dist/genui-preview.html'));

const result = await build({
  entryPoints: [path.join(root, 'apps/demo/src/genui/main.tsx')],
  absWorkingDir: path.join(root, 'apps/demo'),
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  write: false,
  outdir: 'out',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});

const pick = (ext) => result.outputFiles.filter((file) => file.path.endsWith(ext)).map((file) => file.text).join('\n');
// keep "</script>" inside the bundle from closing the inline tag
const js = pick('.js').replaceAll('</script', '<\\/script');
const css = pick('.css');
const page = readFileSync(path.join(root, 'apps/demo/genui.html'), 'utf8')
  .replace(/\s*<link rel="icon"[^>]*>/, '')
  .replace(/<script type="module" src="[^"]+"><\/script>/, () => `<script type="module">${js}</script>`)
  .replace('</head>', () => `<style>body{margin:0;background:#fff}${css}</style>\n  </head>`);

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`${path.relative(root, out)}: ${(page.length / 1024).toFixed(0)} KB`);
