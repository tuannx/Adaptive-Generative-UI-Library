# Landing-page tour video

`npm run video:render` builds `site/assets/agul-tour.mp4` (about 30 s, 1600×900) and its poster
`site/assets/agul-tour-poster.webp` with ffmpeg only. No browser and no Remotion are needed.

- **Scenes** live in `scenes.mjs`: a title, five spec → screen pairs, a numbers scene and an end card.
  Each pair shows a real excerpt of a demo spec on the left and what AGUL renders on the right.
- **Screens** are the screenshots in `site/assets/`. To get real motion, record the demo
  (for example with Playwright's `recordVideo`) and point a scene's `media` at the `.webm`/`.mp4`;
  `start` and `speed` pick the part and the fast-forward rate.
- **Fonts** are found with `fc-match` (Inter Display, Inter, DejaVu Sans Mono). Override with
  `AGUL_VIDEO_FONT_DISPLAY`, `AGUL_VIDEO_FONT_SANS` and `AGUL_VIDEO_FONT_MONO` (paths to font files).
- `node site-video/render.mjs --keep` keeps the per-scene clips for inspection.

Files: `theme.mjs` (size, colours, layout), `draw.mjs` (ffmpeg text and box filters), `media.mjs`
(image or recording input), `scene-common.mjs` / `scene-pair.mjs` / `scene-text.mjs` (one scene type each),
`join.mjs` (cross-fades), `render.mjs` (entry point).
