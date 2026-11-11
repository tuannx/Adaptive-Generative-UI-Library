import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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

/** Stdio server, kept for existing imports. Same as `startAGULStdioServer`. */
export async function startAGULMcpServer(): Promise<void> {
  const { startAGULStdioServer } = await import('./transport/stdio.js');
  await startAGULStdioServer();
}
