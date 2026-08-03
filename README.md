# AGUL - Adaptive Generative UI Library

> **OpenAPI → React UI** for AI Agents. Monorepo with `@agul/core`, `@agul/react`, and demo app.

## Quick Start

```bash
npm install
npm run dev          # turbo: watch all packages + demo at :5173
npm run build        # build core → react → demo
npm run test         # vitest (@agul/core)
npm run swarm:next   # pick next GitHub swarm task
```

## Library Usage (Agent-friendly)

```tsx
import { AGULRenderer } from '@agul/react';

<AGULRenderer specUrl="/openapi.json" baseUrl="https://api.example.com" />
```

Or programmatic:

```ts
import { createAGULFromSpec } from '@agul/react';

const { api, routes, menu } = await createAGULFromSpec(openApiJson);
```

## Monorepo Structure

```
packages/core/   @agul/core   — parser, generator (no React)
packages/react/  @agul/react  — AGULRenderer, CRUD views
apps/demo/       @agul/demo   — Vite demo app
```

## Swarm Development

Work is tracked via GitHub Issues (`swarm` label). See [AGENTS.md](./AGENTS.md).

```bash
node scripts/swarm-bootstrap.mjs   # create roadmap issues (once)
npm run swarm:status               # view open tasks by phase
npm run swarm:next                 # next unassigned task for agents
```

Phases: `phase:0-infra` → `phase:1-library` → `phase:2-agent-api` → `phase:3-features` → `phase:4-production`

## Tech Stack

- TypeScript 7, Turbo, Vitest
- React 19, Ant Design 5, Vite 7
- OpenAPI 3.0 / Swagger 2.0

## License

MIT
