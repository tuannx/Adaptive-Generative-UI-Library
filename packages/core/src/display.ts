/**
 * How a value should be shown (not edited): money, percent, dates, status tags, links.
 * Pure functions, so the antd renderer and a headless host format the same way.
 *
 * The hint comes from, in order: `x-agul-display` on the schema, the schema `format`,
 * the field name, then the value itself.
 */
import type { SchemaObject } from './types.js';

export type DisplayKind =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'status'
  | 'boolean'
  | 'email'
  | 'url'
  | 'image'
  | 'tags'
  | 'json';

export const DISPLAY_KINDS: readonly DisplayKind[] = [
  'text', 'number', 'currency', 'percent', 'date', 'datetime', 'status',
  'boolean', 'email', 'url', 'image', 'tags', 'json',
];

export type DisplayTone = 'positive' | 'negative' | 'attention' | 'neutral';

export interface DisplayHint {
  kind: DisplayKind;
  /** ISO 4217 code for `currency`. Without one, money shows as a plain number with 2 decimals. */
  currency?: string;
  /** For `percent`: `fraction` means 0.42 is 42%; `percent` (the default) means 42 is 42%. */
  scale?: 'fraction' | 'percent';
}

// `total`, `balance`, `rate` and `ratio` are left out on purpose: they are often counts or plain numbers
// (a pagination total, an exchange rate, a heart rate). Use `format` or `x-agul-display` for those.
const CURRENCY_NAME = /(price|amount|cost|revenue|salary|fee|budget|spend|income|mrr|arr)$/i;
const PERCENT_NAME = /(percent|percentage|pct)$/i;
const STATUS_NAME = /^(status|state|stage|phase|priority|severity|level)$/i;
const IMAGE_NAME = /(image|img|photo|picture|avatar|thumbnail|thumb|cover|logo|icon)(url|uri|src)?$/i;
const DATE_NAME = /(date|_at|day|time|stamp|created|updated|deadline|due|_on)$/i;
const AT_NAME = /[a-z]At$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const HTTP_URL = /^https?:\/\//i;
const IMAGE_EXT = /\.(jpe?g|png|gif|bmp|svg|webp|avif)(\?.*)?$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isDateName = (name: string): boolean => DATE_NAME.test(name) || AT_NAME.test(name);

function readExtension(schema: SchemaObject | undefined): DisplayHint | undefined {
  const raw = schema?.['x-agul-display'];
  if (typeof raw === 'string' && (DISPLAY_KINDS as readonly string[]).includes(raw)) return { kind: raw as DisplayKind };
  if (raw && typeof raw === 'object') {
    const { kind, currency, scale } = raw as { kind?: unknown; currency?: unknown; scale?: unknown };
    if (typeof kind === 'string' && (DISPLAY_KINDS as readonly string[]).includes(kind)) {
      return {
        kind: kind as DisplayKind,
        currency: typeof currency === 'string' ? currency.toUpperCase() : undefined,
        scale: scale === 'fraction' || scale === 'percent' ? scale : undefined,
      };
    }
  }
  return undefined;
}

function fromFormat(schema: SchemaObject | undefined): DisplayKind | undefined {
  switch (schema?.format) {
    case 'date':
      return 'date';
    case 'date-time':
      return 'datetime';
    case 'email':
      return 'email';
    case 'uri':
    case 'url':
      return 'url';
    case 'currency':
    case 'money':
      return 'currency';
    case 'percent':
      return 'percent';
    default:
      return undefined;
  }
}

function fromValue(value: unknown): DisplayKind {
  if (value === null || value === undefined) return 'text';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return value.every((item) => typeof item !== 'object' || item === null) ? 'tags' : 'json';
  if (typeof value === 'object') return 'json';
  const text = String(value);
  if (HTTP_URL.test(text)) return IMAGE_EXT.test(text) ? 'image' : 'url';
  if (EMAIL.test(text)) return 'email';
  return 'text';
}

/** A percent field whose schema caps it at 1 holds fractions (0.42 = 42%). */
function withPercentScale(hint: DisplayHint, schema: SchemaObject | undefined): DisplayHint {
  if (hint.kind !== 'percent' || hint.scale) return hint;
  return typeof schema?.maximum === 'number' && schema.maximum <= 1 ? { ...hint, scale: 'fraction' } : hint;
}

/** Picks how to show one field. `value` is a sample used only when the schema and name say nothing. */
export function resolveDisplay(name: string, schema?: SchemaObject, value?: unknown): DisplayHint {
  return withPercentScale(resolveKind(name, schema, value), schema);
}

function resolveKind(name: string, schema: SchemaObject | undefined, value: unknown): DisplayHint {
  const extension = readExtension(schema);
  if (extension) return extension;

  const format = fromFormat(schema);
  if (format) return { kind: format };

  const numeric = schema ? schema.type === 'number' || schema.type === 'integer' : typeof value === 'number';
  if (numeric && CURRENCY_NAME.test(name)) return { kind: 'currency' };
  if (numeric && PERCENT_NAME.test(name)) return { kind: 'percent' };
  if (numeric) return { kind: 'number' };

  if (schema?.type === 'boolean') return { kind: 'boolean' };
  if (schema?.type === 'array') return { kind: schema.items?.type === 'object' ? 'json' : 'tags' };
  if (STATUS_NAME.test(name) && (schema?.enum || typeof value === 'string')) return { kind: 'status' };

  if (typeof value === 'string') {
    if (IMAGE_NAME.test(name) && HTTP_URL.test(value)) return { kind: 'image' };
    if (ISO_DATETIME.test(value) && isDateName(name)) return { kind: 'datetime' };
    if (ISO_DATE.test(value) && isDateName(name)) return { kind: 'date' };
  }
  return { kind: fromValue(value) };
}

const POSITIVE = /^(active|enabled|done|completed?|success(ful)?|paid|approved|available|online|live|published|resolved|ok|healthy|won)$/i;
const NEGATIVE = /^(failed|failure|error|cancel(l)?ed|rejected|declined|blocked|overdue|offline|lost|deleted|expired|critical|unpaid)$/i;
const ATTENTION = /^(open|pending|waiting|in[_ -]?progress|processing|draft|review|on[_ -]?hold|high|warning|scheduled|queued)$/i;

/** Colour family for a status-like value; hosts map tones to their own theme. */
export function statusTone(value: unknown): DisplayTone {
  const text = String(value ?? '').trim();
  if (POSITIVE.test(text)) return 'positive';
  if (NEGATIVE.test(text)) return 'negative';
  if (ATTENTION.test(text)) return 'attention';
  return 'neutral';
}

export interface FormatOptions {
  locale?: string;
}

function toDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const date = new Date(typeof value === 'string' && ISO_DATE.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Text for a value under a hint. Values that don't fit the hint fall back to plain text. */
export function formatDisplayValue(value: unknown, hint: DisplayHint, options: FormatOptions = {}): string {
  if (value === null || value === undefined || value === '') return '-';
  const { locale } = options;
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;

  switch (hint.kind) {
    case 'currency':
      if (Number.isFinite(number)) {
        // No currency code means we don't know the currency, so no symbol: guessing USD would be wrong elsewhere.
        if (!hint.currency) {
          return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
        }
        return new Intl.NumberFormat(locale, { style: 'currency', currency: hint.currency }).format(number);
      }
      break;
    case 'percent':
      if (Number.isFinite(number)) {
        const fraction = hint.scale === 'fraction' ? number : number / 100;
        return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(fraction);
      }
      break;
    case 'number':
      if (Number.isFinite(number)) return new Intl.NumberFormat(locale).format(number);
      break;
    case 'date': {
      const date = toDate(value);
      if (date) return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
      break;
    }
    case 'datetime': {
      const date = toDate(value);
      if (date) return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
      break;
    }
    case 'boolean':
      return value === true || value === 'true' ? 'Yes' : value === false || value === 'false' ? 'No' : String(value);
    case 'tags':
      if (Array.isArray(value)) return value.map(String).join(', ');
      break;
    case 'json':
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    default:
      break;
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
