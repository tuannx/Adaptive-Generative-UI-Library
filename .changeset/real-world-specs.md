---
"@ai-kit/agul-core": minor
"@ai-kit/agul-react": minor
"@ai-kit/agul-mcp": minor
---

Generalise beyond Petstore, measured on 19 public specs (full-CRUD resources 162 → 519, see docs/real-world-coverage.md).

- core: bounded, memoised `$ref` inlining (Stripe no longer runs out of memory); resolve `$ref`s to components/responses, parameters, requestBodies and path items; Swagger 2.0 `formData` → request body; group trailing-slash and `.json`-suffixed paths; detect list envelopes generically (`ResourceOperation.rowsPath`); update via item `POST`; pick the object variant of `oneOf` bodies; `ResourceOperation.contentType`; menu entries for nested lists carry `params`.
- react: YAML specs (`parseSpecText`, js-yaml loaded on demand); menu asks for path params of nested lists; bodies encoded per content type (`encodeBody`); list rows read via `rowsPath`; list revalidation scoped to path params.
- mcp: `resources[].params`.
