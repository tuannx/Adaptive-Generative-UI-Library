import type { ReactNode } from 'react';
import type { SchemaObject } from '@agul/core';

export interface AgulFieldRenderContext {
  name: string;
  schema: SchemaObject;
  label: string;
  required: boolean;
  schemas: Record<string, SchemaObject>;
}

export interface AgulFieldPlugin {
  id: string;
  priority?: number;
  widget?: string | string[];
  format?: string | string[];
  type?: string | string[];
  fieldName?: string | RegExp;
  match?: (context: AgulFieldRenderContext) => boolean;
  render: (context: AgulFieldRenderContext) => ReactNode;
}

export interface AgulWizardStep {
  title: string;
  description?: string;
  fields: string[];
}

export interface AgulWizardConfig {
  steps: AgulWizardStep[];
}
