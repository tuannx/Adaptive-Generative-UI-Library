import type { SchemaObject } from './types.js';

function refName(ref: string): string {
  return ref.split('/').pop() ?? ref;
}

function mergeAllOf(parts: SchemaObject[]): SchemaObject {
  const merged: SchemaObject = { type: 'object', properties: {}, required: [] };

  for (const part of parts) {
    const { properties, required, allOf: _allOf, ...rest } = part;
    Object.assign(merged, rest);
    Object.assign(merged.properties!, properties);
    merged.required!.push(...(required ?? []));
  }

  merged.required = [...new Set(merged.required)];
  return merged;
}

/**
 * Inline every `$ref` and flatten `allOf`, so UI code never needs the schema registry.
 * Recursive references are cut off with a `{ type: 'object', title }` stub.
 */
export function dereferenceSchema(
  schema: SchemaObject | undefined,
  schemas: Record<string, SchemaObject>,
  seen: ReadonlySet<string> = new Set(),
): SchemaObject | undefined {
  if (!schema) return undefined;

  if (schema.$ref) {
    const name = refName(schema.$ref);
    const target = schemas[name];
    if (!target || seen.has(name)) {
      return { type: 'object', title: name };
    }
    const { $ref: _ref, ...siblings } = schema;
    const resolved = dereferenceSchema(target, schemas, new Set([...seen, name]))!;
    return { title: name, ...resolved, ...siblings };
  }

  let result: SchemaObject = { ...schema };

  if (schema.allOf?.length) {
    const { allOf, ...own } = schema;
    const parts = allOf.map((part) => dereferenceSchema(part, schemas, seen)!);
    result = mergeAllOf([...parts, own]);
  }

  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [
        key,
        dereferenceSchema(value, schemas, seen)!,
      ]),
    );
  }

  if (result.items) {
    result.items = dereferenceSchema(result.items, schemas, seen);
  }

  for (const key of ['oneOf', 'anyOf'] as const) {
    if (result[key]) {
      result[key] = result[key]!.map((part) => dereferenceSchema(part, schemas, seen)!);
    }
  }

  return result;
}

/**
 * For list responses, return the schema of a single row:
 * `T[]`, `{ data: T[] }` and `{ items: T[] }` are recognised.
 */
export function getListItemSchema(schema: SchemaObject | undefined): SchemaObject | undefined {
  if (!schema) return undefined;
  if (schema.type === 'array') return schema.items;

  for (const key of ['data', 'items', 'results', 'content']) {
    const wrapped = schema.properties?.[key];
    if (wrapped?.type === 'array') return wrapped.items;
  }

  return undefined;
}

const PRIMITIVE_TYPES = new Set(['string', 'number', 'integer', 'boolean']);

export function isPrimitiveSchema(schema: SchemaObject | undefined): boolean {
  return !!schema && PRIMITIVE_TYPES.has(schema.type ?? '');
}
