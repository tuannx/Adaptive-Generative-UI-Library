import { parseArgs } from 'node:util';
import { DEFAULT_HTTP_PORT } from './transport/http.js';

export type CliOptions =
  | { transport: 'stdio' }
  | { transport: 'http'; port: number; host: string; allowedHosts: string[] };

export const CLI_USAGE = `Usage: agul-mcp [--http] [--port <n>] [--host <addr>] [--allowed-host <name>...]

  (no flags)            Serve MCP over stdio (Claude Desktop, Cursor, VS Code).
  --http                Serve MCP over Streamable HTTP at http://<host>:<port>/mcp.
  --port <n>            HTTP port (default ${DEFAULT_HTTP_PORT}).
  --host <addr>         Interface to bind (default 127.0.0.1, this machine only).
  --allowed-host <name> Extra Host header name to accept, e.g. a tunnel hostname. Repeatable.`;

export function parseCliArgs(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      http: { type: 'boolean', default: false },
      port: { type: 'string' },
      host: { type: 'string' },
      'allowed-host': { type: 'string', multiple: true },
    },
    strict: true,
  });

  if (!values.http) {
    if (values.port || values.host || values['allowed-host']) {
      throw new Error('--port, --host and --allowed-host only apply with --http');
    }
    return { transport: 'stdio' };
  }

  const port = values.port === undefined ? DEFAULT_HTTP_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid --port: ${values.port}`);
  }
  return { transport: 'http', port, host: values.host ?? '127.0.0.1', allowedHosts: values['allowed-host'] ?? [] };
}
