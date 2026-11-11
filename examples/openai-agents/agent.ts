/**
 * OpenAI Agents SDK + agul-mcp.
 *   npm start          asks the agent to generate a UI for ../petstore.json (needs OPENAI_API_KEY)
 *   npm run check      connects to agul-mcp, lists tools and calls one directly, no model call
 * AGUL_MCP_URL=http://127.0.0.1:3333/mcp uses Streamable HTTP (agul-mcp --http) instead of stdio.
 */
import { readFile } from 'node:fs/promises';
import { Agent, MCPServerStdio, MCPServerStreamableHttp, run, type MCPServer } from '@openai/agents';

function agulServer(): MCPServer {
  const url = process.env.AGUL_MCP_URL;
  if (url) return new MCPServerStreamableHttp({ name: 'agul', url, useStructuredContent: true });
  const fullCommand = process.env.AGUL_MCP_COMMAND ?? 'npx -y @aikitstudio/agul-mcp';
  return new MCPServerStdio({ name: 'agul', fullCommand, useStructuredContent: true });
}

async function check(server: MCPServer, spec: Record<string, unknown>): Promise<void> {
  const tools = await server.listTools();
  console.log(`agul: connected, ${tools.length} tools`);
  for (const tool of tools) console.log(`  ${tool.name}`);
  const result = await server.callToolResult?.('generate_ui_from_openapi', { spec });
  const routes = (result?.structuredContent as { routes?: unknown[] } | undefined)?.routes;
  console.log(`generate_ui_from_openapi: ${routes?.length ?? 0} routes`);
  if (!routes?.length) process.exitCode = 1;
}

async function generate(server: MCPServer, spec: Record<string, unknown>): Promise<void> {
  const agent = new Agent({
    name: 'AGUL UI builder',
    instructions: 'Turn API specs into admin UIs with the AGUL tools, then say which resources and pages were generated.',
    mcpServers: [server],
  });
  const result = await run(agent, `Generate a UI for this OpenAPI spec:\n\n${JSON.stringify(spec)}`);
  console.log(result.finalOutput);
}

const spec = JSON.parse(await readFile(new URL('../petstore.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const server = agulServer();
await server.connect();
try {
  await (process.argv.includes('--check') ? check(server, spec) : generate(server, spec));
} finally {
  await server.close();
}
