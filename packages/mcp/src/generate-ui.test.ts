import { describe, it, expect } from 'vitest';
import { generateUIFromOpenAPI } from './generate-ui.js';

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
        responses: { '200': { description: 'OK' } },
      },
      post: {
        operationId: 'addPet',
        tags: ['pet'],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/pet/{petId}': {
      get: {
        operationId: 'getPet',
        tags: ['pet'],
        parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' } },
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
    expect(result.embed.install).toContain('@agul/react');
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
