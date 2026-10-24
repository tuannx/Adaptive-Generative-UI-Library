import React from 'react';
import { Tag } from 'antd';
import { isHttpUrl, isImageUrl } from './format.js';

export function renderValue(value: unknown, key: string): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#999' }}>-</span>;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'string') {
    if (isImageUrl(value)) {
      return <img src={value} alt={key} style={{ maxWidth: 200, maxHeight: 200 }} />;
    }
    if (isHttpUrl(value)) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer">
          {value}
        </a>
      );
    }
    return value;
  }
  if (Array.isArray(value) && value.every((item) => typeof item !== 'object' || item === null)) {
    return value.map((item, index) => <Tag key={index}>{String(item)}</Tag>);
  }
  if (typeof value === 'object') {
    return <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(value, null, 2)}</pre>;
  }
  return String(value);
}
