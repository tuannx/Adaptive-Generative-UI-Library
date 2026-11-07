---
"@ai-kit/agul-react": minor
"@ai-kit/agul-core": patch
---

UX and bug fixes. Toasts and confirm dialogs now render under React 19 (antd's static `message`/`Modal.confirm` rendered nothing; AGUL now uses `App.useApp()`). API errors read the response body (`message`, `detail`, `error_description`, …) and validation errors from common shapes (`errors[]`, `errors{}`, FastAPI `detail[]`, `violations[]`) land on the matching form fields; network/CORS failures say so. Forms edit arrays of objects, validate `minLength`/`maxLength`/`pattern`/`minimum`/`maximum`/`minItems`, and ask before discarding unsaved changes. Lists remember search, filters and page when you come back from a record, debounce server search, sort columns, refresh, bulk-delete selected rows, and show a useful empty state instead of a stray button while loading. Large menus get a search box; small menus open all groups. `SchemaObject` types the JSON Schema validation keywords.
