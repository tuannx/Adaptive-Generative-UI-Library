/**
 * Turns a generate_ui_* result into the HTML the MCP Apps view shows.
 * Pure string work (no DOM), so it runs and is tested in Node.
 */

type Row = Record<string, unknown>;

const escapeMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => escapeMap[char] ?? char);
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => !!item && typeof item === 'object') : [];
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function chips(values: string[], className = 'chip'): string {
  return values.map((value) => `<span class="${className}">${escapeHtml(value)}</span>`).join('');
}

function renderResources(resources: Row[]): string {
  if (resources.length === 0) return '';
  const cards = resources
    .map(
      (resource) => `<article class="card">
  <h3>${escapeHtml(resource.label)} <code>${escapeHtml(resource.key)}</code></h3>
  <div class="row">${chips(asStrings(resource.operations), 'chip op')}</div>
  <div class="row muted">${chips(asStrings(resource.fields))}</div>
</article>`,
    )
    .join('');
  return `<section><h2>Resources</h2><div class="grid">${cards}</div></section>`;
}

function renderPages(pages: Row[]): string {
  if (pages.length === 0) return '';
  const items = pages
    .map(
      (page) =>
        `<li><span class="chip op">${escapeHtml(page.kind)}</span> ${escapeHtml(page.label)} <code>${escapeHtml(
          String(page.method ?? '').toUpperCase(),
        )} ${escapeHtml(page.apiEndpoint)}</code></li>`,
    )
    .join('');
  return `<section><h2>Pages</h2><ul class="list">${items}</ul></section>`;
}

function renderDecisions(decisions: unknown): string {
  if (!decisions || typeof decisions !== 'object') return '';
  const rows = Object.entries(decisions as Record<string, Row>)
    .map(
      ([operationId, decision]) =>
        `<tr><td><code>${escapeHtml(operationId)}</code></td><td>${escapeHtml(decision?.kind)}</td><td class="muted">${escapeHtml(
          decision?.source,
        )}</td></tr>`,
    )
    .join('');
  if (!rows) return '';
  return `<section><h2>Decisions</h2><table><thead><tr><th>Operation</th><th>Shown as</th><th>Decided by</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderEmbed(embed: unknown): string {
  const value = (embed ?? {}) as Row;
  if (!value.react) return '';
  return `<section><h2>Use it in React</h2><pre>${escapeHtml(value.install)}</pre><pre>${escapeHtml(value.react)}</pre></section>`;
}

export function renderView(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return '<p class="muted">No UI was generated.</p>';
  }
  const config = result as Row;
  const api = (config.api ?? {}) as Row;
  const title = api.title ? `${escapeHtml(api.title)}${api.version ? ` <span class="muted">v${escapeHtml(api.version)}</span>` : ''}` : 'Generated UI';

  return `<header><h1>${title}</h1><p class="muted">${escapeHtml(config.baseUrl)} · ${escapeHtml(config.routeCount)} routes</p></header>
${renderResources(asRows(config.resources))}
${renderPages(asRows(config.pages))}
${renderDecisions(config.decisions)}
${renderEmbed(config.embed)}`;
}
