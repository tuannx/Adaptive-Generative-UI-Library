import type { GeneratedUIConfig } from '../generate-ui.js';

/**
 * Wraps a generated config as an MCP tool result.
 * `structuredContent` is what UI-capable hosts (MCP Apps) render; the same JSON stays in a text
 * block, as the MCP spec asks for backwards compatibility with clients that only read `content`.
 */
export function toToolResult(result: GeneratedUIConfig) {
  // JSON round trip drops `undefined` fields so the structured result is plain JSON.
  const structuredContent = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    structuredContent,
  };
}
