/**
 * Serialise a form payload for the operation's media type. Nested values use bracket
 * notation (`metadata[plan]=pro`), the convention of Stripe, Rails and PHP backends.
 */
export function encodeBody(payload: Record<string, unknown>, contentType = 'application/json'): unknown {
  const isForm = contentType === 'application/x-www-form-urlencoded';
  const isMultipart = contentType.startsWith('multipart/');
  if (!isForm && !isMultipart) return payload;

  const entries: Array<[string, string | Blob]> = [];
  const walk = (value: unknown, key: string) => {
    if (value === undefined || value === null) return;
    if (typeof Blob !== 'undefined' && value instanceof Blob) entries.push([key, value]);
    else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${key}[${index}]`));
    else if (typeof value === 'object') Object.entries(value as Record<string, unknown>).forEach(([k, v]) => walk(v, `${key}[${k}]`));
    else entries.push([key, String(value)]);
  };
  Object.entries(payload).forEach(([key, value]) => walk(value, key));

  if (isForm) return new URLSearchParams(entries as Array<[string, string]>).toString();
  const formData = new FormData();
  entries.forEach(([key, value]) => formData.append(key, value));
  return formData;
}
