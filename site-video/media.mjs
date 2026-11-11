// ffmpeg inputs and size for a scene's media: a still image or a screen recording.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const VIDEO = /\.(mp4|webm|mov|mkv)$/i;

export function resolveMedia(root, scene) {
  const file = path.resolve(root, scene.media);
  if (!existsSync(file)) throw new Error(`Scene "${scene.title}": media not found: ${scene.media}`);
  const isVideo = VIDEO.test(file);
  const [width, height] = execFileSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  ).trim().split(',').map(Number);

  const inputArgs = isVideo
    ? ['-ss', String(scene.start ?? 0), '-i', file]
    : ['-loop', '1', '-t', String(scene.duration), '-i', file];
  // Speed a recording up; stills need nothing.
  const prep = isVideo ? `setpts=PTS/${scene.speed ?? 1},` : '';
  return { file, width, height, inputArgs, prep };
}

/** Height after scaling to `targetWidth`, rounded to an even number like ffmpeg's scale=W:-2. */
export function scaledHeight(media, targetWidth) {
  return Math.round((media.height * targetWidth) / media.width / 2) * 2;
}
