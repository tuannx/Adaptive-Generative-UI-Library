import type { SchemaObject } from '@agul/core';
import type { AgulWizardConfig, AgulWizardStep } from './types.js';

export function readSchemaExtension(schema: SchemaObject, key: string): unknown {
  return (schema as Record<string, unknown>)[key];
}

export function readSchemaWidget(schema: SchemaObject): string | undefined {
  const widget = readSchemaExtension(schema, 'x-agul-widget');
  return typeof widget === 'string' ? widget : undefined;
}

export function readWizardConfig(schema: SchemaObject): AgulWizardConfig | null {
  if (readSchemaExtension(schema, 'x-agul-layout') !== 'wizard') {
    return null;
  }

  const steps = readSchemaExtension(schema, 'x-agul-steps');
  if (!Array.isArray(steps) || steps.length === 0) {
    return null;
  }

  const parsedSteps = steps
    .map((step) => {
      if (!step || typeof step !== 'object') return null;
      const record = step as Record<string, unknown>;
      const title = record.title;
      const fields = record.fields;
      if (typeof title !== 'string' || !Array.isArray(fields)) {
        return null;
      }

      const normalized: AgulWizardStep = {
        title,
        fields: fields.filter((field): field is string => typeof field === 'string'),
      };

      if (typeof record.description === 'string') {
        normalized.description = record.description;
      }

      return normalized.fields.length > 0 ? normalized : null;
    })
    .filter((step): step is AgulWizardStep => step !== null);

  return parsedSteps.length > 0 ? { steps: parsedSteps } : null;
}
