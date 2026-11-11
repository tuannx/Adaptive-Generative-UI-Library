// Bundles src/view/main.ts into one self-contained HTML file (dist/view.html) for the MCP Apps view.
// Hosts load it in a sandboxed iframe with no network by default, so every byte must be inline.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// zod (pulled in by the MCP SDK) re-exports every locale as a namespace, which esbuild cannot
// tree-shake: about 260 kB of the view. The view only ever shows English errors, so point zod's
// locale index at its English locale. Cuts the gzipped view from about 113 kB to about 73 kB.
const zodEnglishOnly = {
  name: 'zod-english-only',
  setup(builder) {
    builder.onResolve({ filter: /locales\/index\.js$/ }, (args) =>
      args.importer.includes('/zod/') ? { path: require.resolve('zod/v4/locales/en.js') } : undefined,
    );
  },
};

const out = new URL('../dist/view.html', import.meta.url);
const entry = new URL('../src/view/main.ts', import.meta.url).pathname;

const { outputFiles } = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  plugins: [zodEnglishOnly],
});

// A literal "</script" inside the bundle would close the inline script tag early.
const script = outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const style = `
:root { color-scheme: light dark; font-family: var(--font-sans, system-ui, sans-serif); }
body { margin: 0; padding: 16px; background: var(--color-background-primary, Canvas); color: var(--color-text-primary, CanvasText); font-size: 14px; }
h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 14px; margin: 20px 0 8px; } h3 { font-size: 14px; margin: 0 0 8px; }
.muted { opacity: .7; } code, pre { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; }
pre { white-space: pre-wrap; padding: 8px; border-radius: 6px; background: color-mix(in srgb, currentColor 6%, transparent); }
.grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.card { border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 8px; padding: 10px; }
.row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.chip { padding: 1px 6px; border-radius: 999px; background: color-mix(in srgb, currentColor 8%, transparent); font-size: 12px; }
.chip.op { background: color-mix(in srgb, #3b82f6 22%, transparent); }
.list { padding-left: 18px; margin: 0; } table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
`;

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AGUL</title><style>${style}</style></head>
<body><main id="root"><p class="muted">Waiting for AGUL…</p></main><script>${script}</script></body>
</html>
`;

await mkdir(new URL('.', out), { recursive: true });
await writeFile(out, html);
console.log(`view.html ${(html.length / 1024).toFixed(1)} kB`);
