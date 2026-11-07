---
"@aikitstudio/agul-core": minor
"@aikitstudio/agul-react": minor
---

Sign-in and access control from the spec. `@aikitstudio/agul-core` parses `securitySchemes` (Swagger 2.0 `securityDefinitions` too), applies document-level `security`, and `planUi(api, decisions, { grants })` leaves out operations whose OAuth scopes or `x-agul-roles` the user lacks (`canAccessEndpoint`, `grantsFromClaims`, `decodeJwt`). `<AGULRenderer>` gets a built-in sign-in for API keys, Basic, Bearer, OAuth 2 (authorization code + PKCE, implicit, password, client credentials) and OpenID Connect (discovery, refresh tokens, end-session), opens it on a 401, retries once after a token refresh, sends credentials only to the API's origin, and hides menus, pages and buttons the signed-in user may not use (`auth`, `authorities` props, `useAgulAuth()`).
