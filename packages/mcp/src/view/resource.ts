import { readFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RESOURCE_MIME_TYPE, registerAppResource } from '@modelcontextprotocol/ext-apps/server';

/** The MCP Apps view both tools point to through `_meta.ui.resourceUri`. */
export const AGUL_VIEW_URI = 'ui://agul/view.html';

const FALLBACK_HTML =
  '<!doctype html><html><body><p>AGUL view is not built. Run <code>npm run build</code> in packages/mcp.</p></body></html>';

// Built server code sits next to view.html in dist/; source files (tests, dev) reach it in ../../dist/.
const candidates = [new URL('./view.html', import.meta.url), new URL('../../dist/view.html', import.meta.url)];

export async function loadViewHtml(): Promise<string> {
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {
      // try the next location
    }
  }
  return FALLBACK_HTML;
}

export function registerAgulView(server: McpServer): void {
  registerAppResource(
    server,
    'AGUL view',
    AGUL_VIEW_URI,
    { description: 'Shows the admin UI AGUL generated: resources, pages and layout decisions.' },
    async () => ({ contents: [{ uri: AGUL_VIEW_URI, mimeType: RESOURCE_MIME_TYPE, text: await loadViewHtml() }] }),
  );
}
