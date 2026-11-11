// Look of the video: canvas size, colours (ffmpeg 0xRRGGBB) and fonts.
// Fonts are files on disk. Override with AGUL_VIDEO_FONT_DISPLAY / _SANS / _MONO, or let fc-match find them.
import { execFileSync } from 'node:child_process';

export const W = 1600;
export const H = 900;
export const FPS = 30;
export const FADE = 0.4; // cross-fade between scenes, seconds

export const color = {
  bg: '0x0a1220',
  panel: '0x0f1a2c',
  line: '0x22324d',
  fg: '0xe8eef8',
  muted: '0x8ea0bd',
  accent: '0x3b8bff',
  signal: '0xf5b83d',
};

// Pair layout: spec panel on the left, AGUL chip in the gap, rendered UI on the right.
export const layout = {
  code: { x: 40, y: 200, w: 500, h: 546 },
  chip: { x: 548, y: 431, size: 84 },
  shot: { x: 640, y: 200, w: 920 },
};

function findFont(envName, pattern) {
  if (process.env[envName]) return process.env[envName];
  try {
    const file = execFileSync('fc-match', ['-f', '%{file}', pattern], { encoding: 'utf8' }).trim();
    if (file) return file;
  } catch {
    // fall through to the error below
  }
  throw new Error(`No font for "${pattern}". Install it or set ${envName}=/path/to/font`);
}

export function loadFonts() {
  return {
    display: findFont('AGUL_VIDEO_FONT_DISPLAY', 'Inter Display:bold'),
    sans: findFont('AGUL_VIDEO_FONT_SANS', 'Inter'),
    mono: findFont('AGUL_VIDEO_FONT_MONO', 'DejaVu Sans Mono'),
  };
}
