# @agul/core

## 0.2.0

### Minor Changes

- c2c140d: Sign-in and access control from the spec. `@agul/core` parses `securitySchemes` (Swagger 2.0 `securityDefinitions` too), applies document-level `security`, and `planUi(api, decisions, { grants })` leaves out operations whose OAuth scopes or `x-agul-roles` the user lacks (`canAccessEndpoint`, `grantsFromClaims`, `decodeJwt`). `<AGULRenderer>` gets a built-in sign-in for API keys, Basic, Bearer, OAuth 2 (authorization code + PKCE, implicit, password, client credentials) and OpenID Connect (discovery, refresh tokens, end-session), opens it on a 401, retries once after a token refresh, sends credentials only to the API's origin, and hides menus, pages and buttons the signed-in user may not use (`auth`, `authorities` props, `useAgulAuth()`).
- 96ac9e7: Add JSON Schema-only input path: `parseJsonSchema`, `AGULRenderer jsonSchema` prop, and MCP `generate_ui_from_json_schema` tool.
- 91e2b35: Add API-backed pagination, search, and filter query param support in ListView.
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

- 7dd0613: Fixes found while capturing E2E proof screenshots: specs whose pages all need a path param show a welcome page instead of 404; a chat message sent while a reply is still streaming explains why it was not sent; the sidebar becomes an overlay drawer on narrow screens; the HTTP decision provider names its URL in error tooltips.
- a845832: Fix Petstore CRUD routing (path params, DELETE routes), SWR cache invalidation, and add Playwright CRUD E2E coverage.
- f5cadc5: Relative URLs in `securitySchemes` (`openIdConnectUrl`, OAuth flow URLs) resolve against the spec document, like `servers`. Packages ship a README, homepage and Node engine range.
- 585699f: UX and bug fixes. Toasts and confirm dialogs now render under React 19 (antd's static `message`/`Modal.confirm` rendered nothing; AGUL now uses `App.useApp()`). API errors read the response body (`message`, `detail`, `error_description`, …) and validation errors from common shapes (`errors[]`, `errors{}`, FastAPI `detail[]`, `violations[]`) land on the matching form fields; network/CORS failures say so. Forms edit arrays of objects, validate `minLength`/`maxLength`/`pattern`/`minimum`/`maximum`/`minItems`, and ask before discarding unsaved changes. Lists remember search, filters and page when you come back from a record, debounce server search, sort columns, refresh, bulk-delete selected rows, and show a useful empty state instead of a stray button while loading. Large menus get a search box; small menus open all groups. `SchemaObject` types the JSON Schema validation keywords.
- e7997bc: Build with Vite+ 1.5.0 (`vp pack`, tsdown) instead of tsup. Same ESM entry files and externals; no API change.
