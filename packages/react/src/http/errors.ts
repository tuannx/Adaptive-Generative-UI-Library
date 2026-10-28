export interface FieldError {
  name: (string | number)[];
  errors: string[];
}

export interface ApiErrorInfo {
  status?: number;
  /** One line for a toast or an alert. */
  message: string;
  /** Validation errors mapped to form fields (`{ errors: [...] }`, Rails/Laravel maps, FastAPI `detail`, Spring). */
  fieldErrors: FieldError[];
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad request',
  401: 'Not signed in, or the session expired',
  403: "You don't have permission",
  404: 'Not found',
  409: 'Conflict',
  413: 'Too large',
  422: 'Validation failed',
  429: 'Too many requests — try again shortly',
};

type Json = Record<string, unknown>;

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const record = value as Json;
    return text(record.message) ?? text(record.msg) ?? text(record.defaultMessage) ?? text(record.title);
  }
  return undefined;
}

function messageOf(body: unknown): string | undefined {
  if (typeof body === 'string') {
    const stripped = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return stripped ? stripped.slice(0, 300) : undefined;
  }
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Json;
  const nested = record.error && typeof record.error === 'object' ? (record.error as Json) : undefined;
  return (
    text(record.message) ??
    (typeof record.detail === 'string' ? record.detail : undefined) ??
    text(record.error_description) ??
    text(nested?.message) ??
    text(record.error) ??
    text(record.title) ??
    (Array.isArray(record.errors) ? text(record.errors[0]) : undefined) ??
    (Array.isArray(record.detail) ? text(record.detail[0]) : undefined)
  );
}

function splitPath(path: string): (string | number)[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

function fieldErrorsOf(body: unknown): FieldError[] {
  if (!body || typeof body !== 'object') return [];
  const record = body as Json;
  const found: FieldError[] = [];

  const fromList = (items: unknown[]) => {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Json;
      const message = text(entry);
      if (!message) continue;
      if (Array.isArray(entry.loc)) {
        const path = entry.loc.filter((part, index) => !(index === 0 && ['body', 'query', 'path'].includes(String(part))));
        if (path.length > 0) found.push({ name: path as (string | number)[], errors: [message] });
        continue;
      }
      const field = entry.field ?? entry.propertyPath ?? entry.path ?? entry.param ?? entry.property ?? entry.name ?? entry.pointer;
      if (typeof field === 'string' && field) {
        found.push({ name: splitPath(field.replace(/^\/(data\/attributes\/)?/, '').replace(/\//g, '.')), errors: [message] });
      }
    }
  };

  if (Array.isArray(record.errors)) fromList(record.errors);
  else if (record.errors && typeof record.errors === 'object') {
    for (const [field, value] of Object.entries(record.errors as Json)) {
      const messages = (Array.isArray(value) ? value : [value]).map(text).filter((item): item is string => !!item);
      if (messages.length > 0) found.push({ name: splitPath(field), errors: messages });
    }
  }
  if (Array.isArray(record.detail)) fromList(record.detail);
  if (Array.isArray(record.violations)) fromList(record.violations);
  return found;
}

export function describeResponseError(status: number | undefined, body: unknown): ApiErrorInfo {
  const detail = messageOf(body);
  const label = status ? STATUS_TEXT[status] ?? (status >= 500 ? 'Server error' : `Request failed`) : 'Request failed';
  const message = status
    ? detail && detail.toLowerCase() !== label.toLowerCase()
      ? `${label} (HTTP ${status}): ${detail}`
      : `${label} (HTTP ${status})`
    : detail ?? label;
  return { status, message, fieldErrors: fieldErrorsOf(body) };
}

/** Readable message and field errors for an axios error, a failed `fetch`, or anything thrown. */
export function describeApiError(error: unknown): ApiErrorInfo {
  const response = (error as { response?: { status?: number; data?: unknown } } | undefined)?.response;
  if (response) return describeResponseError(response.status, response.data);
  const code = (error as { code?: string } | undefined)?.code;
  if (code === 'ERR_NETWORK' || (error instanceof TypeError && /fetch/i.test(error.message))) {
    return {
      message: "The API couldn't be reached — it may be offline, or block calls from this site (CORS). A proxy can help.",
      fieldErrors: [],
    };
  }
  return { message: error instanceof Error ? error.message : String(error), fieldErrors: [] };
}

/** Builds an error describing a non-OK `fetch` response. */
export async function responseError(response: Response): Promise<Error & { info: ApiErrorInfo }> {
  const raw = await response.text().catch(() => '');
  let body: unknown = raw;
  try {
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    // not JSON
  }
  const info = describeResponseError(response.status, body);
  return Object.assign(new Error(info.message), { info });
}
