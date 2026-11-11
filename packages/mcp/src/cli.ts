import { CLI_USAGE, parseCliArgs, type CliOptions } from './cli-args.js';
import { startAGULHttpServer } from './transport/http.js';
import { startAGULStdioServer } from './transport/stdio.js';

async function main(): Promise<void> {
  let options: CliOptions;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${CLI_USAGE}`);
    process.exit(2);
  }

  if (options.transport === 'stdio') {
    await startAGULStdioServer();
    return;
  }

  const server = await startAGULHttpServer(options);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : options.port;
  // stderr, so stdout stays clean for anything piping it.
  console.error(`AGUL MCP server on http://${options.host}:${port}/mcp`);
}

main().catch((error) => {
  console.error('AGUL MCP server failed:', error);
  process.exit(1);
});
