/**
 * Core type definitions for AGUL MVP
 */

export interface ParsedAPI {
  basePath: string;
  baseUrl: string;
  endpoints: ParsedEndpoint[];
  schemas: Record<string, SchemaObject>;
  tags: string[];
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
  security?: SecurityRequirement[];
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

export type ComponentType = 'list' | 'detail' | 'form' | 'create' | 'edit' | 'delete';

export interface MenuItem {
  key: string;
  label: string;
  children?: MenuItem[];
}

export interface GroupedRoutes {
  [tag: string]: RouteConfig[];
}
