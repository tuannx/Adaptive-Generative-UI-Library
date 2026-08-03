# AGUL - Adaptive Generative UI Library

> **OpenAPI → React UI** for AI Agents. Monorepo with `@agul/core`, `@agul/react`, and demo app.

## Install

```bash
npm install @agul/react
```

`@agul/react` includes `@agul/core` as a dependency. Peer dependencies (install in your app):

```bash
npm install react react-dom antd axios swr react-router-dom
```

## Quick Start

```bash
npm install
npm run dev          # turbo: watch all packages + demo at :5173
npm run build        # build core → react → demo
npm run test         # vitest (@agul/core, @agul/mcp)
npm run test:e2e     # Playwright demo + MCP validation
npm run verify-pack  # npm pack + validate-consumer build
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

## MCP Server (Agents)

```bash
npm install @agul/mcp
# Cursor MCP config: { "command": "npx", "args": ["-y", "@agul/mcp"] }
```

Tool `generate_ui_from_openapi` — pass OpenAPI JSON, get routes, menu, React embed snippet.

## Publishing

Packages `@agul/core`, `@agul/react`, and `@agul/mcp` are versioned with [Changesets](https://github.com/changesets/changesets). The release workflow opens a version PR and publishes to npm when merged (requires `NPM_TOKEN` secret).

```bash
npm run changeset          # describe your change
npm run version-packages   # bump versions (usually via CI)
npm run verify-pack        # verify tarballs before publish
```

## Monorepo Structure

```
packages/core/   @agul/core   — parser, generator (no React)
packages/react/  @agul/react  — AGULRenderer, CRUD views
packages/mcp/    @agul/mcp    — MCP server for agents
apps/demo/       @agul/demo   — Vite demo app
apps/validate-consumer/      — ship-validate: workspace import smoke test
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

- TypeScript 7, Turbo, Vitest, Playwright
- React 19, Ant Design 5, Vite 7
- OpenAPI 3.0 / Swagger 2.0

## License

MIT
