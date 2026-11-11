import type { SchemaObject } from '@aikitstudio/agul-core';

export { parseOpenAPISync, planUi } from '@aikitstudio/agul-core';

/** The agent's proposed values: every `default`, nested objects included (what the form starts with). */
export function schemaDefaultsForTest(schema: SchemaObject | undefined): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, property] of Object.entries(schema?.properties ?? {})) {
    if (property.properties) values[key] = schemaDefaultsForTest(property);
    else if (property.default !== undefined) values[key] = property.default;
  }
  return values;
}
