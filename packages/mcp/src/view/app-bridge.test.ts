import { describe, it, expect } from 'vite-plus/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { App } from '@modelcontextprotocol/ext-apps';
import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
import { createAGULMcpServer } from '../server.js';
import { renderView } from './render.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'Petstore', version: '1.0.0' },
  servers: [{ url: 'https://petstore.example.test' }],
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        tags: ['pets'],
        responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } } } } } } } },
      },
    },
  },
};

describe('MCP Apps round trip with the official App and AppBridge', () => {
  it('delivers a real tool result to the view and renders it', async () => {
    // The host side: an MCP client talking to the AGUL server.
    const client = new Client({ name: 'test-host', version: '0.0.0' });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await createAGULMcpServer().connect(serverSide);
    await client.connect(clientSide);

    // The tool points at the view, and the view resource is served with the MCP Apps MIME type.
    const { tools } = await client.listTools();
    const tool = tools.find((item) => item.name === 'generate_ui_from_openapi');
    const uri = (tool?._meta?.ui as { resourceUri?: string } | undefined)?.resourceUri;
    expect(uri).toBe('ui://agul/view.html');
    const resource = await client.readResource({ uri: uri as string });
    expect(resource.contents[0]?.mimeType).toBe('text/html;profile=mcp-app');

    // The host calls the tool, then hands the result to the view through the bridge.
    const result = await client.callTool({ name: 'generate_ui_from_openapi', arguments: { spec } });

    const bridge = new AppBridge(null, { name: 'test-host', version: '0.0.0' }, {});
    const app = new App({ name: 'agul-view', version: '0.1.0' }, {}, { autoResize: false });
    const [bridgeSide, appSide] = InMemoryTransport.createLinkedPair();

    const initialized = new Promise<void>((resolve) => {
      bridge.oninitialized = () => resolve();
    });
    const rendered = new Promise<string>((resolve) => {
      app.ontoolresult = (params) => resolve(renderView(params.structuredContent));
    });

    await bridge.connect(bridgeSide);
    await app.connect(appSide);
    await initialized;

    await bridge.sendToolInput({ arguments: { spec } });
    await bridge.sendToolResult(result as Parameters<AppBridge['sendToolResult']>[0]);

    const html = await rendered;
    expect(html).toContain('Petstore');
    expect(html).toContain('listPets');

    await app.close();
    await bridge.close();
    await client.close();
  });
});
