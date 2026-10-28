export { AGULRenderer, createAGULFromSpec, createAGULFromJsonSchema, parseSpecText } from './AGULRenderer.js';
export type { AGULRendererProps } from './AGULRenderer.js';

export {
  configureAgulAuth,
  createAgulHttp,
  withProxy,
  agulHttp,
  agulFetcher,
  resolveAuthHeaders,
  createAgulFetch,
} from './http/client.js';
export { useAgulAuth, AuthMenu, SignInModal, SignInPanel } from './auth/AuthUi.js';
export type { AgulAuthOptions, AgulOAuthOptions, AgulAuthState, SignInReason } from './auth/controller.js';
export { AgulSessionStore, signRequest, isApiUrl, describeUser, grantsFromCredentials } from './auth/session.js';
export type { AgulCredential, AgulCredentials, AgulAuthStorage, AgulUser } from './auth/session.js';
export { startAuthorization, completeAuthorization, requestToken, refreshCredential, discoverOidc, pkceChallenge } from './auth/oauth.js';
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
export { ActionView } from './components/ActionView.js';
export { ChatView } from './components/ChatView.js';
export { ResultView } from './components/ResultView.js';
export { readStream, extractChunkText } from './http/stream.js';
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
  planUi,
  heuristicDecisions,
  resolveDecisions,
  mergeDecisions,
  summarizeOperations,
  createHttpDecisionProvider,
  createLlmDecisionProvider,
  withDecisionCache,
  DECISION_JSON_SCHEMA,
  DECISION_SYSTEM_PROMPT,
  buildDecisionPrompt,
  parseDecisionResponse,
  dereferenceSchema,
  joinUrl,
  parseListQueryBindings,
  withFallbackPagination,
  getDefaultListQueryState,
  buildListApiUrl,
  buildListQueryString,
  canAccessEndpoint,
  grantsFromClaims,
  decodeJwt,
  isPublicOperation,
  requiredRoles,
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
  UiKind,
  UiDecision,
  UiDecisionProvider,
  ProposedDecision,
  OperationSummary,
  OperationPage,
  UiPlan,
  ChatBinding,
  StreamFormat,
  LlmCompletionRequest,
  SecurityScheme,
  OAuthFlow,
  OAuthFlows,
  AccessGrants,
  PlanOptions,
} from '@agul/core';
