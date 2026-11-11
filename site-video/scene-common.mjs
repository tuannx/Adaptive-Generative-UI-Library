// Parts shared by the pair and stats scenes: caption, the AGUL chip with its moving dot,
// and the rendered UI sliding in on the right with one scan sweep.
import { box, fadeIn, text } from './draw.mjs';
import { color, layout, FPS } from './theme.mjs';
import { scaledHeight } from './media.mjs';

export function caption(dir, fonts, scene) {
  return [
    text(dir, { value: scene.title, font: fonts.display, size: 46, fill: color.fg, x: 40, y: 52 }),
    text(dir, { value: scene.sub, font: fonts.sans, size: 24, fill: color.muted, x: 40, y: 114 }),
  ];
}

export function leftPanel(dir, fonts, label) {
  const { x, y, w, h } = layout.code;
  return [
    box({ x, y, w, h, fill: color.panel }),
    box({ x, y, w, h, fill: color.line, thickness: 2 }),
    text(dir, { value: label, font: fonts.mono, size: 15, fill: color.signal, x, y: y - 28 }),
  ];
}

export function chip(dir, fonts) {
  const { x, y, size } = layout.chip;
  const mid = y + size / 2;
  return [
    box({ x: layout.code.x + layout.code.w, y: mid - 1, w: layout.shot.x - layout.code.x - layout.code.w, h: 2, fill: color.line }),
    box({ x, y, w: size, h: size, fill: color.accent }),
    text(dir, { value: 'AGUL', font: fonts.display, size: 22, fill: '0xffffff', x: `${x + size / 2}-tw/2`, y: `${mid}-th/2` }),
  ];
}

/**
 * Filtergraph that puts the media (input 1) on `base` and returns the final label `[v]`.
 * The output label sits above the shot; the dot runs from the panel to the shot under `onTop`
 * (the AGUL chip); one scan sweeps the shot.
 */
export function outputSide(dir, fonts, scene, media, base, onTop) {
  const { x, y, w } = layout.shot;
  const h = scaledHeight(media, w);
  const appear = 0.9;
  const railFrom = layout.code.x + layout.code.w;
  const railLen = x - railFrom;
  const dotY = layout.chip.y + layout.chip.size / 2 - 5;
  const d = scene.duration;
  const label = text(dir, {
    value: 'OUTPUT · rendered by AGUL',
    font: fonts.mono,
    size: 15,
    fill: color.signal,
    x,
    y: y - 28,
    alpha: fadeIn(appear),
  });
  return [
    `[1:v]${media.prep}scale=${w}:${h},format=rgba,fade=t=in:st=${appear}:d=0.5:alpha=1,trim=duration=${d}[shot]`,
    `color=c=${color.signal}:s=10x10:r=${FPS}:d=${d},format=rgba[dot]`,
    `color=c=${color.accent}@0.65:s=3x${h}:r=${FPS}:d=${d},format=rgba[scan]`,
    `[${base}]${label}[lb]`,
    `[lb][shot]overlay=x=${x}:y='${y}+max(0,${appear + 0.5}-t)*30':eval=frame[s1]`,
    `[s1][dot]overlay=x='${railFrom}+mod(t*${railLen},${railLen})-5':y=${dotY}:enable='gte(t,0.4)',${onTop.join(',')}[s2]`,
    `[s2][scan]overlay=x='${x}+(t-1.6)*${Math.round(w / 1.4)}':y=${y}:enable='between(t,1.6,3.0)'[v]`,
  ];
}
