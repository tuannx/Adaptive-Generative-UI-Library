# Bundle report: what AGUL adds to a host page

Measured on 2026-10-28 with `npm run build && npm run bundle-report`.
esbuild, minified, ESM, browser target. `react` and `react-dom` are external because a host such as Next.js already ships them; everything else (antd, react-router-dom, swr, axios, dayjs) is counted.

| Import | Minified (KB) | Gzip (KB) |
|---|---:|---:|
| @agul/core (parse + plan, no React) | 16.2 | 6.1 |
| @agul/react AGULRenderer (antd included) | 1349.6 | 436.0 |
| antd Form + Input baseline | 327.5 | 109.1 |

## What it means

- `AGULRenderer` adds about 436 KB gzip. That is fine for an internal admin app, too heavy for a public landing page that has to load fast on mobile.
- `@agul/core` is about 6 KB gzip. A host can read the spec and plan the UI with core, then draw it with its own components.
- So a public page should use a headless entry (core plus React hooks, no antd) and keep the full renderer for admin screens.

## Caveats

- esbuild tree-shaking approximates Next.js/webpack; real numbers can differ by a few percent.
- Numbers change with antd and dependency versions. Re-run the script before relying on them.
