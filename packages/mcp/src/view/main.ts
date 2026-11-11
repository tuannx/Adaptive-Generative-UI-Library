/// <reference lib="dom" />
/**
 * Browser entry of the MCP Apps view (ui://agul/view.html).
 * Bundled into one HTML file by scripts/build-view.mjs; never imported by the server.
 */
import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { renderView } from './render.js';

const root = document.getElementById('root');
const app = new App({ name: 'agul-view', version: '0.1.0' });

function applyHostContext(): void {
  const context = app.getHostContext();
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
}

app.ontoolinput = () => {
  if (root) root.innerHTML = '<p class="muted">Generating UI…</p>';
};

app.ontoolresult = (result) => {
  if (!root) return;
  root.innerHTML = result.isError ? '<p class="muted">AGUL could not generate a UI for this spec.</p>' : renderView(result.structuredContent);
};

app.onhostcontextchanged = applyHostContext;

void app.connect().then(applyHostContext);
