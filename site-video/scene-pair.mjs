// "pair" scene: a spec excerpt types in on the left, the rendered UI appears on the right.
// "stats" scene: the same right side, with counters on the left instead of code.
import { text, fadeIn } from './draw.mjs';
import { color, layout } from './theme.mjs';
import { caption, chip, leftPanel, outputSide } from './scene-common.mjs';

const LINE = 34;

function codeLines(dir, fonts, code) {
  const { x, y } = layout.code;
  return code
    .filter((line) => line.t !== '')
    .map((line) => {
      const row = code.indexOf(line);
      const at = (0.15 + row * 0.06).toFixed(2);
      return text(dir, {
        value: line.t,
        font: fonts.mono,
        size: 21,
        fill: line.hl ? color.signal : color.fg,
        x: x + 20,
        y: y + 34 + row * LINE,
        enable: `gte(t,${at})`,
      });
    });
}

function counters(dir, fonts, stats) {
  const { x, y } = layout.code;
  return stats.flatMap((stat, i) => {
    const top = y + 40 + i * 170;
    const from = (0.3 + i * 0.35).toFixed(2);
    const until = (Number(from) + 1.1).toFixed(2);
    const counting = `%{eif:min(${stat.value},trunc(${stat.value}*max(0,(t-${from})/1.1))):d}`;
    return [
      text(dir, { value: counting, expand: true, font: fonts.display, size: 72, fill: color.accent, x: x + 24, y: top, enable: `lt(t,${until})` }),
      text(dir, { value: stat.shown ?? String(stat.value), font: fonts.display, size: 72, fill: color.accent, x: x + 24, y: top, enable: `gte(t,${until})` }),
      text(dir, { value: stat.label, font: fonts.sans, size: 24, fill: color.muted, x: x + 26, y: top + 86, alpha: fadeIn(from) }),
    ];
  });
}

export function buildPair(dir, fonts, scene, media) {
  const left = scene.kind === 'stats'
    ? [...leftPanel(dir, fonts, 'MEASURED · docs/real-world-coverage.md'), ...counters(dir, fonts, scene.stats)]
    : [...leftPanel(dir, fonts, `INPUT · ${scene.file}`), ...codeLines(dir, fonts, scene.code)];
  const base = [...caption(dir, fonts, scene), ...left].join(',');
  return [`[0:v]${base}[base]`, ...outputSide(dir, fonts, scene, media, 'base', chip(dir, fonts))].join(';');
}
