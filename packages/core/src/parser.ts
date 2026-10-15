/**
 * OpenAPI Parser - Converts OpenAPI/Swagger spec to normalized format
 */

import type {
  ParsedAPI,
  ParsedEndpoint,
  HttpMethod,
  SchemaObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject
} from './types.js';

/**
 * Parse OpenAPI 3.0 or Swagger 2.0 specification
 */
export async function parseOpenAPI(spec: any): Promise<ParsedAPI> {
  return parseOpenAPISync(spec);
}

export function parseOpenAPISync(spec: any): ParsedAPI {
  if (!spec || typeof spec !== 'object' || (!spec.openapi && !spec.swagger)) {
    throw new Error('Not an OpenAPI document: expected an "openapi" or "swagger" field');
  }
  if (!spec.paths || typeof spec.paths !== 'object') {
    throw new Error('OpenAPI document has no "paths"');
  }

  const normalized = normalizeSpec(spec);

  // Extract base URL
  const baseUrl = extractBaseUrl(normalized);
  const basePath = extractBasePath(normalized);

  // Extract tags
  const tags = extractTags(normalized);

  // Parse all endpoints
  const endpoints = parseEndpoints(normalized);

  // Extract schemas/definitions
  const schemas = extractSchemas(normalized);

  return {
    title: normalized.info?.title ?? 'API',
    version: normalized.info?.version,
    basePath,
    baseUrl,
    endpoints,
    schemas,
    tags
  };
}

/**
 * Follow a local `$ref` (`#/components/responses/X`, `#/parameters/Y`, ...) to its target.
 * Schema refs are left alone; `dereferenceSchema` handles those lazily.
 */
function resolveLocalRef(doc: any, value: any, hops = 0): any {
  if (!value || typeof value !== 'object' || typeof value.$ref !== 'string' || hops > 10) {
    return value;
  }
  const ref: string = value.$ref;
  if (!ref.startsWith('#/')) return value;

  const target = ref
    .slice(2)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((node: any, key) => (node == null ? undefined : node[key]), doc);

  return target === undefined ? value : resolveLocalRef(doc, target, hops + 1);
}

/**
 * Normalize Swagger 2.0 to OpenAPI 3.0 format
 */
function normalizeSpec(spec: any): any {
  const version = spec.openapi || spec.swagger;

  if (version && version.startsWith('2')) {
    // Convert Swagger 2.0 to OpenAPI 3.0
    return convertSwagger2to3(spec);
  }

  return spec;
}

/**
 * Convert Swagger 2.0 to OpenAPI 3.0 (simplified)
 */
function convertSwagger2to3(swagger2: any): any {
  const openapi3: any = {
    openapi: '3.0.0',
    info: swagger2.info,
    servers: [],
    paths: {},
    components: {
      schemas: swagger2.definitions || {}
    }
  };

  // Convert servers
  const schemes = swagger2.schemes || ['https'];
  const host = swagger2.host || 'localhost';
  const basePath = swagger2.basePath || '';

  schemes.forEach((scheme: string) => {
    openapi3.servers.push({
      url: `${scheme}://${host}${basePath}`
    });
  });

  // Convert paths
  Object.keys(swagger2.paths || {}).forEach(path => {
    openapi3.paths[path] = {};

    Object.keys(swagger2.paths[path]).forEach(method => {
      const operation = swagger2.paths[path][method];
      if (method === 'parameters') {
        openapi3.paths[path].parameters = operation;
        return;
      }
      const newOperation: any = {
        ...operation,
        responses: {}
      };

      // Convert parameters
      if (operation.parameters) {
        const params = operation.parameters.map((p: any) => resolveLocalRef(swagger2, p));
        newOperation.parameters = params.filter((p: any) => p.in !== 'body' && p.in !== 'formData');

        const bodyParam = params.find((p: any) => p.in === 'body');
        const formParams = params.filter((p: any) => p.in === 'formData');
        if (bodyParam) {
          newOperation.requestBody = {
            required: bodyParam.required,
            content: {
              'application/json': {
                schema: bodyParam.schema
              }
            }
          };
        } else if (formParams.length > 0) {
          const consumes: string[] = operation.consumes ?? swagger2.consumes ?? [];
          const mediaType = consumes.find((type) => type.includes('form')) ?? 'application/x-www-form-urlencoded';
          newOperation.requestBody = {
            content: {
              [mediaType]: {
                schema: {
                  type: 'object',
                  required: formParams.filter((p: any) => p.required).map((p: any) => p.name),
                  properties: Object.fromEntries(
                    formParams.map(({ name, in: _in, required: _required, ...rest }: any) => [name, rest]),
                  ),
                },
              },
            },
          };
        }
      }

      // Convert responses
      Object.keys(operation.responses || {}).forEach(statusCode => {
        const response = resolveLocalRef(swagger2, operation.responses[statusCode]);
        newOperation.responses[statusCode] = {
          description: response.description || 'Response',
          content: response.schema ? {
            'application/json': {
              schema: response.schema
            }
          } : undefined
        };
      });

      openapi3.paths[path][method] = newOperation;
    });
  });

  return openapi3;
}

/**
 * Extract base URL from spec
 */
function extractBaseUrl(spec: any): string {
  const server = spec.servers?.[0];
  if (!server?.url) {
    return '';
  }

  const url = String(server.url).replace(/\{([^}]+)\}/g, (_: string, name: string) =>
    String(server.variables?.[name]?.default ?? ''),
  );
  return url.replace(/\/+$/, '');
}

/**
 * Extract base path from spec
 */
function extractBasePath(spec: any): string {
  const url = extractBaseUrl(spec);
  try {
    return new URL(url, 'http://placeholder').pathname;
  } catch {
    return '/';
  }
}

/**
 * Extract tags from spec
 */
function extractTags(spec: any): string[] {
  const tags = new Set<string>();

  // Get tags from tag definitions
  if (spec.tags) {
    spec.tags.forEach((tag: any) => {
      tags.add(tag.name);
    });
  }

  // Get tags from operations
  Object.values(spec.paths || {}).forEach((pathItem: any) => {
    Object.values(pathItem).forEach((operation: any) => {
      if (operation.tags) {
        operation.tags.forEach((tag: string) => tags.add(tag));
      }
    });
  });

  return Array.from(tags);
}

/**
 * Parse all endpoints from spec
 */
function parseEndpoints(spec: any): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];

  Object.entries(spec.paths || {}).forEach(([path, rawPathItem]: [string, any]) => {
    const pathItem = resolveLocalRef(spec, rawPathItem) ?? {};
    const methods: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

    methods.forEach(method => {
      if (pathItem[method]) {
        const operation = pathItem[method];
        const resolveAll = (params?: any[]) => params?.map((param) => resolveLocalRef(spec, param));
        const parameters = mergeParameters(resolveAll(pathItem.parameters), resolveAll(operation.parameters));
        const responses = Object.fromEntries(
          Object.entries(operation.responses ?? {}).map(([code, response]) => [code, resolveLocalRef(spec, response)]),
        );

        endpoints.push({
          path,
          method,
          operationId: operation.operationId || `${method}_${path.replace(/\//g, '_')}`,
          tags: operation.tags || ['default'],
          summary: operation.summary,
          description: operation.description,
          parameters,
          requestBody: resolveLocalRef(spec, operation.requestBody) as RequestBodyObject,
          responses: responses as Record<string, ResponseObject>,
          security: operation.security
        });
      }
    });
  });

  return endpoints;
}

function mergeParameters(pathLevel?: ParameterObject[], operationLevel?: ParameterObject[]): ParameterObject[] | undefined {
  if (!pathLevel?.length) return operationLevel;

  const byKey = new Map<string, ParameterObject>();
  for (const param of [...pathLevel, ...(operationLevel ?? [])]) {
    byKey.set(`${param.in}:${param.name}`, param);
  }
  return [...byKey.values()];
}

/**
 * Extract schemas from spec
 */
function extractSchemas(spec: any): Record<string, SchemaObject> {
  const schemas: Record<string, SchemaObject> = {};

  // OpenAPI 3.0
  if (spec.components && spec.components.schemas) {
    Object.assign(schemas, spec.components.schemas);
  }

  // Swagger 2.0
  if (spec.definitions) {
    Object.assign(schemas, spec.definitions);
  }

  return schemas;
}

/**
 * Resolve $ref references in schema
 */
export function resolveRef(ref: string, schemas: Record<string, SchemaObject>): SchemaObject | null {
  // Extract schema name from $ref (e.g., "#/components/schemas/Pet" -> "Pet")
  const match = ref.match(/#\/(?:components\/schemas|definitions)\/(.+)/);
  if (match && match[1]) {
    return schemas[match[1]] || null;
  }
  return null;
}

/**
 * Get schema for a response
 */
export function getResponseSchema(
  responses: Record<string, ResponseObject>,
  statusCode = '200'
): SchemaObject | null {
  const successCode = Object.keys(responses).find((code) => /^2\d\d$/.test(code));
  const response =
    responses[statusCode] || (successCode && responses[successCode]) || responses['default'];
  if (!response || !response.content) {
    return null;
  }

  const mediaType = response.content['application/json'] ||
                     response.content['*/*'] ||
                     Object.values(response.content)[0];

  return mediaType?.schema || null;
}

/**
 * Get schema for request body
 */
export function getRequestSchema(requestBody?: RequestBodyObject): SchemaObject | null {
  if (!requestBody || !requestBody.content) {
    return null;
  }

  const mediaType = requestBody.content['application/json'] ||
                     requestBody.content['*/*'] ||
                     Object.values(requestBody.content)[0];

  return mediaType?.schema || null;
}
