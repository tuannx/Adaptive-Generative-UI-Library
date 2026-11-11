import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { generateUIFromOpenAPI } from '../generate-ui.js';
import { generatedUIOutputShape } from '../output-schema.js';
import { toToolResult } from './to-tool-result.js';

const specSchema = z.record(z.string(), z.unknown());

const decisionSchema = z.object({
  operationId: z.string(),
  kind: z.enum(['crud', 'action', 'chat', 'hidden']),
  label: z.string().optional(),
  group: z.string().optional(),
  chat: z
    .object({
      messageField: z.string().optional(),
      historyField: z.string().optional(),
      sessionField: z.string().optional(),
      replyPath: z.string().optional(),
    })
    .optional(),
});

export function registerGenerateFromOpenApi(server: McpServer): void {
  server.registerTool(
    'generate_ui_from_openapi',
    {
      title: 'Generate UI from OpenAPI',
      description:
        'Generate AGUL React admin UI configuration from an OpenAPI/Swagger specification. Every operation becomes a CRUD page, an action form, a chat UI or is hidden. Call once with includeOperationSummaries to see what AGUL decided and why, then again with your own `decisions` to change it.',
      inputSchema: {
        spec: specSchema.describe('OpenAPI 3.0 or Swagger 2.0 specification object'),
        baseUrl: z.string().optional().describe('Override API base URL'),
        previewBaseUrl: z.string().optional().describe('Demo app URL for preview (e.g. http://localhost:5173)'),
        includeOperationSummaries: z
          .boolean()
          .optional()
          .describe('Return per-operation summaries with the decision schema and instructions'),
        decisions: z
          .array(decisionSchema)
          .optional()
          .describe('Your layout decisions; x-agul-view in the spec still wins, invalid entries are ignored'),
      },
      outputSchema: generatedUIOutputShape,
    },
    async ({ spec, baseUrl, previewBaseUrl, includeOperationSummaries, decisions }) =>
      toToolResult(await generateUIFromOpenAPI(spec, { baseUrl, previewBaseUrl, includeOperationSummaries, decisions })),
  );
}
