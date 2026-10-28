/**
 * Core type definitions for AGUL MVP
 */

export interface ParsedAPI {
  title: string;
  version?: string;
  basePath: string;
  baseUrl: string;
  endpoints: ParsedEndpoint[];
  schemas: Record<string, SchemaObject>;
  tags: string[];
  /** `components.securitySchemes` (Swagger 2.0 `securityDefinitions` converted). */
  securitySchemes: Record<string, SecurityScheme>;
}

export type SecurityScheme =
  | { type: 'apiKey'; name: string; in: 'header' | 'query' | 'cookie'; description?: string }
  | { type: 'http'; scheme: string; bearerFormat?: string; description?: string }
  | { type: 'oauth2'; flows: OAuthFlows; description?: string }
  | { type: 'openIdConnect'; openIdConnectUrl: string; description?: string }
  | { type: 'mutualTLS'; description?: string };

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface ParsedEndpoint {
  path: string;
  method: HttpMethod;
  operationId: string;
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  /** Effective security: the operation's own, else the document's. `[]` or a `{}` entry means public. */
  security?: SecurityRequirement[];
  deprecated?: boolean;
  /** `x-*` vendor extensions on the operation, e.g. `x-agul-view`. */
  extensions?: Record<string, unknown>;
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface ParameterObject {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: SchemaObject;
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema: SchemaObject;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: any[];
  default?: any;
  example?: any;
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  readOnly?: boolean;
  writeOnly?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  nullable?: boolean;
  deprecated?: boolean;
  [extension: `x-${string}`]: unknown;
}

export interface SecurityRequirement {
  [key: string]: string[];
}

export interface RouteConfig {
  path: string;           // React Router path
  component: ComponentType;
  apiEndpoint: string;    // Actual API endpoint
  method: HttpMethod;
  schema?: SchemaObject;
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  tag?: string;
  operationId: string;
}

export type ComponentType = 'list' | 'detail' | 'form' | 'create' | 'edit' | 'delete' | 'action' | 'chat';

export interface MenuItem {
  key: string;
  label: string;
  /** Path params the user must supply before navigating (`key` then contains `:param` segments). */
  params?: string[];
  children?: MenuItem[];
}

export interface GroupedRoutes {
  [tag: string]: RouteConfig[];
}

export interface JsonSchemaInputOptions {
  baseUrl: string;
  resourcePath?: string;
  title?: string;
  idParam?: string;
  tag?: string;
}
