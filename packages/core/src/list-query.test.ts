import { describe, it, expect } from 'vitest';
import {
  parseListQueryBindings,
  withFallbackPagination,
  buildListQueryString,
  getDefaultListQueryState,
} from './list-query.js';
import type { ParameterObject } from './types.js';

describe('parseListQueryBindings', () => {
  it('classifies common pagination and search params', () => {
    const parameters: ParameterObject[] = [
      { name: 'page', in: 'query', schema: { type: 'integer' } },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
      { name: 'q', in: 'query', schema: { type: 'string' } },
      { name: 'status', in: 'query', required: true, schema: { type: 'string', enum: ['available'] } },
    ];

    const bindings = parseListQueryBindings(parameters);

    expect(bindings.find((b) => b.name === 'page')?.role).toBe('page');
    expect(bindings.find((b) => b.name === 'limit')?.role).toBe('limit');
    expect(bindings.find((b) => b.name === 'q')?.role).toBe('search');
    expect(bindings.find((b) => b.name === 'status')?.role).toBe('filter');
  });
});

describe('buildListQueryString', () => {
  it('builds query string from state', () => {
    const bindings = withFallbackPagination([]);
    const state = { page: 2, pageSize: 25, search: '', filters: {} };

    expect(buildListQueryString(bindings, state)).toBe('?_page=2&_limit=25');
  });

  it('skips fallback pagination when query params exist', () => {
    const bindings = withFallbackPagination(
      parseListQueryBindings([
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['available'] },
        },
      ]),
    );

    expect(bindings.some((binding) => binding.name === '_page')).toBe(false);
  });

  it('applies filter values from state', () => {
    const bindings = parseListQueryBindings([
      {
        name: 'status',
        in: 'query',
        required: true,
        schema: { type: 'string', enum: ['available', 'pending'], default: 'available' },
      },
    ]);
    const state = {
      page: 1,
      pageSize: 10,
      search: '',
      filters: { status: 'pending' },
    };

    expect(buildListQueryString(bindings, state)).toContain('status=pending');
  });
});
