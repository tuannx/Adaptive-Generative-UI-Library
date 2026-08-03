export { AGULRenderer, createAGULFromSpec, createAGULFromJsonSchema } from './AGULRenderer.js';
export type { AGULRendererProps } from './AGULRenderer.js';

export {
  configureAgulAuth,
  agulHttp,
  agulFetcher,
  resolveAuthHeaders,
} from './http/client.js';
export type { GetAuthHeaders, AgulAuthConfig } from './http/client.js';

export { AppLayout } from './components/AppLayout.js';
export { ListView } from './components/ListView.js';
export { DetailView } from './components/DetailView.js';
export { FormView } from './components/FormView.js';

export {
  parseOpenAPI,
  parseJsonSchema,
  wrapJsonSchemaAsOpenAPI,
  generateRoutes,
  groupRoutesByTag,
  generateMenu,
  buildApiUrl,
  getCrudOperations,
  getResourceRoot,
  routesShareResource,
  resolveRef,
  getResponseSchema,
  getRequestSchema,
  parseListQueryBindings,
  withFallbackPagination,
  getDefaultListQueryState,
  buildListApiUrl,
  buildListQueryString,
} from '@agul/core';

export type {
  ParsedAPI,
  ParsedEndpoint,
  RouteConfig,
  SchemaObject,
  MenuItem,
  ComponentType,
  HttpMethod,
  JsonSchemaInputOptions,
  ListQueryParamBinding,
  ListQueryState,
} from '@agul/core';
