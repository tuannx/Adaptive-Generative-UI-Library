import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { planRecord, planRows } from '@agul/core';
import { ResultView } from '../ResultView.js';
import { renderValue } from '../values.js';
import { CardGrid } from './CardGrid.js';
import { StatRow } from './StatRow.js';
import { TimelineView } from './TimelineView.js';

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);

describe('renderValue', () => {
  it('formats by schema and name', () => {
    expect(html(renderValue(1234.5, 'price', { type: 'number' }))).toContain('>1,234.50<');
    expect(html(renderValue('failed', 'status', { type: 'string', enum: ['ok', 'failed'] }))).toContain('ant-tag-error');
    expect(html(renderValue('a@b.co', 'contact'))).toContain('mailto:a@b.co');
    expect(html(renderValue(null, 'x'))).toContain('-');
    expect(html(renderValue('https://e.com/a.png', 'photo', undefined, { compact: true }))).toContain('width:40px');
  });
});

describe('presentation blocks', () => {
  const pets = [
    { id: 1, name: 'Fluffy', photoUrl: 'https://e.com/f.jpg', status: 'available', price: 120 },
    { id: 2, name: 'Snowball', photoUrl: 'https://e.com/s.jpg', status: 'pending', price: 80 },
  ];

  it('CardGrid shows a card per row with image, title, status and extra fields', () => {
    const out = html(<CardGrid rows={pets} plan={planRows(pets)} />);
    expect(out.match(/data-testid="agul-card"/g)).toHaveLength(2);
    expect(out).toContain('Fluffy');
    expect(out).toContain('src="https://e.com/f.jpg"');
    expect(out).toContain('ant-tag-success');
    expect(out).toContain('120.00');
  });

  it('TimelineView orders newest first', () => {
    const tickets = [
      { id: 'a', subject: 'Older ticket', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'b', subject: 'Newer ticket', createdAt: '2026-11-05T10:00:00Z' },
    ];
    const out = html(<TimelineView rows={tickets} plan={planRows(tickets)} />);
    expect(out).toContain('agul-timeline');
    expect(out.indexOf('Newer ticket')).toBeLessThan(out.indexOf('Older ticket'));
  });

  it('StatRow renders one KPI card per metric', () => {
    const record = { revenue: 1200, orders: 34, region: 'US' };
    const out = html(<StatRow record={record} metrics={planRecord(record).metrics} />);
    expect(out).toContain('agul-stat-revenue');
    expect(out).toContain('1,200.00');
    expect(out).not.toContain('agul-stat-region');
  });
});

describe('ResultView', () => {
  it('picks cards, stats or a table from the data', () => {
    expect(html(<ResultView value={[{ name: 'A', image: 'https://e.com/a.png' }]} />)).toContain('agul-card-grid');
    const stats = html(<ResultView value={{ users: 10, active: 7, plan: 'pro' }} />);
    expect(stats).toContain('agul-stats');
    expect(stats).toContain('Plan');
    expect(html(<ResultView value={[{ position: 'Past', card: 'The Fool' }]} />)).toContain('agul-result-table');
  });
});
