import { describe, it, expect } from 'vite-plus/test';
import { escapeHtml, renderView } from './render.js';
import { generateUIFromOpenAPI } from '../generate-ui.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'Orders <script>', version: '2.1.0' },
  servers: [{ url: 'https://api.example.test' }],
  paths: {
    '/orders': {
      get: {
        operationId: 'listOrders',
        tags: ['orders'],
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, amount: { type: 'number' } } } } } },
          },
        },
      },
    },
  },
};

describe('renderView', () => {
  it('shows title, resources, fields and decisions from a real result', async () => {
    const html = renderView(await generateUIFromOpenAPI(spec));
    expect(html).toContain('v2.1.0');
    expect(html).toContain('https://api.example.test');
    expect(html).toContain('Resources');
    expect(html).toContain('amount');
    expect(html).toContain('listOrders');
    expect(html).toContain('AGULRenderer');
  });

  it('escapes text from the spec', async () => {
    const html = renderView(await generateUIFromOpenAPI(spec));
    expect(html).not.toContain('<script>');
    expect(html).toContain('Orders &lt;script&gt;');
  });

  it('handles a missing result', () => {
    expect(renderView(undefined)).toContain('No UI was generated');
    expect(escapeHtml(`"a"&'b'`)).toBe('&quot;a&quot;&amp;&#39;b&#39;');
  });
});
