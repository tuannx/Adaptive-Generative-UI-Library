export { AGULRenderer, createAGULFromSpec, createAGULFromJsonSchema, parseSpecText } from './AGULRenderer.js';
export type { AGULRendererProps } from './AGULRenderer.js';

export {
  configureAgulAuth,
  createAgulHttp,
  agulHttp,
  agulFetcher,
  resolveAuthHeaders,
} from './http/client.js';
export type { GetAuthHeaders, AgulAuthConfig } from './http/client.js';

export { PluginProvider, useAgulPlugins } from './plugins/PluginContext.js';
export { resolveFieldPlugin } from './plugins/registry.js';
export { readSchemaExtension, readSchemaWidget, readWizardConfig } from './plugins/schema-extensions.js';
export type {
  AgulFieldPlugin,
  AgulFieldRenderContext,
  AgulWizardConfig,
  AgulWizardStep,
} from './plugins/types.js';

export {
  AgulRuntimeProvider,
  useAgulRuntime,
  useAgulFetcher,
  useAgulNavigate,
  useRevalidateList,
} from './runtime.js';
export type { AgulRuntime } from './runtime.js';

export { AppLayout } from './components/AppLayout.js';
export { ListView } from './components/ListView.js';
export { DetailView } from './components/DetailView.js';
export { FormView } from './components/FormView.js';

export {
  parseOpenAPI,
  parseOpenAPISync,
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
  buildResources,
  buildMenu,
  dereferenceSchema,
  joinUrl,
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
  Resource,
  ResourceOperation,
  ResourcePaths,
} from '@agul/core';
