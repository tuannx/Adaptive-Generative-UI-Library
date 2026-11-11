import { describe, it, expect, beforeAll, afterAll } from 'vite-plus/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createAGULMcpServer } from './server.js';

const ok = (schema: object) => ({ '200': { description: 'OK', content: { 'application/json': { schema } } } });
const Pet = { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } };
const spec = {
  openapi: '3.0.0',
  info: { title: 'Petstore', version: '1.0.0' },
  servers: [{ url: 'https://petstore.example.test/v2' }],
  paths: {
    '/pet': {
      get: { operationId: 'findPets', tags: ['pet'], responses: ok({ type: 'array', items: Pet }) },
      post: { operationId: 'addPet', tags: ['pet'], requestBody: { content: { 'application/json': { schema: Pet } } }, responses: ok(Pet) },
    },
  },
};

type ToolResult = { content: Array<{ type: string; text?: string }>; structuredContent?: Record<string, unknown>; isError?: boolean };

describe('AGUL MCP server over a real MCP client', () => {
  const client = new Client({ name: 'agul-test-client', version: '0.0.0' });

  beforeAll(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createAGULMcpServer().connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('lists both tools with an output schema', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(['generate_ui_from_json_schema', 'generate_ui_from_openapi']);
    for (const tool of tools) {
      expect(tool.outputSchema?.type).toBe('object');
      expect(tool.outputSchema?.required).toEqual(expect.arrayContaining(['baseUrl', 'menu', 'resources', 'routes', 'embed']));
    }
  });

  it('returns structuredContent and the same JSON as text for OpenAPI', async () => {
    const res = (await client.callTool({
      name: 'generate_ui_from_openapi',
      arguments: { spec, includeOperationSummaries: true },
    })) as ToolResult;

    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toBeDefined();
    expect(res.structuredContent?.baseUrl).toBe('https://petstore.example.test/v2');
    expect(res.structuredContent?.decisionInput).toBeDefined();
    expect(JSON.parse(res.content[0]?.text ?? '')).toEqual(res.structuredContent);
  });

  it('omits undefined fields from structuredContent', async () => {
    const res = (await client.callTool({ name: 'generate_ui_from_openapi', arguments: { spec } })) as ToolResult;
    expect(res.structuredContent).not.toHaveProperty('decisionInput');
    expect(res.structuredContent).not.toHaveProperty('previewUrl');
  });

  it('returns structuredContent for JSON Schema', async () => {
    const res = (await client.callTool({
      name: 'generate_ui_from_json_schema',
      arguments: { schema: Pet, baseUrl: 'https://api.example.test', resourcePath: '/pets', title: 'Pets' },
    })) as ToolResult;

    expect(res.isError).toBeFalsy();
    expect((res.structuredContent?.routes as unknown[]).length).toBeGreaterThan(0);
    expect(JSON.parse(res.content[0]?.text ?? '')).toEqual(res.structuredContent);
  });
});
