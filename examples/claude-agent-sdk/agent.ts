/**
 * Claude Agent SDK + agul-mcp.
 *   npm start          asks Claude to generate a UI for ../petstore.json (needs Claude credentials)
 *   npm run check      connects to agul-mcp and lists its tools, no model call
 * AGUL_MCP_URL=http://127.0.0.1:3333/mcp uses Streamable HTTP (agul-mcp --http) instead of stdio.
 */
import { readFile } from 'node:fs/promises';
import { query, type McpServerConfig, type Options, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

const AGUL_TOOLS = ['mcp__agul__generate_ui_from_openapi', 'mcp__agul__generate_ui_from_json_schema'];

function agulServer(): McpServerConfig {
  const url = process.env.AGUL_MCP_URL;
  if (url) return { type: 'http', url };
  const [command = 'npx', ...args] = (process.env.AGUL_MCP_COMMAND ?? 'npx -y @aikitstudio/agul-mcp').split(' ');
  return { type: 'stdio', command, args };
}

const options: Options = {
  model: 'claude-opus-5-5',
  mcpServers: { agul: agulServer() },
  tools: [], // no built-in tools: this agent only talks to AGUL
  allowedTools: AGUL_TOOLS,
  permissionMode: 'dontAsk', // anything not in allowedTools is denied, never prompted
  maxTurns: 4,
};

async function check(): Promise<void> {
  async function* noPrompt(): AsyncIterable<SDKUserMessage> {
    await new Promise(() => {}); // keep the session open without sending a turn
  }
  const session = query({ prompt: noPrompt(), options });
  try {
    let agul = (await session.mcpServerStatus()).find((server) => server.name === 'agul');
    for (let tries = 0; agul?.status === 'pending' && tries < 60; tries++) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // the server is still starting
      agul = (await session.mcpServerStatus()).find((server) => server.name === 'agul');
    }
    console.log(`agul: ${agul?.status ?? 'missing'}${agul?.error ? ` (${agul.error})` : ''}`);
    for (const tool of agul?.tools ?? []) console.log(`  ${tool.name}`);
    if (agul?.status !== 'connected') process.exitCode = 1;
  } finally {
    session.close();
  }
}

async function generate(): Promise<void> {
  const spec = await readFile(new URL('../petstore.json', import.meta.url), 'utf8');
  const prompt = `Use generate_ui_from_openapi on this OpenAPI spec, then list the resources and pages AGUL generated.\n\n${spec}`;
  for await (const message of query({ prompt, options })) {
    if (message.type !== 'result') continue;
    if (message.subtype === 'success') console.log(message.result);
    else console.error(`Stopped: ${message.subtype}`);
  }
}

await (process.argv.includes('--check') ? check() : generate());
