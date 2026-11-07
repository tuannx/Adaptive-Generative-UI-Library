/**
 * Picks a read-only presentation for API data: KPI stats, a card grid, a timeline, or the
 * default table / key-value record. Pure and deterministic, so tests and headless hosts agree.
 *
 * A schema can pin the choice with `x-agul-present: stats | cards | timeline | table | record`.
 */
import { resolveDisplay, type DisplayHint } from './display.js';
import type { SchemaObject } from './types.js';

export type PresentKind = 'stats' | 'cards' | 'timeline' | 'table' | 'record';
export const PRESENT_KINDS: readonly PresentKind[] = ['stats', 'cards', 'timeline', 'table', 'record'];

export interface PresentField {
  key: string;
  display: DisplayHint;
}

export interface PresentPlan {
  kind: PresentKind;
  /** Numeric fields shown as KPI cards (`stats`, and above a `record`). */
  metrics: PresentField[];
  /** Row fields used by `cards` / `timeline`. */
  title?: string;
  subtitle?: string;
  image?: string;
  date?: string;
  /** How to show the `date` field, from its schema. */
  dateDisplay?: DisplayHint;
  status?: string;
  /** Other short fields worth a line on a card or timeline item. */
  extra: PresentField[];
}

type Row = Record<string, unknown>;

const TITLE_NAMES = ['title', 'name', 'label', 'subject', 'headline', 'summary', 'question', 'card', 'displayName', 'fullName'];
const SUBTITLE_NAMES = ['description', 'subtitle', 'body', 'message', 'content', 'text', 'detail', 'notes', 'email'];
const ID_NAME = /^(id|_id|uuid|key)$|Id$|_id$/;
const MAX_STATS = 8;
const MAX_TIMELINE_ROWS = 50;
const MAX_EXTRA = 3;

function isRow(value: unknown): value is Row {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sampleKeys(rows: Row[], schema?: SchemaObject): string[] {
  if (schema?.properties) return Object.keys(schema.properties);
  return [...new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row)))];
}

function firstPresent(rows: Row[], key: string): unknown {
  for (const row of rows.slice(0, 20)) {
    if (row[key] !== null && row[key] !== undefined && row[key] !== '') return row[key];
  }
  return undefined;
}

function fieldsOf(rows: Row[], schema?: SchemaObject): PresentField[] {
  return sampleKeys(rows, schema).map((key) => ({
    key,
    display: resolveDisplay(key, schema?.properties?.[key], firstPresent(rows, key)),
  }));
}

function pickNamed(fields: PresentField[], names: string[], kinds: string[] = ['text']): string | undefined {
  const lower = new Map(fields.map((field) => [field.key.toLowerCase(), field]));
  for (const name of names) {
    const field = lower.get(name.toLowerCase());
    if (field && kinds.includes(field.display.kind)) return field.key;
  }
  return undefined;
}

function readPinned(schema?: SchemaObject): PresentKind | undefined {
  const raw = schema?.['x-agul-present'];
  return typeof raw === 'string' && (PRESENT_KINDS as readonly string[]).includes(raw) ? (raw as PresentKind) : undefined;
}

const METRIC_KINDS = new Set(['number', 'currency', 'percent']);

/** Plan for a list of rows. `schema` is the row (item) schema when known. */
export function planRows(rows: Row[], schema?: SchemaObject): PresentPlan {
  const fields = fieldsOf(rows, schema);
  const title = pickNamed(fields, TITLE_NAMES);
  const subtitle = pickNamed(fields, SUBTITLE_NAMES, ['text', 'email']);
  const image = fields.find((field) => field.display.kind === 'image')?.key;
  const dateField = fields.find((field) => field.display.kind === 'date' || field.display.kind === 'datetime');
  const date = dateField?.key;
  const status = fields.find((field) => field.display.kind === 'status')?.key;
  const used = new Set([title, subtitle, image, date, status]);
  const extra = fields
    .filter((field) => !used.has(field.key) && !ID_NAME.test(field.key) && field.display.kind !== 'json')
    .slice(0, MAX_EXTRA);
  const base = { metrics: [], title, subtitle, image, date, dateDisplay: dateField?.display, status, extra };

  const pinned = readPinned(schema);
  if (pinned === 'cards' || pinned === 'timeline' || pinned === 'table') return { kind: pinned, ...base };

  if (title && image) return { kind: 'cards', ...base };
  if (title && date && rows.length <= MAX_TIMELINE_ROWS) return { kind: 'timeline', ...base };
  return { kind: 'table', ...base };
}

/** Plan for one record: numeric fields become KPI stats; mostly-numeric records are `stats` only. */
export function planRecord(record: Row, schema?: SchemaObject): PresentPlan {
  const fields = fieldsOf([record], schema).filter((field) => !ID_NAME.test(field.key));
  const metrics = fields
    .filter((field) => METRIC_KINDS.has(field.display.kind) && typeof record[field.key] === 'number')
    .slice(0, MAX_STATS);
  const primitive = fields.filter((field) => {
    const value = record[field.key];
    return value === null || typeof value !== 'object';
  });

  const pinned = readPinned(schema);
  if (pinned === 'stats' || pinned === 'record') return { kind: pinned, metrics, extra: [] };

  const mostlyNumbers = metrics.length >= 2 && metrics.length * 2 >= primitive.length;
  return { kind: mostlyNumbers ? 'stats' : 'record', metrics: metrics.length >= 2 ? metrics : [], extra: [] };
}

/** Plan for any API value: rows, a record, or nothing to plan (`undefined`). */
export function planPresentation(value: unknown, schema?: SchemaObject): PresentPlan | undefined {
  if (Array.isArray(value)) {
    const rows = value.filter(isRow);
    if (rows.length === 0 || rows.length !== value.length) return undefined;
    return planRows(rows, schema?.type === 'array' ? schema.items : schema);
  }
  if (isRow(value)) return planRecord(value, schema);
  return undefined;
}
