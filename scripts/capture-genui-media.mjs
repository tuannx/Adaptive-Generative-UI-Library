#!/usr/bin/env node
/**
 * Screenshots and a short GIF of the generative UI demo, for the README.
 * Needs a Playwright Chromium (`npx playwright install chromium`) and ffmpeg for the GIF.
 * Run `npm run build` first.
 *
 *   npm run media:genui        # writes docs/media/genui-*.png and docs/media/genui-sick-day.gif
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const media = path.join(root, 'docs/media');
const preview = path.join(root, 'apps/demo/dist/genui-preview.html');
const viewport = { width: 1280, height: 900 };

execFileSync(process.execPath, [path.join(root, 'scripts/build-genui-preview.mjs'), preview], { stdio: 'inherit' });
mkdirSync(media, { recursive: true });
const videoDir = mkdtempSync(path.join(tmpdir(), 'agul-genui-'));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport, deviceScaleFactor: 1, recordVideo: { dir: videoDir, size: viewport } });
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: path.join(media, name), fullPage: true });

await page.goto(pathToFileURL(preview).href);
await page.getByTestId('genui-step-visit').waitFor();
await pause(800);
await shot('genui-sick-day.png');

// switch soup off, edit the team message, confirm
await page.getByTestId('genui-step-soup').locator('.ant-switch').click();
await pause(600);
await page.getByTestId('agul-action-run').click();
await page.getByTestId('genui-reply').waitFor();
await page.getByTestId('genui-reply').scrollIntoViewIfNeeded();
await pause(1200);
await shot('genui-sick-day-done.png');

await page.getByTestId('genui-scenarios').getByText('Move dinner with Priya to Friday.').click();
await page.getByTestId('agul-action-run').waitFor();
await pause(800);
await shot('genui-dinner.png');

await context.close();
await browser.close();

const [video] = readdirSync(videoDir).filter((file) => file.endsWith('.webm'));
if (video) {
  const gif = path.join(media, 'genui-sick-day.gif');
  // two-pass palette keeps the GIF small and readable
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', path.join(videoDir, video),
    '-vf', 'fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer',
    gif,
  ]);
  console.log(`${path.relative(root, gif)} written`);
}
rmSync(videoDir, { recursive: true, force: true });
console.log(`media in ${path.relative(root, media)}/`);
