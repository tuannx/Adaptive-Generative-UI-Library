# @ai-kit/agul-core

The framework-free half of [AGUL](https://tuannx.github.io/Adaptive-Generative-UI-Library/): parses OpenAPI 3.x /
Swagger 2.0, groups endpoints into resources (list / detail / create / update / delete), decides how every
operation is shown (CRUD, action, chat, hidden), and filters it by what the user may do. No React dependency.

```bash
npm install @ai-kit/agul-core
```

```ts
import { parseOpenAPISync, planUi, grantsFromClaims, decodeJwt } from '@ai-kit/agul-core';

const api = parseOpenAPISync(spec);
const plan = planUi(api, undefined, { grants: grantsFromClaims(decodeJwt(accessToken)) });

plan.resources; // CRUD resources with router paths and dereferenced schemas
plan.pages;     // action and chat pages
plan.menu;      // sidebar grouped by tag
```

Also: `createLlmDecisionProvider` / `createHttpDecisionProvider` (let an LLM choose the layout),
`summarizeOperations`, `DECISION_JSON_SCHEMA`, `buildListApiUrl`, `canAccessEndpoint`.

React components: [`@ai-kit/agul-react`](https://www.npmjs.com/package/@ai-kit/agul-react). MIT
