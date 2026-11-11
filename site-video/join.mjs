// Joins rendered scene clips with cross-fades and encodes the final MP4 (H.264, no audio, fast start).
import { FADE } from './theme.mjs';

/** ffmpeg arguments that join `clips` ({ file, duration }) into `out`. */
export function joinArgs(clips, out) {
  const inputs = clips.flatMap((clip) => ['-i', clip.file]);
  const steps = [];
  let label = '0:v';
  let offset = 0;
  clips.slice(1).forEach((clip, i) => {
    offset += clips[i].duration - FADE;
    const next = `x${i + 1}`;
    steps.push(`[${label}][${i + 1}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[${next}]`);
    label = next;
  });
  return [
    '-y', ...inputs,
    '-filter_complex', steps.join(';'),
    '-map', `[${label}]`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an',
    out,
  ];
}

export function totalDuration(clips) {
  return clips.reduce((sum, clip) => sum + clip.duration, 0) - FADE * (clips.length - 1);
}
