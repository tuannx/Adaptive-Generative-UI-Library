import { describe, it, expect } from 'vitest';
import { resolveFieldPlugin } from './registry.js';
import { readWizardConfig } from './schema-extensions.js';
import type { AgulFieldPlugin } from './types.js';
import type { SchemaObject } from '@agul/core';

const baseContext = {
  name: 'avatarUrl',
  label: 'Avatar Url',
  required: false,
  schemas: {},
};

describe('resolveFieldPlugin', () => {
  const imagePlugin: AgulFieldPlugin = {
    id: 'image-upload',
    widget: 'image-upload',
    render: () => null,
  };

  const colorPlugin: AgulFieldPlugin = {
    id: 'color-picker',
    widget: 'color-picker',
    priority: 10,
    render: () => null,
  };

  it('matches by x-agul-widget', () => {
    const schema = {
      type: 'string',
      'x-agul-widget': 'image-upload',
    } as SchemaObject;

    const resolved = resolveFieldPlugin([imagePlugin, colorPlugin], {
      ...baseContext,
      schema,
    });

    expect(resolved?.id).toBe('image-upload');
  });

  it('prefers higher priority plugins', () => {
    const schema = {
      type: 'string',
      'x-agul-widget': 'color-picker',
    } as SchemaObject;

    const resolved = resolveFieldPlugin([imagePlugin, colorPlugin], {
      ...baseContext,
      schema,
    });

    expect(resolved?.id).toBe('color-picker');
  });

  it('supports custom match functions', () => {
    const plugin: AgulFieldPlugin = {
      id: 'custom',
      match: (context) => context.name.endsWith('Url'),
      render: () => null,
    };

    const resolved = resolveFieldPlugin([plugin], {
      ...baseContext,
      schema: { type: 'string' },
    });

    expect(resolved?.id).toBe('custom');
  });
});

describe('readWizardConfig', () => {
  it('parses wizard steps from schema extensions', () => {
    const schema = {
      type: 'object',
      'x-agul-layout': 'wizard',
      'x-agul-steps': [
        { title: 'Basics', fields: ['name', 'status'] },
        { title: 'Media', fields: ['photoUrls'] },
      ],
    } as SchemaObject;

    expect(readWizardConfig(schema)).toEqual({
      steps: [
        { title: 'Basics', fields: ['name', 'status'] },
        { title: 'Media', fields: ['photoUrls'] },
      ],
    });
  });
});
