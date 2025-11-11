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
} from './types';

/**
 * Parse OpenAPI 3.0 or Swagger 2.0 specification
 */
export async function parseOpenAPI(spec: any): Promise<ParsedAPI> {
  // Normalize spec version
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
    basePath,
    baseUrl,
    endpoints,
    schemas,
    tags
  };
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
      const newOperation: any = {
        ...operation,
        responses: {}
      };

      // Convert parameters
      if (operation.parameters) {
        newOperation.parameters = operation.parameters.filter(
          (p: any) => p.in !== 'body'
        );

        const bodyParam = operation.parameters.find((p: any) => p.in === 'body');
        if (bodyParam) {
          newOperation.requestBody = {
            required: bodyParam.required,
            content: {
              'application/json': {
                schema: bodyParam.schema
              }
            }
          };
        }
      }

      // Convert responses
      Object.keys(operation.responses || {}).forEach(statusCode => {
        const response = operation.responses[statusCode];
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
  if (spec.servers && spec.servers.length > 0) {
    return spec.servers[0].url;
  }
  return 'http://localhost:3000';
}

/**
 * Extract base path from spec
 */
function extractBasePath(spec: any): string {
  if (spec.servers && spec.servers.length > 0) {
    try {
      const url = new URL(spec.servers[0].url);
      return url.pathname;
    } catch {
      return '/';
    }
  }
  return spec.basePath || '/';
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

  Object.entries(spec.paths || {}).forEach(([path, pathItem]: [string, any]) => {
    const methods: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

    methods.forEach(method => {
      if (pathItem[method]) {
        const operation = pathItem[method];

        endpoints.push({
          path,
          method,
          operationId: operation.operationId || `${method}_${path.replace(/\//g, '_')}`,
          tags: operation.tags || ['default'],
          summary: operation.summary,
          description: operation.description,
          parameters: operation.parameters as ParameterObject[],
          requestBody: operation.requestBody as RequestBodyObject,
          responses: operation.responses as Record<string, ResponseObject>,
          security: operation.security
        });
      }
    });
  });

  return endpoints;
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
  const response = responses[statusCode] || responses['default'];
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
