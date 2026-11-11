import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerGenerateFromJsonSchema } from './tools/generate-from-json-schema.js';
import { registerGenerateFromOpenApi } from './tools/generate-from-openapi.js';
import { registerAgulView } from './view/resource.js';

export function createAGULMcpServer(): McpServer {
  const server = new McpServer({
    name: 'agul',
    version: '0.1.0',
  });

  registerGenerateFromOpenApi(server);
  registerGenerateFromJsonSchema(server);
  registerAgulView(server);

  return server;
}

export async function startAGULMcpServer(): Promise<void> {
  const server = createAGULMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
