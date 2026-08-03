import { describe, it, expect } from 'vitest';
import { parseJsonSchema, wrapJsonSchemaAsOpenAPI } from './json-schema.js';
import { generateRoutes } from './generator.js';

const petSchema = {
  type: 'object',
  title: 'Pet',
  required: ['id', 'name'],
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    status: { type: 'string', enum: ['available', 'pending'] },
  },
} as const;

describe('wrapJsonSchemaAsOpenAPI', () => {
  it('creates CRUD paths for a resource', () => {
    const spec = wrapJsonSchemaAsOpenAPI(petSchema, {
      baseUrl: 'https://api.example.com',
      resourcePath: '/pets',
    });

    expect(spec.paths).toHaveProperty('/pets');
    expect(spec.paths).toHaveProperty('/pets/{id}');
    expect((spec.paths as Record<string, unknown>)['/pets']).toMatchObject({
      get: expect.any(Object),
      post: expect.any(Object),
    });
  });
});

describe('parseJsonSchema', () => {
  it('parses schema-only input into routes', async () => {
    const parsed = await parseJsonSchema(petSchema, {
      baseUrl: 'https://api.example.com',
      resourcePath: '/pets',
    });

    const routes = generateRoutes(parsed);

    expect(parsed.schemas.Pet).toBeDefined();
    expect(routes.some((route) => route.component === 'list')).toBe(true);
    expect(routes.some((route) => route.component === 'detail')).toBe(true);
    expect(routes.some((route) => route.component === 'create')).toBe(true);
    expect(routes.some((route) => route.component === 'edit')).toBe(true);
    expect(routes.some((route) => route.method === 'delete')).toBe(true);
  });
});
