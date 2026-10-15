export function formatLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function isImageUrl(value: string): boolean {
  return isHttpUrl(value) && /\.(jpe?g|png|gif|bmp|svg|webp)(\?.*)?$/i.test(value);
}

const LIST_ENVELOPE_KEYS = ['data', 'items', 'results', 'content'];
const RECORD_ENVELOPE_KEYS = new Set(['data', 'meta', 'links', 'included', 'success', 'message', 'status', 'code']);

/** Rows of a list response: `T[]`, or the array inside `{ data | items | results | content }`. */
export function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of LIST_ENVELOPE_KEYS) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
    return [payload];
  }
  return [];
}

/** A single record, unwrapping `{ data: T, meta?, ... }` envelopes only. */
export function unwrapRecord(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const isEnvelope =
      record.data !== null &&
      typeof record.data === 'object' &&
      !Array.isArray(record.data) &&
      Object.keys(record).every((key) => RECORD_ENVELOPE_KEYS.has(key));
    if (isEnvelope) return record.data;
  }
  return payload;
}
