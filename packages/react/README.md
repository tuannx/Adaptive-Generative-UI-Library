# @agul/react

OpenAPI / Swagger spec in, React admin UI out: CRUD pages for every resource, forms for actions, streaming chat
for AI endpoints, and sign-in plus role-based access from the spec's `securitySchemes`.

**[Live demo](https://tuannx.github.io/Adaptive-Generative-UI-Library/demo/)** · [Docs](https://github.com/tuannx/Adaptive-Generative-UI-Library#readme)

```bash
npm install @agul/react react react-dom antd @ant-design/icons axios dayjs swr react-router-dom
```

```tsx
import { AGULRenderer } from '@agul/react';

export default function Admin() {
  return <AGULRenderer specUrl="/openapi.json" auth={{ oauth: { clientId: 'admin-ui' } }} />;
}

// inside an existing router:
<Route path="/admin/*" element={<AGULRenderer spec={openApiJson} token={jwt} />} />
```

| Prop | What it does |
|---|---|
| `spec` / `specUrl` / `jsonSchema` | The API (JSON or YAML) |
| `baseUrl` | Override the spec's server URL |
| `token` / `getAuthHeaders` | Host-managed auth (no sign-in UI) |
| `auth` | Built-in sign-in: API key, Basic, Bearer, OAuth 2 + PKCE, OpenID Connect |
| `authorities` | The user's roles/scopes; pages and buttons they can't use are hidden |
| `decisionProvider` | Let an LLM or your API decide CRUD / action / chat / hidden per operation |
| `proxyUrl` | Same-origin CORS proxy prefix |
| `plugins` | Custom field widgets |

### Headless flows

`@agul/react/headless` runs a server-driven flow (`x-agul-view: flow`) with no antd, for a page that draws with its
own components. It needs only `react`; the antd peers above are optional and are not installed for it.

```bash
npm install @agul/react @agul/core react react-dom
```

```tsx
import { useAgulFlow } from '@agul/react/headless';

const flow = useAgulFlow({ startUrl: '/consult/sessions', answerUrl: (id) => `/consult/sessions/${id}/answers`, stepPath: 'flow' });
```

Guides: [sign-in and access control](https://github.com/tuannx/Adaptive-Generative-UI-Library/blob/main/docs/auth.md),
[UI decisions](https://github.com/tuannx/Adaptive-Generative-UI-Library/blob/main/docs/ui-decisions.md).

MIT
