import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Form } from 'antd';
import type { SchemaObject } from '@agul/core';
import { renderSchemaFields } from '../components/FormView.js';
import { gameWidgetPlugins } from './game-widgets.js';

const schema: SchemaObject = {
  type: 'object',
  required: ['intent'],
  properties: {
    intent: {
      type: 'string',
      enum: ['sales', 'support'],
      'x-agul-widget': 'choice-cards',
      'x-agul-choices': [
        { value: 'sales', label: 'Bán hàng', icon: '💼' },
        { value: 'support', label: 'Chăm sóc khách' },
      ],
    },
    tools: { type: 'array', items: { type: 'string', enum: ['slack', 'jira'] }, 'x-agul-widget': 'choice-cards' },
    fit: { type: 'integer', 'x-agul-widget': 'score-meter', 'x-agul-bands': [{ min: 70, label: 'Dùng thử ngay', tone: 'positive' }] },
    shaped: { type: 'number', title: 'Trợ lý đã thành hình', 'x-agul-widget': 'progress-xp', 'x-agul-levels': [{ at: 50, label: 'Thành hình' }] },
  },
};

const render = (initialValues: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(Form, { initialValues }, renderSchemaFields(schema, { schemas: {}, plugins: gameWidgetPlugins })),
  );

describe('gameWidgetPlugins', () => {
  it('draws choice cards and marks the chosen ones', () => {
    const html = render({ intent: 'sales', tools: ['jira'] });
    expect(html).toContain('Bán hàng');
    expect(html).toMatch(/aria-pressed="true"[^>]*data-testid="agul-choice-sales"/);
    expect(html).toMatch(/aria-pressed="false"[^>]*data-testid="agul-choice-support"/);
    expect(html).toMatch(/aria-pressed="false"[^>]*data-testid="agul-choice-slack"/);
    expect(html).toMatch(/aria-pressed="true"[^>]*data-testid="agul-choice-jira"/);
  });

  it('draws the score with its band and the progress with its level', () => {
    const html = render({ fit: 74, shaped: 66 });
    expect(html).toContain('data-testid="agul-score"');
    expect(html).toContain('Dùng thử ngay');
    expect(html).toContain('data-testid="agul-xp"');
    expect(html).toContain('Trợ lý đã thành hình');
    expect(html).toContain('Thành hình');
  });

  it('shows a dash when there is no score yet', () => {
    expect(render({})).toContain('data-testid="agul-score-empty"');
  });
});
