# AGUL - Adaptive Generative UI Library

> **OpenAPI → React UI** for AI Agents. Monorepo with `@agul/core`, `@agul/react`, and demo app.

## Install

```bash
npm install @agul/react
```

`@agul/react` includes `@agul/core` as a dependency. Peer dependencies (install in your app):

```bash
npm install react react-dom antd @ant-design/icons axios dayjs swr react-router-dom
```

## Quick Start

```bash
npm install
npm run dev          # turbo: watch all packages + demo at :5173
npm run build        # build core → react → demo
npm run test         # vp test (Vite+ / Vitest 5)
npm run test:e2e     # Playwright demo + MCP validation
npm run verify-pack  # npm pack + validate-consumer build
npm run swarm:next   # pick next GitHub swarm task
```

## Library Usage (Agent-friendly)

```tsx
import { AGULRenderer } from '@agul/react';

<AGULRenderer specUrl="/openapi.json" baseUrl="https://api.example.com" />
```

Inside an existing router, mount it under a splat route — AGUL detects the host router and links stay under `/admin`:

```tsx
<Route path="/admin/*" element={<AGULRenderer spec={openApiJson} token={jwt} />} />
```

Or programmatic:

```ts
import { createAGULFromSpec } from '@agul/react';

const { api, resources, routes, menu } = await createAGULFromSpec(openApiJson);
```

## How It Works

`@agul/core` turns the spec into **resources** (`buildResources`): endpoints are grouped by collection path, and each
resource carries its `list` / `detail` / `create` / `update` / `remove` operations plus a fully dereferenced record schema.

| Spec | Generated page |
|------|----------------|
| `GET /pets` (array response) | list at `/pets` |
| `GET /pets/{id}` | detail at `/pets/:id`, edit form prefilled from it at `/pets/:id/edit` |
| `POST /pets` | create form at `/pets/new` |
| `PUT\|PATCH /pets/{id}` (or body-only `PUT /pets`) | submit target of the edit form |
| `DELETE /pets/{id}` | delete actions in list and detail |
| `GET /store/inventory` (object response) | key/value singleton page |

A list like `GET /pet/findByStatus` with no item endpoints of its own borrows them from its parent (`/pet/{petId}`)
when both return the same schema, which is how Swagger Petstore gets full CRUD.

Specs can be JSON or YAML. Lists nested under a path param (`/orgs/{org}/members`) appear in the menu and
ask for the param. Request bodies are sent as JSON, `x-www-form-urlencoded` or `multipart` per the spec.
See [docs/real-world-coverage.md](./docs/real-world-coverage.md) for results on 19 public APIs
(Stripe, GitHub, Twilio, Kubernetes, …) and known gaps — notably **CORS**: for APIs that can't be called
from a browser, set `baseUrl` to a same-origin proxy.

The demo accepts `?spec=<url>` (or paste a URL in the toolbar) to try any spec.

### Beyond CRUD: actions, chat, and LLM-decided layout

Every operation gets a page. Operations outside CRUD become **action** forms (result shown as a table,
record, text or live stream) or a **chat** UI (history, SSE/NDJSON streaming, session id). How each operation
is shown is decided in three layers — `x-agul-view` in the spec, then an optional decision provider
(an LLM or your own decision API), then built-in rules:

```tsx
<AGULRenderer specUrl="/openapi.json" decisionProvider={createHttpDecisionProvider({ url: '/decide' })} />
```

The Cloudflare Worker includes a `/decide` route backed by Claude (`wrangler secret put ANTHROPIC_API_KEY`).
Details, provider API and limits: [docs/ui-decisions.md](./docs/ui-decisions.md). Click **Tarot Chat** in the
demo for a worked example (CRUD + actions + streaming chat).

### Sign-in and permissions

AGUL signs users in with whatever the spec's `securitySchemes` declare — API key, Basic, Bearer, OAuth 2
(authorization code + PKCE, password, client credentials) or OpenID Connect — refreshes tokens, and asks again on a 401.
Operations whose OAuth scopes or `x-agul-roles` the user lacks disappear from menus, pages and buttons:

```tsx
<AGULRenderer specUrl="/openapi.json" auth={{ oauth: { clientId: 'admin-ui' } }} />
// or tell AGUL what the user may do:
<AGULRenderer specUrl="/openapi.json" token={jwt} authorities={['admin']} />
```

Details: [docs/auth.md](./docs/auth.md). Click **Helpdesk (secured)** in the demo to sign in as an admin, agent or viewer.

## Deploy the demo to Cloudflare

`apps/demo` ships as a Cloudflare Worker: static SPA assets plus a same-origin CORS proxy at
`/proxy/<absolute-url>` (`apps/demo/worker/`). In that build the demo routes API calls through the
proxy (toggle "Proxy / Direct" in the toolbar); the library equivalent is `<AGULRenderer proxyUrl="/proxy/" />`.

```bash
# From your machine (opens a browser to log in once):
npx wrangler login
npm run build && npm run deploy --workspace=@agul/demo
# → https://agul-demo.<your-subdomain>.workers.dev

# Local check with the real Workers runtime:
npm run build && npm run cf:dev --workspace=@agul/demo   # http://localhost:8787
```

Or from GitHub: copy `docs/github-workflows/deploy-demo.yml` to `.github/workflows/`, add repository
secrets `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers") and `CLOUDFLARE_ACCOUNT_ID`, then run
**Actions → Deploy demo (Cloudflare) → Run workflow** (it also runs on every push to `main`).

The proxy forwards only to hosts in `PROXY_ALLOWED_HOSTS` (`apps/demo/wrangler.jsonc`, or Settings →
Variables in the Cloudflare dashboard). Add your own API's host there; never set it to `*` on a public URL.

## MCP Server (Agents)

```bash
npm install @agul/mcp
# Cursor MCP config: { "command": "npx", "args": ["-y", "@agul/mcp"] }
```

Tool `generate_ui_from_openapi` — pass OpenAPI JSON, get routes, menu, React embed snippet.

## Publishing

Packages `@agul/core`, `@agul/react`, and `@agul/mcp` are versioned with [Changesets](https://github.com/changesets/changesets) and published by the `Publish` workflow with npm trusted publishing (no `NPM_TOKEN`). It runs only on a `v*` tag or a manual run. Steps, including the one-time setup, are in [docs/releasing.md](docs/releasing.md).

```bash
npm run changeset          # describe your change
npm run version-packages   # bump versions and changelogs, then commit
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

- TypeScript 7, Turbo, Vite+ (Vite 8, Vitest 5, Oxlint), Playwright
- React 19, Ant Design 6
- OpenAPI 3.0 / Swagger 2.0

## License

MIT
