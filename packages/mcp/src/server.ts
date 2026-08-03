import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generateUIFromOpenAPI, generateUIFromJsonSchema } from './generate-ui.js';

const openApiSpecSchema = z.record(z.unknown());

export function createAGULMcpServer(): McpServer {
  const server = new McpServer({
    name: 'agul',
    version: '0.1.0',
  });

  server.tool(
    'generate_ui_from_openapi',
    'Generate AGUL React admin UI configuration from an OpenAPI/Swagger specification',
    {
      spec: openApiSpecSchema.describe('OpenAPI 3.0 or Swagger 2.0 specification object'),
      baseUrl: z.string().optional().describe('Override API base URL'),
      previewBaseUrl: z
        .string()
        .optional()
        .describe('Demo app URL for preview (e.g. http://localhost:5173)'),
    },
    async ({ spec, baseUrl, previewBaseUrl }) => {
      const result = await generateUIFromOpenAPI(spec, { baseUrl, previewBaseUrl });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'generate_ui_from_json_schema',
    'Generate AGUL React admin UI configuration from a plain JSON Schema (no OpenAPI wrapper)',
    {
      schema: openApiSpecSchema.describe('JSON Schema object describing a resource'),
      baseUrl: z.string().describe('API base URL for generated REST endpoints'),
      resourcePath: z.string().optional().describe('REST resource path (e.g. /pets)'),
      title: z.string().optional().describe('Resource title override'),
      idParam: z.string().optional().describe('Path id parameter name (default: id)'),
      previewBaseUrl: z
        .string()
        .optional()
        .describe('Demo app URL for preview (e.g. http://localhost:5173)'),
    },
    async ({ schema, baseUrl, resourcePath, title, idParam, previewBaseUrl }) => {
      const result = await generateUIFromJsonSchema(schema, {
        baseUrl,
        resourcePath,
        title,
        idParam,
        previewBaseUrl,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  return server;
}

export async function startAGULMcpServer(): Promise<void> {
  const server = createAGULMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
