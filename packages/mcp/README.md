# @aikitstudio/agul-mcp

MCP server that lets coding agents turn an OpenAPI spec into an admin UI with
[AGUL](https://tuannx.github.io/Adaptive-Generative-UI-Library/).

```json
{ "mcpServers": { "agul": { "command": "npx", "args": ["-y", "@aikitstudio/agul-mcp"] } } }
```

For hosts that add an MCP server by URL, run it over Streamable HTTP:

```bash
npx -y @aikitstudio/agul-mcp --http            # http://127.0.0.1:3333/mcp
npx -y @aikitstudio/agul-mcp --http --port 8080 --allowed-host my-tunnel.example.com
```

It listens on this machine only. To reach it from a hosted app, put an HTTPS tunnel in front and pass the tunnel's
hostname with `--allowed-host`; requests with any other Host header are rejected.

Tool **`generate_ui_from_openapi`** — `spec` (OpenAPI 3 / Swagger 2 JSON), optional `baseUrl`, `previewBaseUrl`,
`includeOperationSummaries`, `decisions`. Returns routes, menu, action/chat pages, the layout decisions and a
React embed snippet. The calling agent can act as the layout decider: request the summaries, then call again with
`decisions: [{ operationId, kind: 'crud' | 'action' | 'chat' | 'hidden', label?, group? }]`.

Both tools return the config as `structuredContent` (described by the tool's `outputSchema`) and, for older
clients, as the same JSON in a text block.

In hosts that support [MCP Apps](https://github.com/modelcontextprotocol/ext-apps), both tools open the
`ui://agul/view.html` view, which shows the generated resources, pages and layout decisions. The view is one
self-contained HTML file (about 73 kB gzip) built by `scripts/build-view.mjs` and needs no network access.

```ts
import { generateUIFromOpenAPI } from '@aikitstudio/agul-mcp';
const ui = await generateUIFromOpenAPI(spec);
```

MIT
