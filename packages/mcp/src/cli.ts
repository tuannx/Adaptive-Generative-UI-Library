import { startAGULMcpServer } from './server.js';

startAGULMcpServer().catch((error) => {
  console.error('AGUL MCP server failed:', error);
  process.exit(1);
});
