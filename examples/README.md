# AGUL with agent SDKs

Two small agents that call `agul-mcp` to turn [`petstore.json`](./petstore.json) into an admin UI config.

| Folder | SDK | Model call needs |
| --- | --- | --- |
| [`claude-agent-sdk/`](./claude-agent-sdk/agent.ts) | `@anthropic-ai/claude-agent-sdk` 0.3.322 | Claude credentials (`ANTHROPIC_API_KEY` or a Claude Code login) |
| [`openai-agents/`](./openai-agents/agent.ts) | `@openai/agents` 0.21.0 | `OPENAI_API_KEY` |

Both need Node 22.18 or newer, which runs `.ts` files directly.

```bash
cd examples/openai-agents   # or examples/claude-agent-sdk
npm install
npm run check               # connects to agul-mcp and lists its tools, no key, no model call
npm start                   # asks the model to generate a UI for petstore.json
```

`check` in the OpenAI example also calls `generate_ui_from_openapi` directly and prints the route count.

## Pointing at agul-mcp

By default each example starts `npx -y @aikitstudio/agul-mcp` over stdio. Two environment variables change that:

- `AGUL_MCP_COMMAND` starts another command over stdio, for example a local build:
  `AGUL_MCP_COMMAND="node ../../packages/mcp/dist/cli.js" npm run check`
- `AGUL_MCP_URL` connects over Streamable HTTP instead. Start the server with `npx -y @aikitstudio/agul-mcp --http`, then
  `AGUL_MCP_URL=http://127.0.0.1:3333/mcp npm run check`

`structuredContent` and the MCP Apps view ship in the next agul-mcp release. Until then, use a local build of
`packages/mcp` (`npm run build` at the repo root) with `AGUL_MCP_COMMAND`.

## What each agent may do

- **Claude Agent SDK:** built-in tools are off (`tools: []`), only the two AGUL tools are allowed, and
  `permissionMode: 'dontAsk'` denies anything else instead of prompting.
- **OpenAI Agents SDK:** the agent has the AGUL MCP server and no other tools. `useStructuredContent: true` hands the
  model AGUL's JSON result as is.
