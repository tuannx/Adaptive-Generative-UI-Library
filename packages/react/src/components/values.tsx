import React from 'react';
import { Tag, Typography } from 'antd';
import { formatDisplayValue, resolveDisplay, statusTone, type SchemaObject } from '@aikitstudio/agul-core';
import { toneColor } from './present/tone.js';

export interface RenderValueOptions {
  /** Table cells: small thumbnails instead of full images. */
  compact?: boolean;
}

/** Read-only rendering of one field, formatted by its schema, name and value (see `resolveDisplay`). */
export function renderValue(value: unknown, key: string, schema?: SchemaObject, options: RenderValueOptions = {}): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }

  const hint = resolveDisplay(key, schema, value);
  switch (hint.kind) {
    case 'status':
      return <Tag color={toneColor(statusTone(value))}>{String(value)}</Tag>;
    case 'image':
      return typeof value === 'string' ? (
        <img
          src={value}
          alt={key}
          loading="lazy"
          style={options.compact ? { width: 40, height: 40, objectFit: 'cover', borderRadius: 4 } : { maxWidth: 200, maxHeight: 200, borderRadius: 4 }}
        />
      ) : (
        String(value)
      );
    case 'url':
      return typeof value === 'string' && /^https?:\/\//i.test(value) ? (
        <a href={value} target="_blank" rel="noopener noreferrer">
          {value}
        </a>
      ) : (
        String(value)
      );
    case 'email':
      return <a href={`mailto:${String(value)}`}>{String(value)}</a>;
    case 'tags':
      return Array.isArray(value) ? value.map((item, index) => <Tag key={index}>{String(item)}</Tag>) : String(value);
    case 'json':
      return <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(value, null, 2)}</pre>;
    case 'currency':
    case 'percent':
    case 'number':
      return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDisplayValue(value, hint)}</span>;
    default:
      return formatDisplayValue(value, hint);
  }
}
