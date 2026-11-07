import { describe, it, expect } from 'vite-plus/test';
import { generateUIFromOpenAPI, generateUIFromJsonSchema } from './generate-ui.js';

const Pet = { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } };
const ok = (schema: object) => ({ '200': { description: 'OK', content: { 'application/json': { schema } } } });

const petstoreSpec = {
  openapi: '3.0.0',
  info: { title: 'Petstore', version: '1.0.0' },
  servers: [{ url: 'https://petstore.swagger.io/v2' }],
  paths: {
    '/pet': {
      get: {
        operationId: 'findPets',
        tags: ['pet'],
        summary: 'Find pets',
        responses: ok({ type: 'array', items: Pet }),
      },
      post: {
        operationId: 'addPet',
        tags: ['pet'],
        requestBody: { content: { 'application/json': { schema: Pet } } },
        responses: ok(Pet),
      },
    },
    '/pet/{petId}': {
      get: {
        operationId: 'getPet',
        tags: ['pet'],
        parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: ok(Pet),
      },
    },
  },
};

describe('generateUIFromOpenAPI', () => {
  it('returns routes and menu from OpenAPI spec', async () => {
    const result = await generateUIFromOpenAPI(petstoreSpec);

    expect(result.routeCount).toBeGreaterThan(0);
    expect(result.menu.length).toBeGreaterThan(0);
    expect(result.routes.some((r) => r.component === 'list')).toBe(true);
    expect(result.embed.react).toContain('AGULRenderer');
    expect(result.embed.install).toContain('@aikitstudio/agul-react');
  });

  it('includes preview URL when provided', async () => {
    const result = await generateUIFromOpenAPI(petstoreSpec, {
      previewBaseUrl: 'http://localhost:5173',
    });

    expect(result.previewUrl).toBe('http://localhost:5173/');
  });

  it('overrides base URL', async () => {
    const result = await generateUIFromOpenAPI(petstoreSpec, {
      baseUrl: 'https://api.example.com',
    });

    expect(result.baseUrl).toBe('https://api.example.com');
  });
});

const petJsonSchema = {
  type: 'object',
  title: 'Pet',
  required: ['id', 'name'],
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    status: { type: 'string' },
  },
};

describe('generateUIFromJsonSchema', () => {
  it('returns routes and embed snippet from JSON Schema', async () => {
    const result = await generateUIFromJsonSchema(petJsonSchema, {
      baseUrl: 'https://api.example.com',
      resourcePath: '/pets',
    });

    expect(result.routeCount).toBeGreaterThan(0);
    expect(result.menu.length).toBeGreaterThan(0);
    expect(result.routes.some((route) => route.component === 'list')).toBe(true);
    expect(result.embed.react).toContain('jsonSchema');
    expect(result.embed.react).toContain('resourcePath="/pets"');
  });
});

describe('layout decisions through MCP', () => {
  const spec = {
    ...petstoreSpec,
    paths: {
      ...petstoreSpec.paths,
      '/assistant/ask': {
        post: {
          operationId: 'askAssistant',
          tags: ['assistant'],
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { question: { type: 'string' } } } } } },
          responses: { '200': { description: 'stream', content: { 'text/event-stream': { schema: { type: 'string' } } } } },
        },
      },
    },
  };

  it('reports pages, decisions and, on request, what the agent needs to decide', async () => {
    const result = await generateUIFromOpenAPI(spec, { includeOperationSummaries: true });
    expect(result.pages).toEqual([
      expect.objectContaining({ operationId: 'askAssistant', kind: 'chat', stream: 'sse', chat: expect.objectContaining({ messageField: 'question' }) }),
    ]);
    expect(result.decisions.findPets).toEqual({ kind: 'crud', source: 'heuristic' });
    expect(result.decisionInput?.operations).toHaveLength(4);
    expect(result.decisionInput?.schema.required).toEqual(['decisions']);
  });

  it('applies the agent\'s decisions and embeds them in the snippet', async () => {
    const result = await generateUIFromOpenAPI(spec, {
      decisions: [{ operationId: 'askAssistant', kind: 'hidden' }, { operationId: 'findPets', kind: 'crud', label: 'All pets' }],
    });
    expect(result.pages).toEqual([]);
    expect(result.decisions.askAssistant).toEqual({ kind: 'hidden', source: 'provider' });
    expect(result.embed.react).toContain('decisionProvider');
    expect(result.decisionInput).toBeUndefined();
  });
});
