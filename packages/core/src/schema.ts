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

/** How many `$ref` hops are inlined below a schema; UI never renders deeper than this. */
export const MAX_REF_DEPTH = 3;

const refCache = new WeakMap<Record<string, SchemaObject>, Map<string, SchemaObject>>();

/**
 * Inline `$ref`s (up to `depth` hops) and flatten `allOf`, so UI code never needs the schema registry.
 * Deeper and recursive references become a `{ type: 'object', title }` stub. Results are cached per
 * registry, so shared sub-schemas are resolved once and the output stays proportional to refs × depth.
 */
export function dereferenceSchema(
  schema: SchemaObject | undefined,
  schemas: Record<string, SchemaObject>,
  depth: number = MAX_REF_DEPTH,
): SchemaObject | undefined {
  if (!schema) return undefined;

  if (schema.$ref) {
    const name = refName(schema.$ref);
    const target = schemas[name];
    if (!target || depth <= 0) {
      return { type: 'object', title: name };
    }

    let cache = refCache.get(schemas);
    if (!cache) {
      cache = new Map();
      refCache.set(schemas, cache);
    }
    const key = `${depth}:${name}`;
    let resolved = cache.get(key);
    if (!resolved) {
      resolved = { title: name, ...dereferenceSchema(target, schemas, depth - 1)! };
      cache.set(key, resolved);
    }

    const { $ref: _ref, ...siblings } = schema;
    return Object.keys(siblings).length > 0 ? { ...resolved, ...siblings } : resolved;
  }

  let result: SchemaObject = { ...schema };

  if (schema.allOf?.length) {
    const { allOf, ...own } = schema;
    const parts = allOf.map((part) => dereferenceSchema(part, schemas, depth)!);
    result = mergeAllOf([...parts, own]);
  }

  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [
        key,
        dereferenceSchema(value, schemas, depth)!,
      ]),
    );
  }

  if (result.items) {
    result.items = dereferenceSchema(result.items, schemas, depth);
  }

  for (const key of ['oneOf', 'anyOf'] as const) {
    if (result[key]) {
      result[key] = result[key]!.map((part) => dereferenceSchema(part, schemas, depth)!);
    }
  }

  return result;
}

const ROW_KEYS = ['data', 'items', 'results', 'content', 'entries', 'records', 'values', 'nodes', 'edges'];

function isRecordSchema(schema: SchemaObject | undefined): boolean {
  return !!schema && (schema.type === 'object' || !!schema.properties || !!schema.title);
}

/**
 * Locate the rows of a list response. Recognises `T[]`, a conventional envelope key
 * (`{ data | items | results | entries ...: T[] }`), the only array-of-objects property
 * (`{ calls: T[], page, ... }`), and one level of single-object nesting (`{ topic_list: { topics: T[] } }`).
 */
export function findListRows(
  schema: SchemaObject | undefined,
  nested = true,
): { path: string[]; schema: SchemaObject | undefined } | undefined {
  if (!schema) return undefined;
  if (schema.type === 'array') return { path: [], schema: schema.items };

  const properties = schema.properties ?? {};
  for (const key of ROW_KEYS) {
    if (properties[key]?.type === 'array') return { path: [key], schema: properties[key].items };
  }

  const arrays = Object.entries(properties).filter(
    ([, property]) => property.type === 'array' && isRecordSchema(property.items),
  );
  if (arrays.length === 1) return { path: [arrays[0][0]], schema: arrays[0][1].items };

  if (nested && arrays.length === 0) {
    const objects = Object.entries(properties).filter(([, property]) => isRecordSchema(property));
    if (objects.length === 1) {
      const inner = findListRows(objects[0][1], false);
      if (inner && inner.path.length > 0) return { path: [objects[0][0], ...inner.path], schema: inner.schema };
    }
  }

  return undefined;
}

/** Row schema of a list response, see {@link findListRows}. */
export function getListItemSchema(schema: SchemaObject | undefined): SchemaObject | undefined {
  return findListRows(schema)?.schema;
}

const PRIMITIVE_TYPES = new Set(['string', 'number', 'integer', 'boolean']);

export function isPrimitiveSchema(schema: SchemaObject | undefined): boolean {
  return !!schema && PRIMITIVE_TYPES.has(schema.type ?? '');
}
