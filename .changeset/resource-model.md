---
"@ai-kit/agul-core": minor
"@ai-kit/agul-react": minor
"@ai-kit/agul-mcp": minor
---

Introduce a resource model (`buildResources`, `buildMenu`, `dereferenceSchema`) as the single source of CRUD wiring.

- core: fix API URLs dropping the server base path (`/v2`) on delete; deep `$ref`/`allOf` resolution; server variables; path-level parameters; Swagger 2.0 path-level `parameters` no longer parsed as an HTTP method; `ParsedAPI.title`/`version`; `parseOpenAPISync`.
- react: `ListView`/`DetailView`/`FormView` now take a `resource` prop (breaking for direct users of the views). Edit pages are deep-linkable and use the spec's PUT/PATCH method; nested objects render as fieldsets; date fields round-trip correctly; columns come from the schema; list totals read `X-Total-Count`.
- react: `AGULRenderer` parses inline specs synchronously, no longer re-runs on new `onReady`/`onError` identities, works inside a host router (`<Route path="/admin/*">`), accepts `basename`, scopes auth per instance, and resolves relative `servers[].url` against `specUrl`. `@ant-design/icons` and `dayjs` are now declared peer dependencies.
- mcp: output includes API title/version and a `resources` summary; install snippet lists all peers.
