#!/usr/bin/env node
// Measures how much usable UI @agul/core derives from real-world OpenAPI specs.
// Usage: node scripts/measure-specs.mjs <dir-with-json-or-yaml-specs> [--json]
import { readdirSync, readFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { load as loadYaml, CORE_SCHEMA, mergeTag } from 'js-yaml';
import { parseOpenAPISync, planUi, isPrimitiveSchema } from '@agul/core';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/measure-specs.mjs <spec-dir> [--json]');
  process.exit(1);
}

function load(file) {
  const text = readFileSync(file, 'utf8');
  return ['.yaml', '.yml'].includes(extname(file)) ? loadYaml(text, { schema: CORE_SCHEMA.withTags(mergeTag) }) : JSON.parse(text);
}

function countColumns(schema) {
  return Object.values(schema?.properties ?? {}).filter(isPrimitiveSchema).length;
}

function countFields(schema) {
  return Object.values(schema?.properties ?? {}).filter((p) => !p.readOnly).length;
}

function measure(file) {
  const started = performance.now();
  const spec = load(file);
  const api = parseOpenAPISync(spec);
  const { resources, pages, menu, decisions } = planUi(api);
  const ms = Math.round(performance.now() - started);

  const lists = resources.filter((r) => r.list);
  const linkableLists = lists.filter((r) => !r.paths.list.includes(':'));
  return {
    spec: basename(file),
    version: spec.openapi ?? spec.swagger,
    endpoints: api.endpoints.length,
    resources: resources.length,
    lists: lists.length,
    linkableLists: linkableLists.length,
    listsWithColumns: lists.filter((r) => countColumns(r.recordSchema) > 0).length,
    details: resources.filter((r) => r.paths.detail).length,
    createForms: resources.filter((r) => r.create && countFields(r.create.schema) > 0).length,
    editForms: resources.filter((r) => r.update && countFields(r.update.schema) > 0).length,
    deletes: resources.filter((r) => r.remove).length,
    fullCrud: resources.filter((r) => r.list && r.detail && r.create && r.update && r.remove).length,
    actionPages: pages.filter((p) => p.kind === 'action').length,
    chatPages: pages.filter((p) => p.kind === 'chat').length,
    hidden: [...decisions.values()].filter((d) => d.kind === 'hidden').length,
    coverage: Math.round((100 * [...decisions.values()].filter((d) => d.kind !== 'hidden').length) / api.endpoints.length),
    menuItems: menu.reduce((n, g) => n + (g.children?.length ?? 0), 0),
    absoluteBaseUrl: /^https?:\/\//.test(api.baseUrl),
    ms,
  };
}

const rows = [];
for (const name of readdirSync(dir).sort()) {
  if (!/\.(json|ya?ml)$/.test(name)) continue;
  try {
    rows.push(measure(join(dir, name)));
  } catch (err) {
    rows.push({ spec: name, error: err instanceof Error ? err.message : String(err) });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.table(rows);
}
