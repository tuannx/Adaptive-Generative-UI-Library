// Small builders for ffmpeg filter strings. Text goes through files (textfile=) so spec excerpts with
// quotes, colons and braces need no filtergraph escaping.
import { writeFileSync } from 'node:fs';
import path from 'node:path';

let counter = 0;

/** Writes `text` to a file in `dir` and returns its path. */
export function textFile(dir, text) {
  counter += 1;
  const file = path.join(dir, `text-${counter}.txt`);
  writeFileSync(file, text);
  return file;
}

/** drawtext filter. `x`/`y` may be ffmpeg expressions (tw/th = text size). */
export function text(dir, { value, font, size, fill, x, y, enable, alpha, expand = false, extra = [] }) {
  const parts = [
    `fontfile=${font}`,
    `textfile=${textFile(dir, value)}`,
    `expansion=${expand ? 'normal' : 'none'}`,
    `fontsize=${size}`,
    `fontcolor=${fill}`,
    `x=${quote(x)}`,
    `y=${quote(y)}`,
  ];
  if (enable) parts.push(`enable=${quote(enable)}`);
  if (alpha) parts.push(`alpha=${quote(alpha)}`);
  parts.push(...extra);
  return `drawtext=${parts.join(':')}`;
}

/** Filled or outlined rectangle. */
export function box({ x, y, w, h, fill, thickness = 'fill', enable }) {
  const parts = [`x=${x}`, `y=${y}`, `w=${w}`, `h=${h}`, `color=${fill}`, `t=${thickness}`];
  if (enable) parts.push(`enable=${quote(enable)}`);
  return `drawbox=${parts.join(':')}`;
}

/** Fade-in alpha that starts at `start` and lasts `dur` seconds. */
export function fadeIn(start, dur = 0.35) {
  return `min(1,max(0,(t-${start})/${dur}))`;
}

function quote(expr) {
  const value = String(expr);
  return /[,()]/.test(value) ? `'${value}'` : value;
}
