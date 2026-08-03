import type { AgulFieldPlugin, AgulFieldRenderContext } from './types.js';
import { readSchemaWidget } from './schema-extensions.js';

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function matchesFieldName(pattern: string | RegExp, name: string): boolean {
  return typeof pattern === 'string' ? pattern === name : pattern.test(name);
}

function matchesPlugin(plugin: AgulFieldPlugin, context: AgulFieldRenderContext): boolean {
  if (plugin.match?.(context)) {
    return true;
  }

  const widget = readSchemaWidget(context.schema);
  if (plugin.widget && widget) {
    if (asArray(plugin.widget).includes(widget)) {
      return true;
    }
  }

  if (plugin.format && context.schema.format) {
    if (asArray(plugin.format).includes(context.schema.format)) {
      return true;
    }
  }

  if (plugin.type && context.schema.type) {
    if (asArray(plugin.type).includes(context.schema.type)) {
      return true;
    }
  }

  if (plugin.fieldName && matchesFieldName(plugin.fieldName, context.name)) {
    return true;
  }

  return false;
}

export function resolveFieldPlugin(
  plugins: AgulFieldPlugin[],
  context: AgulFieldRenderContext,
): AgulFieldPlugin | undefined {
  return [...plugins]
    .filter((plugin) => matchesPlugin(plugin, context))
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0];
}
