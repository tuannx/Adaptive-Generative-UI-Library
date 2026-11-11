// Measures what @aikitstudio/agul-* adds to a host app's client bundle (e.g. a Next.js page).
// React and react-dom are external because the host already ships them.
// Run after `npm run build`: node scripts/bundle-report.mjs [--json]
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const scenarios = [
  { id: 'core', label: '@aikitstudio/agul-core (parse + plan, no React)', code: "export { parseOpenAPI, planUi } from '@aikitstudio/agul-core';" },
  { id: 'headless', label: '@aikitstudio/agul-react/headless useAgulFlow (no antd)', code: "export { useAgulFlow } from '@aikitstudio/agul-react/headless';" },
  { id: 'renderer', label: '@aikitstudio/agul-react AGULRenderer (antd included)', code: "export { AGULRenderer } from '@aikitstudio/agul-react';" },
  { id: 'effects-motion', label: '@aikitstudio/agul-react/effects/motion (lazy chunk, motion/mini included)', code: "export { motionEffects } from '@aikitstudio/agul-react/effects/motion';" },
  { id: 'antd-form', label: 'antd Form + Input baseline', code: "export { Form, Input, Button } from 'antd';" },
];

const HOST_PROVIDED = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'];

async function measure(scenario) {
  const result = await build({
    stdin: { contents: scenario.code, resolveDir: root, loader: 'js' },
    bundle: true,
    minify: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    external: HOST_PROVIDED,
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  const bytes = result.outputFiles[0].contents;
  return { ...scenario, minKb: bytes.length / 1024, gzipKb: gzipSync(bytes).length / 1024 };
}

const rows = [];
for (const scenario of scenarios) {
  rows.push(await measure(scenario));
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows.map(({ code, ...row }) => row), null, 2));
} else {
  console.log('| Import | Minified (KB) | Gzip (KB) |');
  console.log('|---|---:|---:|');
  for (const row of rows) {
    console.log(`| ${row.label} | ${row.minKb.toFixed(1)} | ${row.gzipKb.toFixed(1)} |`);
  }
}
