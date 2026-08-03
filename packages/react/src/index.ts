export { AGULRenderer, createAGULFromSpec } from './AGULRenderer.js';
export type { AGULRendererProps } from './AGULRenderer.js';

export { AppLayout } from './components/AppLayout.js';
export { ListView } from './components/ListView.js';
export { DetailView } from './components/DetailView.js';
export { FormView } from './components/FormView.js';

export {
  parseOpenAPI,
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
} from '@agul/core';

export type {
  ParsedAPI,
  ParsedEndpoint,
  RouteConfig,
  SchemaObject,
  MenuItem,
  ComponentType,
  HttpMethod,
} from '@agul/core';
