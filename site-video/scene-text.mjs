// "title" and "end" scenes: centered text on the background, no media.
import { box, fadeIn, text } from './draw.mjs';
import { color, W } from './theme.mjs';

export function buildText(dir, fonts, scene) {
  const size = 84;
  const parts = [
    box({ x: W / 2 - size / 2, y: 230, w: size, h: size, fill: color.accent }),
    text(dir, { value: 'AGUL', font: fonts.display, size: 22, fill: '0xffffff', x: `${W / 2}-tw/2`, y: `${230 + size / 2}-th/2` }),
  ];
  if (scene.kind === 'end') {
    parts.push(
      text(dir, {
        value: scene.title,
        font: fonts.mono,
        size: 40,
        fill: color.fg,
        x: '(w-tw)/2',
        y: 410,
        alpha: fadeIn(0.2),
        extra: ['box=1', `boxcolor=${color.panel}`, 'boxborderw=28'],
      }),
      text(dir, { value: scene.sub, font: fonts.display, size: 40, fill: color.signal, x: '(w-tw)/2', y: 540, alpha: fadeIn(0.6) }),
    );
  } else {
    parts.push(
      text(dir, { value: scene.title, font: fonts.display, size: 88, fill: color.fg, x: '(w-tw)/2', y: 380, alpha: fadeIn(0.15, 0.5) }),
      text(dir, { value: scene.sub, font: fonts.sans, size: 30, fill: color.muted, x: '(w-tw)/2', y: 500, alpha: fadeIn(0.6) }),
    );
  }
  return `[0:v]${parts.join(',')}[v]`;
}
