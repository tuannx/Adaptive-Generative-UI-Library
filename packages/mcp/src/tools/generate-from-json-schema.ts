import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { generateUIFromJsonSchema } from '../generate-ui.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { generatedUIOutputShape } from '../output-schema.js';
import { AGUL_VIEW_URI } from '../view/resource.js';
import { toToolResult } from './to-tool-result.js';

export function registerGenerateFromJsonSchema(server: McpServer): void {
  registerAppTool(
    server,
    'generate_ui_from_json_schema',
    {
      title: 'Generate UI from JSON Schema',
      description: 'Generate AGUL React admin UI configuration from a plain JSON Schema (no OpenAPI wrapper)',
      inputSchema: {
        schema: z.record(z.string(), z.unknown()).describe('JSON Schema object describing a resource'),
        baseUrl: z.string().describe('API base URL for generated REST endpoints'),
        resourcePath: z.string().optional().describe('REST resource path (e.g. /pets)'),
        title: z.string().optional().describe('Resource title override'),
        idParam: z.string().optional().describe('Path id parameter name (default: id)'),
        previewBaseUrl: z.string().optional().describe('Demo app URL for preview (e.g. http://localhost:5173)'),
      },
      outputSchema: generatedUIOutputShape,
      _meta: { ui: { resourceUri: AGUL_VIEW_URI } },
    },
    async ({ schema, baseUrl, resourcePath, title, idParam, previewBaseUrl }) =>
      toToolResult(await generateUIFromJsonSchema(schema, { baseUrl, resourcePath, title, idParam, previewBaseUrl })),
  );
}
