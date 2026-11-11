import { z } from 'zod';

/**
 * Output schema of both generate_ui_* tools (the shape of `GeneratedUIConfig`).
 * Kept loose on nested objects that come straight from agul-core (menu, api, decision schema),
 * so a new core field never makes the SDK reject a tool result.
 */
export const generatedUIOutputShape = {
  baseUrl: z.string(),
  api: z.looseObject({
    title: z.string().optional(),
    version: z.string().optional(),
    baseUrl: z.string().optional(),
    basePath: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  routeCount: z.number(),
  menu: z.array(z.unknown()),
  resources: z.array(
    z.looseObject({
      key: z.string(),
      label: z.string(),
      tag: z.string(),
      operations: z.array(z.string()),
      fields: z.array(z.string()),
      params: z.array(z.string()),
    }),
  ),
  pages: z.array(
    z.looseObject({
      operationId: z.string(),
      kind: z.enum(['action', 'chat']),
      label: z.string(),
      path: z.string(),
      method: z.string(),
      apiEndpoint: z.string(),
      stream: z.string(),
    }),
  ),
  decisions: z.record(z.string(), z.looseObject({ kind: z.string(), source: z.string(), label: z.string().optional() })),
  decisionInput: z
    .looseObject({ instructions: z.string(), schema: z.unknown(), operations: z.array(z.unknown()) })
    .optional(),
  routes: z.array(
    z.looseObject({
      path: z.string(),
      component: z.string(),
      method: z.string(),
      summary: z.string().optional(),
      apiEndpoint: z.string(),
    }),
  ),
  embed: z.object({ react: z.string(), install: z.string() }),
  previewUrl: z.string().optional(),
};
