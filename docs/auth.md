# Sign-in and access control

AGUL reads `components.securitySchemes` (Swagger 2.0 `securityDefinitions`) and the `security` requirements of
each operation, signs the user in with what the spec declares, and hides what the user may not do.

```tsx
<AGULRenderer
  specUrl="/openapi.json"
  auth={{ oauth: { clientId: 'admin-ui' } }}   // OAuth 2 / OIDC public client (PKCE)
/>
```

## Supported schemes

| Scheme | Sign-in | Sent as |
|---|---|---|
| `apiKey` in `header` / `query` | key field | the named header / query parameter |
| `apiKey` in `cookie` | — (set by the API's own login) | browser cookie |
| `http` `basic` | username + password | `Authorization: Basic …` (UTF-8) |
| `http` `bearer` (any other `http` scheme) | paste a token | `Authorization: Bearer …` |
| `oauth2` `authorizationCode` | redirect, **PKCE (S256)** always | `Authorization: Bearer …` |
| `oauth2` `implicit` | redirect (legacy; prefer code + PKCE) | same |
| `oauth2` `password` | username + password form | same |
| `oauth2` `clientCredentials` | client id + secret (testing only) | same |
| `openIdConnect` | discovery → code + PKCE, `openid` scope added | same |

- The sign-in dialog opens from the header, or by itself when the API answers **401**. With a refresh token,
  AGUL refreshes first (also shortly before `expires_in` runs out) and retries the request once.
- Scopes requested = every scope the spec's operations ask of that scheme, plus `auth.oauth.scopes`.
- Sign-out clears the session and, for OpenID Connect, calls the provider's `end_session_endpoint`.
- Credentials are kept per API in `sessionStorage` (`auth.storage`: `session` | `local` | `memory`) and are
  **only attached to requests for the API's origin** — never to other hosts, specs or decision APIs.
- `auth.required: true` shows a sign-in page before anything else when the API is secured.
- Passing `token` or `getAuthHeaders` means the host app manages auth: AGUL shows no sign-in UI and uses them as given.

Options:

```ts
auth?: {
  oauth?: { clientId?: string; clientSecret?: string; redirectUri?: string; scopes?: string[]; extraParams?: Record<string, string> };
  storage?: 'session' | 'local' | 'memory';
  required?: boolean;
}
```

`redirectUri` defaults to the current page without query or hash — register it with your provider. The demo
passes the full URL so the callback reopens the same `?spec=`.

## Authorities: what the user may see

Each operation's requirement comes from the spec:

- **OAuth scopes** in `security` — `[{ "oidc": ["tickets:write"] }]`. Alternatives (`[{ a: [...] }, { b: [] }]`) are
  OR-ed; a requirement only counts if the user holds a credential for its scheme.
- **Roles / permissions** with `x-agul-roles` (or `x-agul-authorities`): `"x-agul-roles": ["admin"]` — any one suffices.

The user's grants come from, in order:

1. the `authorities` prop — `authorities={['admin', 'tickets:read']}` (from your own session, an `/me` call…);
2. the signed-in token: granted `scope` from the token response, and JWT claims `scope`/`scp`, `roles`, `role`,
   `permissions`, `authorities`, `groups`, `cognito:groups`, Keycloak `realm_access.roles` and `resource_access.*.roles`;
3. nothing known (opaque token, API key, host `getAuthHeaders`) → everything is shown and the API decides.

Operations the user can't call are left out of the plan: menu entries, pages, and the Create / Edit / Delete
buttons disappear; a resource with nothing left is dropped. Visiting a hidden page shows "Not available".

This is UI gating only — tokens are decoded, not verified. **The API must still enforce every rule**; AGUL shows
its 403 messages when it does.

Programmatic use (`@aikitstudio/agul-core`):

```ts
import { planUi, grantsFromClaims, decodeJwt, canAccessEndpoint } from '@aikitstudio/agul-core';

const grants = grantsFromClaims(decodeJwt(accessToken));
const plan = planUi(api, undefined, { grants });
```

In components, `useAgulAuth()` returns `{ user, grants, credentials, signOut, openSignIn, … }`.

## Try it

Click **Helpdesk (secured)** in the demo. Its Worker mocks an OpenID Connect provider (discovery, an authorize page
with three users, PKCE-verified token endpoint, refresh, logout) and an API that enforces the same rules:

| User | Roles | Scopes | Sees |
|---|---|---|---|
| Vy | viewer | `tickets:read` | tickets list + detail only |
| Minh | agent | `tickets:read tickets:write` | + create, edit |
| Lan | admin | + `users:read` | + delete, Users, Rebuild search index |
| API key `demo-service-key` | (unknown to the UI) | — | everything; the API decides |
