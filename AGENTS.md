# AGENTS.md — Swarm Development Guide

> Instructions for AI agents working on AGUL (Adaptive Generative UI Library)

## Mission

Transform AGUL from OpenAPI demo into a **publishable library** that AI agents use to generate dynamic React admin UIs from API specs.

## Monorepo Structure

```
packages/
  core/     @agul/core   — parser, generator, types (no React)
  react/    @agul/react  — AGULRenderer, ListView, DetailView, FormView
  mcp/      @agul/mcp    — MCP server for agents
apps/
  demo/     @agul/demo   — Vite demo app (dogfood target)
```

## Dev Commands (fast path)

```bash
npm install          # once
npm run dev          # turbo: watch core + react + demo
npm run build        # build all packages
npm run test         # vitest (@agul/core, @agul/mcp)
npm run test:e2e     # Playwright demo + MCP validation
npm run typecheck    # TS 7 strict across workspace
npm run swarm:status # open GitHub issues by phase
npm run swarm:next   # pick next unassigned swarm task
```

## Swarm Workflow

1. **Pick task**: `npm run swarm:next` or `gh issue list --label swarm`
2. **Branch**: `feat/issue-<number>-<short-slug>`
3. **Implement**: smallest safe diff, match existing conventions
4. **Verify**: `npm run build && npm run test && npm run test:e2e && npm run typecheck`
5. **PR**: `gh pr create` with `Closes #<number>` in body
6. **Autopilot**: fix CI + review comments before merge

### Ship-Validate Cycle (2-iter)

- **Iter N (ship)**: land pattern/infrastructure (e.g. library packaging)
- **Iter N+1 (validate)**: apply pattern once (e.g. fresh app imports @agul/react)

Never ship pattern N+1 until pattern N has one validation.

## Phase Roadmap

| Phase | Label | Focus |
|-------|-------|-------|
| 0 | `phase:0-infra` | Monorepo, TS7, turbo, CI |
| 1 | `phase:1-library` | npm publish, exports |
| 2 | `phase:2-agent-api` | AGULRenderer, MCP tool, JSON Schema |
| 3 | `phase:3-features` | pagination, auth, plugins |
| 4 | `phase:4-production` | E2E, docs, v1.0 |

See `.planning/SWARM_ROADMAP.md` for full backlog.

## Public API (do not break without issue)

```tsx
import { AGULRenderer, createAGULFromSpec } from '@agul/react';

<AGULRenderer spec={openApiJson} baseUrl="https://api.example.com" />
// sign-in from securitySchemes + role/scope gating (docs/auth.md)
<AGULRenderer specUrl="/openapi.json" auth={{ oauth: { clientId: 'ui' } }} authorities={['admin']} />
```

## MCP Server (for Cursor/Claude agents)

```bash
# Add to MCP config (stdio):
# { "command": "npx", "args": ["-y", "@agul/mcp"] }

# Or from monorepo after build:
node packages/mcp/dist/cli.js
```

**Tool:** `generate_ui_from_openapi`

| Param | Type | Description |
|-------|------|-------------|
| `spec` | object | OpenAPI 3.0 / Swagger 2.0 JSON |
| `baseUrl` | string? | Override API base URL |
| `previewBaseUrl` | string? | Demo URL for preview link |
| `includeOperationSummaries` | boolean? | Also return operation summaries + decision schema/instructions |
| `decisions` | array? | Your layout decisions `{ operationId, kind: crud\|action\|chat\|hidden, label?, group?, chat? }` |

Returns: routes, menu, pages (action/chat), decisions, React embed snippet, optional previewUrl.
See `docs/ui-decisions.md` for the decision layers.

Programmatic (tests):

```ts
import { generateUIFromOpenAPI } from '@agul/mcp';
const config = await generateUIFromOpenAPI(spec);
```

## Code Conventions

- TypeScript 7 strict, `verbatimModuleSyntax`
- Packages use `.js` extensions in imports
- `@agul/core` has zero React dependency
- Presentation (crud/action/chat/hidden) is decided in `packages/core/src/decisions.ts` (`planUi`); views never classify endpoints themselves
- CRUD wiring lives in `buildResources` (`packages/core/src/resources.ts`); views receive a `Resource`, never re-derive relations from paths
- Access control is decided in `planUi(api, decisions, { grants })` (`packages/core/src/security.ts`); views only check whether an operation is present
- Credentials are attached in `packages/react/src/auth/` and only to the API origin; never send them elsewhere
- Use `App.useApp()` for `message`/`modal` (antd's static helpers render nothing under React 19)
- Build API URLs with `buildApiUrl`/`joinUrl` (never `new URL(path, base)`, it drops the server base path)
- Components use Ant Design + SWR + axios
- No comments unless non-obvious business logic

## PR Rules

- One issue per PR when possible
- Link issue: `Closes #123`
- No force-push to main
- CI must be green before merge

## Agent Spawn Hints

When spawning parallel subagents:

| Agent | Scope | Package |
|-------|-------|---------|
| core-agent | parser, generator, tests | `packages/core` |
| react-agent | components, AGULRenderer | `packages/react` |
| demo-agent | demo app, examples | `apps/demo` |
| infra-agent | CI, turbo, scripts | root `.github/`, `scripts/` |

Avoid two agents editing the same package in one PR.
