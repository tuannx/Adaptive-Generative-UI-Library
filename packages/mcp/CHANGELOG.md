# @agul/mcp

## 0.2.0

### Minor Changes

- 6492c36: Add @agul/mcp MCP server with generate_ui_from_openapi tool, Playwright E2E suite, and restore Petstore example spec.
- 96ac9e7: Add JSON Schema-only input path: `parseJsonSchema`, `AGULRenderer jsonSchema` prop, and MCP `generate_ui_from_json_schema` tool.
- 40a032e: Generalise beyond Petstore, measured on 19 public specs (full-CRUD resources 162 → 519, see docs/real-world-coverage.md).

  - core: bounded, memoised `$ref` inlining (Stripe no longer runs out of memory); resolve `$ref`s to components/responses, parameters, requestBodies and path items; Swagger 2.0 `formData` → request body; group trailing-slash and `.json`-suffixed paths; detect list envelopes generically (`ResourceOperation.rowsPath`); update via item `POST`; pick the object variant of `oneOf` bodies; `ResourceOperation.contentType`; menu entries for nested lists carry `params`.
  - react: YAML specs (`parseSpecText`, js-yaml loaded on demand); menu asks for path params of nested lists; bodies encoded per content type (`encodeBody`); list rows read via `rowsPath`; list revalidation scoped to path params.
  - mcp: `resources[].params`.

- 5a88a8b: Introduce a resource model (`buildResources`, `buildMenu`, `dereferenceSchema`) as the single source of CRUD wiring.

  - core: fix API URLs dropping the server base path (`/v2`) on delete; deep `$ref`/`allOf` resolution; server variables; path-level parameters; Swagger 2.0 path-level `parameters` no longer parsed as an HTTP method; `ParsedAPI.title`/`version`; `parseOpenAPISync`.
  - react: `ListView`/`DetailView`/`FormView` now take a `resource` prop (breaking for direct users of the views). Edit pages are deep-linkable and use the spec's PUT/PATCH method; nested objects render as fieldsets; date fields round-trip correctly; columns come from the schema; list totals read `X-Total-Count`.
  - react: `AGULRenderer` parses inline specs synchronously, no longer re-runs on new `onReady`/`onError` identities, works inside a host router (`<Route path="/admin/*">`), accepts `basename`, scopes auth per instance, and resolves relative `servers[].url` against `specUrl`. `@ant-design/icons` and `dayjs` are now declared peer dependencies.
  - mcp: output includes API title/version and a `resources` summary; install snippet lists all peers.

- ac4bc46: Every operation now gets a page: CRUD, **action** (form → result or live stream) or **chat** (conversation UI with SSE/NDJSON streaming), or is hidden.

  - core: `planUi`, `heuristicDecisions`, `resolveDecisions`, `mergeDecisions`, `summarizeOperations`, `UiDecisionProvider`; providers `createHttpDecisionProvider`, `createLlmDecisionProvider`, `withDecisionCache`; `DECISION_JSON_SCHEMA` / `DECISION_SYSTEM_PROMPT`; `x-agul-view` / `x-agul-chat` / `x-agul-stream` spec extensions. Chat detection (incl. OpenAI-style `messages[]`), POSTs that don't return the record they create become actions, undocumented standalone GETs (`/user/logout`) become actions instead of list pages. `generateRoutes` follows the plan and includes action/chat routes.
  - react: `ActionView`, `ChatView`, `ResultView`, `readStream`; `AGULRenderer` props `decisionProvider`, `cacheDecisions`, `onDecisions`; header shows layout source; menu opens the current page's group; schema `default`s prefill forms; lists refetch after an action.
  - mcp: `includeOperationSummaries` and `decisions` inputs; output adds `pages`, `decisions`, `decisionInput`.

### Patch Changes

- f73a44d: Move to zod 4 (fixes the high-severity memory advisory in zod 3). Tool inputs and their JSON schema stay the same.
- f5cadc5: Relative URLs in `securitySchemes` (`openIdConnectUrl`, OAuth flow URLs) resolve against the spec document, like `servers`. Packages ship a README, homepage and Node engine range.
- e7997bc: Build with Vite+ 1.5.0 (`vp pack`, tsdown) instead of tsup. Same ESM entry files and externals; no API change.
- Updated dependencies [c2c140d]
- Updated dependencies [7dd0613]
- Updated dependencies [96ac9e7]
- Updated dependencies [91e2b35]
- Updated dependencies [a845832]
- Updated dependencies [f5cadc5]
- Updated dependencies [40a032e]
- Updated dependencies [5a88a8b]
- Updated dependencies [ac4bc46]
- Updated dependencies [585699f]
- Updated dependencies [e7997bc]
  - @agul/core@0.2.0
