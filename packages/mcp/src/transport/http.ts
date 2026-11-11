import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createAGULMcpServer } from '../server.js';
import { isAllowedHost, LOOPBACK_HOSTNAMES } from './host-check.js';

export interface AGULHttpOptions {
  /** Port to listen on; 0 picks a free one. Default 3333. */
  port?: number;
  /** Interface to bind. Default 127.0.0.1, so nothing outside this machine can reach it. */
  host?: string;
  /** Extra hostnames allowed in the Host header, e.g. a tunnel's hostname. Loopback names are always allowed. */
  allowedHosts?: string[];
  /** URL path of the MCP endpoint. Default /mcp. */
  path?: string;
}

export const DEFAULT_HTTP_PORT = 3333;

function sendJsonRpcError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
}

/**
 * Serves AGUL over MCP Streamable HTTP in stateless mode: every request gets a fresh server and
 * transport, so nothing is kept between calls. Resolves once the server is listening.
 */
export async function startAGULHttpServer(options: AGULHttpOptions = {}): Promise<Server> {
  const path = options.path ?? '/mcp';
  const allowed = [...LOOPBACK_HOSTNAMES, ...(options.allowedHosts ?? [])];

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== path) {
      sendJsonRpcError(res, 404, 'Not found');
      return;
    }
    if (!isAllowedHost(req.headers.host, allowed)) {
      sendJsonRpcError(res, 403, 'Host not allowed');
      return;
    }

    const server = createAGULMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('AGUL MCP request failed:', error);
      if (!res.headersSent) sendJsonRpcError(res, 500, 'Internal server error');
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(options.port ?? DEFAULT_HTTP_PORT, options.host ?? '127.0.0.1', () => resolve());
  });
  return httpServer;
}
