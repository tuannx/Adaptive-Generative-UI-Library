# AGUL Swarm Roadmap

Work tracked via GitHub Issues (`swarm` label). Bootstrap with:

```bash
node scripts/swarm-bootstrap.mjs
npm run swarm:status
```

## Phase 0 — Infra ✅ (this PR)

- [x] npm workspaces monorepo
- [x] TypeScript 7
- [x] turbo pipeline
- [x] vitest for @ai-kit/agul-core
- [x] GitHub Actions CI
- [x] AGENTS.md + swarm scripts
- [x] AGULRenderer public API

## Phase 1 — Library

- [ ] npm publish @ai-kit/agul-core, @ai-kit/agul-react
- [ ] Changesets release workflow
- [ ] API documentation (typedoc or similar)

## Phase 2 — Agent API

- [ ] MCP tool `generate_ui_from_openapi`
- [ ] JSON Schema-only input (no full OpenAPI)
- [ ] Streaming partial UI updates from LLM

## Phase 3 — Features

- [ ] API-backed pagination/search/filter
- [ ] JWT/Bearer auth interceptor
- [ ] File upload fields
- [ ] Nested object editing

## Phase 4 — Production

- [ ] Plugin system for custom renderers
- [ ] Playwright E2E in CI
- [ ] 80%+ test coverage on core
- [ ] v1.0 release

## Metrics

| Metric | Current | Target v1.0 |
|--------|---------|-------------|
| npm installable | ❌ | ✅ |
| Agent 1-liner embed | ✅ AGULRenderer | ✅ |
| Unit tests | ~6 | 50+ |
| OpenAPI edge cases | ~50% | 90% |
