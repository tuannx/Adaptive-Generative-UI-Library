# @agul/mcp

MCP server that lets coding agents turn an OpenAPI spec into an admin UI with
[AGUL](https://tuannx.github.io/Adaptive-Generative-UI-Library/).

```json
{ "mcpServers": { "agul": { "command": "npx", "args": ["-y", "@agul/mcp"] } } }
```

Tool **`generate_ui_from_openapi`** — `spec` (OpenAPI 3 / Swagger 2 JSON), optional `baseUrl`, `previewBaseUrl`,
`includeOperationSummaries`, `decisions`. Returns routes, menu, action/chat pages, the layout decisions and a
React embed snippet. The calling agent can act as the layout decider: request the summaries, then call again with
`decisions: [{ operationId, kind: 'crud' | 'action' | 'chat' | 'hidden', label?, group? }]`.

```ts
import { generateUIFromOpenAPI } from '@agul/mcp';
const ui = await generateUIFromOpenAPI(spec);
```

MIT
