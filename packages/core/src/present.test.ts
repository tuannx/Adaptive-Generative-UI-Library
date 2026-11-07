import { describe, it, expect } from 'vite-plus/test';
import { planPresentation, planRecord, planRows } from './present.js';

describe('planRows', () => {
  it('shows rows with a title and an image as cards', () => {
    const plan = planRows([
      { id: 1, name: 'Fluffy', photoUrl: 'https://cdn.example.com/fluffy.jpg', status: 'available', price: 120 },
      { id: 2, name: 'Snowball', photoUrl: 'https://cdn.example.com/snow.png', status: 'sold', price: 80 },
    ]);
    expect(plan.kind).toBe('cards');
    expect(plan).toMatchObject({ title: 'name', image: 'photoUrl', status: 'status' });
    expect(plan.extra.map((field) => field.key)).toEqual(['price']);
  });

  it('shows dated rows with a title as a timeline', () => {
    const plan = planRows([
      { id: 't1', subject: 'Cannot log in', createdAt: '2026-11-01T10:00:00Z', status: 'open' },
      { id: 't2', subject: 'Wrong VAT', createdAt: '2026-11-02T09:00:00Z', status: 'resolved' },
    ]);
    expect(plan).toMatchObject({ kind: 'timeline', title: 'subject', date: 'createdAt', status: 'status' });
  });

  it('keeps a table when nothing stands out, and honours x-agul-present', () => {
    expect(planRows([{ a: 1, b: 2 }]).kind).toBe('table');
    const schema = { type: 'object', 'x-agul-present': 'table', properties: { name: { type: 'string' }, logo: { type: 'string', format: 'uri' } } };
    expect(planRows([{ name: 'x', logo: 'https://e.com/l.png' }], schema).kind).toBe('table');
  });

  it('reads field kinds from the item schema when given', () => {
    const schema = {
      type: 'object',
      properties: { title: { type: 'string' }, publishedOn: { type: 'string', format: 'date' } },
    };
    expect(planRows([{ title: 'Post', publishedOn: 'soon' }], schema)).toMatchObject({ kind: 'timeline', date: 'publishedOn' });
  });
});

describe('planRecord', () => {
  it('turns a mostly numeric record into KPI stats', () => {
    const plan = planRecord({ id: 'q3', revenue: 120000, orders: 340, conversionRate: 0.031, period: 'Q3' });
    expect(plan.kind).toBe('stats');
    expect(plan.metrics.map((field) => field.key)).toEqual(['revenue', 'orders', 'conversionRate']);
    expect(plan.metrics[0].display.kind).toBe('currency');
  });

  it('keeps a record with a few numbers as a record, metrics on top', () => {
    const plan = planRecord({ name: 'Ann', email: 'a@b.co', city: 'Moline', age: 30, score: 7 });
    expect(plan.kind).toBe('record');
    expect(plan.metrics.map((field) => field.key)).toEqual(['age', 'score']);
  });

  it('shows no metrics for a single number', () => {
    expect(planRecord({ name: 'Ann', age: 30 }).metrics).toEqual([]);
  });
});

describe('planPresentation', () => {
  it('plans arrays of rows, records, and skips everything else', () => {
    expect(planPresentation([{ name: 'a', img: 'https://e.com/a.jpg' }])?.kind).toBe('cards');
    expect(planPresentation({ users: 10, active: 7 })?.kind).toBe('stats');
    expect(planPresentation('text')).toBeUndefined();
    expect(planPresentation([1, 2])).toBeUndefined();
    expect(planPresentation([])).toBeUndefined();
  });
});
