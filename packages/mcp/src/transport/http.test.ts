import { describe, it, expect, beforeAll, afterAll } from 'vite-plus/test';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startAGULHttpServer } from './http.js';

/** node:http, because fetch does not let a caller set the Host header. */
function post(url: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', headers: { host, 'content-type': 'application/json', accept: 'application/json, text/event-stream' } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }));
  });
}

const Pet = { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } };

describe('AGUL over Streamable HTTP', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = await startAGULHttpServer({ port: 0 });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('binds to loopback by default', () => {
    expect((server.address() as AddressInfo).address).toBe('127.0.0.1');
  });

  it('serves tools, structured results and the MCP Apps view to a real HTTP client', async () => {
    const client = new Client({ name: 'http-test', version: '0.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(['generate_ui_from_json_schema', 'generate_ui_from_openapi']);

    const res = (await client.callTool({
      name: 'generate_ui_from_json_schema',
      arguments: { schema: Pet, baseUrl: 'https://api.example.test', resourcePath: '/pets' },
    })) as { structuredContent?: { routeCount?: number } };
    expect(res.structuredContent?.routeCount).toBeGreaterThan(0);

    const view = await client.readResource({ uri: 'ui://agul/view.html' });
    expect(view.contents[0]?.mimeType).toBe('text/html;profile=mcp-app');

    await client.close();
  });

  it('rejects a foreign Host header and unknown paths', async () => {
    expect(await post(`${base}/mcp`, 'evil.example')).toBe(403);
    expect(await post(`${base}/other`, 'localhost')).toBe(404);
  });

  it('accepts an extra hostname given with allowedHosts', async () => {
    const tunnel = await startAGULHttpServer({ port: 0, allowedHosts: ['agul.tunnel.test'] });
    const url = `http://127.0.0.1:${(tunnel.address() as AddressInfo).port}/mcp`;
    expect(await post(url, 'agul.tunnel.test')).not.toBe(403);
    expect(await post(url, 'evil.example')).toBe(403);
    await new Promise<void>((resolve) => tunnel.close(() => resolve()));
  });
});
