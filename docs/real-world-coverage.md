# Real-world spec coverage

How much usable admin UI `@aikitstudio/agul-core` derives from 19 public OpenAPI specs (Stripe, GitHub, Twilio,
Kubernetes, NetBox, Jira, Keycloak, …; 9,500 endpoints in total). Measured on 2026-10-15.

Reproduce:

```bash
mkdir -p /tmp/specs
grep -v '^#' scripts/real-world-specs.txt | while read name url; do curl -sL -o /tmp/specs/$name "$url"; done
npm run build --workspace=@aikitstudio/agul-core
node scripts/measure-specs.mjs /tmp/specs
```

## Result

| Metric (all 19 specs) | Before | After |
|---|---:|---:|
| Specs that parse without crashing | 18 / 19 (Stripe ran out of memory) | **19 / 19** |
| List pages | 1,671 | **2,020** |
| …with table columns from the schema | 77 % | **87 %** |
| …reachable from the menu | 63 % | **100 %** |
| Create forms | 774 | **1,027** |
| Edit forms | 244 | **728** (×3) |
| Delete actions | 393 | **795** (×2) |
| Resources with full CRUD (list + detail + create + edit + delete) | 162 | **519** (×3.2) |
| Slowest spec (parse + build resources) | 187 ms | 246 ms (GitHub, 1,242 endpoints) |

Since the decision layer (`docs/ui-decisions.md`), operations outside CRUD get pages too: across the
19 specs (9,102 operations) every non-hidden operation is reachable — 3,168 action pages, 5 chat pages
(Box `/ai/ask`, OpenAI `/completions`, `/chat/completions`, `/responses`), 48 deprecated operations hidden.

## What was wrong (and is now handled)

| Pattern | Seen in | Effect before |
|---|---|---|
| Densely cross-referenced schemas | Stripe | Unbounded `$ref` inlining → out of memory (a browser tab would hang) |
| `$ref` to `components/responses`, `parameters`, `requestBodies` | Spotify, RealWorld, GitHub, Asana | Lists had no schema, filters missing |
| Trailing slash on paths (Django REST) | Authentik, NetBox | List and item endpoints never paired → no edit/delete |
| Format suffix (`/Calls.json`) | Twilio, Discourse | Same as above |
| List envelope with a non-standard key (`calls`, `entries`, `articles`, `topic_list.topics`) | Twilio, Box, RealWorld, Discourse | Lists shown as a single key/value record |
| Update via `POST /items/{id}` | Stripe, OpenAI, Twilio | No edit form |
| `oneOf: [Object, Object[]]` bulk-create bodies | NetBox | No create form |
| `application/x-www-form-urlencoded` / `multipart` bodies | Stripe, Twilio, Swagger 2.0 `formData` | Sent as JSON → rejected by the API |
| Collections under a path param (`/orgs/{org}/…`) | GitHub, Keycloak, Twilio, Jira | Not in the menu; the UI now asks for the params |

## Known gaps

- **CORS is unmeasured.** AGUL calls APIs from the browser; most public APIs (Stripe, Twilio, OpenAI) are
  not meant to be called from a browser with a secret key. Use `proxyUrl` with a same-origin proxy — the
  Cloudflare demo ships one (`apps/demo/worker`, host allowlist). Self-hosted backends that serve their own
  spec (Authentik, NetBox, Immich, Keycloak — relative `servers[].url`) work as-is.
- Keycloak lists: only 15 % get columns (schemas are deeper than the 3-hop inlining budget).
- Vault and Spotify are mostly action/read-only APIs; low CRUD counts there are expected.
- Arrays of objects are not editable in forms yet; nested objects are.
