import type { JsonSchemaInputOptions, ParsedAPI, SchemaObject } from './types.js';
import { parseOpenAPI } from './parser.js';

function deriveResourceName(schema: SchemaObject, options: JsonSchemaInputOptions): string {
  return options.title ?? schema.title ?? 'Item';
}

function deriveResourcePath(schema: SchemaObject, options: JsonSchemaInputOptions): string {
  if (options.resourcePath) {
    return options.resourcePath.startsWith('/')
      ? options.resourcePath
      : `/${options.resourcePath}`;
  }

  const name = deriveResourceName(schema, options).toLowerCase();
  return name.endsWith('s') ? `/${name}` : `/${name}s`;
}

function deriveIdParam(schema: SchemaObject, options: JsonSchemaInputOptions): string {
  if (options.idParam) {
    return options.idParam;
  }

  const properties = schema.properties ?? {};
  for (const field of ['id', '_id', 'uuid']) {
    if (field in properties) {
      return field;
    }
  }

  return 'id';
}

function toSchemaName(title: string): string {
  return title.replace(/[^a-zA-Z0-9]+/g, '');
}

export function wrapJsonSchemaAsOpenAPI(
  schema: SchemaObject,
  options: JsonSchemaInputOptions,
): Record<string, unknown> {
  const resourcePath = deriveResourcePath(schema, options);
  const resourceName = deriveResourceName(schema, options);
  const schemaName = toSchemaName(resourceName) || 'Item';
  const idParam = deriveIdParam(schema, options);
  const tag = options.tag ?? schemaName.toLowerCase();
  const itemRef = { $ref: `#/components/schemas/${schemaName}` };
  const itemPath = `${resourcePath}/{${idParam}}`;

  return {
    openapi: '3.0.3',
    info: {
      title: resourceName,
      version: '1.0.0',
    },
    servers: [{ url: options.baseUrl }],
    tags: [{ name: tag, description: resourceName }],
    paths: {
      [resourcePath]: {
        get: {
          operationId: `list${schemaName}`,
          tags: [tag],
          summary: `List ${resourceName}`,
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'array', items: itemRef },
                },
              },
            },
          },
        },
        post: {
          operationId: `create${schemaName}`,
          tags: [tag],
          summary: `Create ${resourceName}`,
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: itemRef },
            },
          },
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': { schema: itemRef },
              },
            },
          },
        },
      },
      [itemPath]: {
        get: {
          operationId: `get${schemaName}`,
          tags: [tag],
          summary: `Get ${resourceName}`,
          parameters: [
            { name: idParam, in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': { schema: itemRef },
              },
            },
          },
        },
        put: {
          operationId: `update${schemaName}`,
          tags: [tag],
          summary: `Update ${resourceName}`,
          parameters: [
            { name: idParam, in: 'path', required: true, schema: { type: 'integer' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: itemRef },
            },
          },
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': { schema: itemRef },
              },
            },
          },
        },
        delete: {
          operationId: `delete${schemaName}`,
          tags: [tag],
          summary: `Delete ${resourceName}`,
          parameters: [
            { name: idParam, in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: { '200': { description: 'OK' } },
        },
      },
    },
    components: {
      schemas: {
        [schemaName]: schema,
      },
    },
  };
}

export async function parseJsonSchema(
  schema: SchemaObject,
  options: JsonSchemaInputOptions,
): Promise<ParsedAPI> {
  return parseOpenAPI(wrapJsonSchemaAsOpenAPI(schema, options));
}
