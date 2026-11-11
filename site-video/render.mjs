#!/usr/bin/env node
/**
 * Renders the landing-page tour video with ffmpeg (no browser needed):
 *   node site-video/render.mjs            → site/assets/agul-tour.mp4 + agul-tour-poster.webp
 *   node site-video/render.mjs --keep     → also keeps the per-scene clips in the temp folder
 * Scenes live in scenes.mjs. Swap a scene's `media` for a screen recording to get real motion.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scenes } from './scenes.mjs';
import { FPS, H, W, color, loadFonts } from './theme.mjs';
import { resolveMedia } from './media.mjs';
import { buildPair } from './scene-pair.mjs';
import { buildText } from './scene-text.mjs';
import { joinArgs, totalDuration } from './join.mjs';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'site/assets/agul-tour.mp4');
const poster = path.join(root, 'site/assets/agul-tour-poster.webp');
const keep = process.argv.includes('--keep');
const work = mkdtempSync(path.join(tmpdir(), 'agul-video-'));
const fonts = loadFonts();

const ffmpeg = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });

function renderScene(scene, index) {
  const file = path.join(work, `scene-${String(index).padStart(2, '0')}.mp4`);
  const background = ['-f', 'lavfi', '-i', `color=c=${color.bg}:s=${W}x${H}:r=${FPS}:d=${scene.duration}`];
  let inputs = background;
  let graph;
  if (scene.kind === 'pair' || scene.kind === 'stats') {
    const media = resolveMedia(root, scene);
    inputs = [...background, ...media.inputArgs];
    graph = buildPair(work, fonts, scene, media);
  } else {
    graph = buildText(work, fonts, scene);
  }
  ffmpeg(['-y', ...inputs, '-filter_complex', graph, '-map', '[v]', '-t', String(scene.duration),
    '-r', String(FPS), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', file]);
  console.log(`scene ${index + 1}/${scenes.length}: ${scene.title}`);
  return { file, duration: scene.duration };
}

try {
  const clips = scenes.map(renderScene);
  ffmpeg(joinArgs(clips, out));
  // Poster: a frame from the first pair scene, after its UI has appeared.
  const posterAt = scenes[0].duration + 2.4;
  ffmpeg(['-y', '-ss', String(posterAt), '-i', out, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', poster]);
  const kb = (file) => `${Math.round(statSync(file).size / 1024)} KB`;
  console.log(`\n${path.relative(root, out)} (${totalDuration(clips).toFixed(1)} s, ${kb(out)})`);
  console.log(`${path.relative(root, poster)} (${kb(poster)})`);
} finally {
  if (keep) console.log(`scene clips kept in ${work}`);
  else rmSync(work, { recursive: true, force: true });
}
