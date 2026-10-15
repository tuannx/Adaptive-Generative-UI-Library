import type { ParameterObject, SchemaObject } from './types.js';
import { buildApiUrl } from './generator.js';

export type ListQueryRole = 'page' | 'limit' | 'offset' | 'search' | 'filter';

export interface ListQueryParamBinding {
  name: string;
  role: ListQueryRole;
  required?: boolean;
  schema?: SchemaObject;
}

export interface ListQueryState {
  page: number;
  pageSize: number;
  search: string;
  filters: Record<string, string>;
}

const PAGE_NAMES = new Set(['page', 'pagenumber', 'page_num', '_page']);
const LIMIT_NAMES = new Set(['limit', 'pagesize', 'per_page', '_limit', 'size']);
const OFFSET_NAMES = new Set(['offset', 'skip']);
const SEARCH_NAMES = new Set(['search', 'q', 'query', 'keyword', 'term']);

function classifyQueryParam(param: ParameterObject): ListQueryRole {
  const name = param.name.toLowerCase();

  if (PAGE_NAMES.has(name)) {
    return 'page';
  }
  if (LIMIT_NAMES.has(name)) {
    return 'limit';
  }
  if (OFFSET_NAMES.has(name)) {
    return 'offset';
  }
  if (SEARCH_NAMES.has(name)) {
    return 'search';
  }

  return 'filter';
}

function normalizeParameterSchema(
  param: ParameterObject & { type?: string; items?: SchemaObject; enum?: unknown[] },
): SchemaObject | undefined {
  if (param.schema) {
    return param.schema;
  }

  if (param.items?.enum) {
    return {
      type: 'string',
      enum: param.items.enum,
      default: param.items.default,
    };
  }

  if (param.enum) {
    return {
      type: param.type ?? 'string',
      enum: param.enum,
    };
  }

  if (param.type) {
    return { type: param.type };
  }

  return undefined;
}

export function parseListQueryBindings(parameters?: ParameterObject[]): ListQueryParamBinding[] {
  return (parameters ?? [])
    .filter((param) => param.in === 'query')
    .map((param) => ({
      name: param.name,
      role: classifyQueryParam(param),
      required: param.required,
      schema: normalizeParameterSchema(param),
    }));
}

export function withFallbackPagination(bindings: ListQueryParamBinding[]): ListQueryParamBinding[] {
  if (bindings.length > 0) {
    return bindings;
  }

  return [
    { name: '_page', role: 'page', schema: { type: 'integer' } },
    { name: '_limit', role: 'limit', schema: { type: 'integer' } },
  ];
}

export function getDefaultListQueryState(_bindings: ListQueryParamBinding[]): ListQueryState {
  return {
    page: 1,
    pageSize: 10,
    search: '',
    filters: {},
  };
}

export function buildListQueryString(
  bindings: ListQueryParamBinding[],
  state: ListQueryState,
): string {
  const params = new URLSearchParams();
  const pageBinding = bindings.find((binding) => binding.role === 'page');
  const limitBinding = bindings.find((binding) => binding.role === 'limit');
  const offsetBinding = bindings.find((binding) => binding.role === 'offset');
  const searchBinding = bindings.find((binding) => binding.role === 'search');

  if (pageBinding) {
    params.set(pageBinding.name, String(state.page));
  }

  if (limitBinding) {
    params.set(limitBinding.name, String(state.pageSize));
  }

  if (offsetBinding) {
    params.set(offsetBinding.name, String((state.page - 1) * state.pageSize));
  }

  if (searchBinding && state.search.trim()) {
    params.set(searchBinding.name, state.search.trim());
  }

  for (const binding of bindings) {
    if (binding.role !== 'filter') {
      continue;
    }

    const value = state.filters[binding.name];
    if (value) {
      params.append(binding.name, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function buildListApiUrl(
  baseUrl: string,
  apiEndpoint: string,
  bindings: ListQueryParamBinding[],
  state: ListQueryState,
  pathParams: Record<string, string | undefined> = {},
): string {
  return `${buildApiUrl(baseUrl, apiEndpoint, pathParams)}${buildListQueryString(bindings, state)}`;
}
