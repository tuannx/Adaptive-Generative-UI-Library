import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAGULMcpServer } from '../server.js';

/** Runs AGUL over stdio: how Claude Desktop, Cursor and VS Code start a local MCP server. */
export async function startAGULStdioServer(): Promise<void> {
  await createAGULMcpServer().connect(new StdioServerTransport());
}
