import { describe, it, expect } from 'vitest';
import { parseOpenAPI, getResponseSchema, resolveRef } from './parser.js';
import { generateRoutes, groupRoutesByTag, generateMenu } from './generator.js';

const minimalOpenApi3 = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com/v1' }],
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        tags: ['pet'],
        summary: 'List pets',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Pet' },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: 'createPet',
        tags: ['pet'],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Pet' },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/pets/{petId}': {
      get: {
        operationId: 'getPet',
        tags: ['pet'],
        parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['name'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['available', 'pending', 'sold'] },
        },
      },
    },
  },
};

describe('parseOpenAPI', () => {
  it('parses OpenAPI 3.0 spec', async () => {
    const parsed = await parseOpenAPI(minimalOpenApi3);

    expect(parsed.baseUrl).toBe('https://api.example.com/v1');
    expect(parsed.endpoints).toHaveLength(3);
    expect(parsed.tags).toContain('pet');
    expect(parsed.schemas.Pet).toBeDefined();
  });

  it('converts Swagger 2.0 to OpenAPI 3.0', async () => {
    const swagger2 = {
      swagger: '2.0',
      info: { title: 'Legacy', version: '1.0' },
      host: 'legacy.example.com',
      basePath: '/api',
      schemes: ['https'],
      paths: {
        '/items': {
          get: {
            operationId: 'listItems',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };

    const parsed = await parseOpenAPI(swagger2);
    expect(parsed.baseUrl).toContain('legacy.example.com');
    expect(parsed.endpoints.some((e) => e.path === '/items' && e.method === 'get')).toBe(true);
  });
});

describe('resolveRef', () => {
  it('resolves component schema references', () => {
    const schemas = minimalOpenApi3.components.schemas;
    const resolved = resolveRef('#/components/schemas/Pet', schemas);
    expect(resolved?.properties?.name).toBeDefined();
  });
});

describe('generateRoutes', () => {
  it('maps CRUD endpoints to route components', async () => {
    const parsed = await parseOpenAPI(minimalOpenApi3);
    const routes = generateRoutes(parsed);

    expect(routes.find((r) => r.component === 'list')).toBeDefined();
    expect(routes.find((r) => r.component === 'detail')).toBeDefined();
    expect(routes.find((r) => r.component === 'create')).toBeDefined();
  });

  it('builds navigation menu from tags', async () => {
    const parsed = await parseOpenAPI(minimalOpenApi3);
    const routes = generateRoutes(parsed);
    const grouped = groupRoutesByTag(routes);
    const menu = generateMenu(grouped);

    expect(menu.length).toBeGreaterThan(0);
    expect(menu[0].children?.length).toBeGreaterThan(0);
  });
});

describe('getResponseSchema', () => {
  it('extracts schema from 200 response', () => {
    const endpoint = minimalOpenApi3.paths['/pets'].get;
    const schema = getResponseSchema(endpoint.responses);
    expect(schema?.type).toBe('array');
  });
});
