import { describe, it, expect } from 'vite-plus/test';
import { formatDisplayValue, resolveDisplay, statusTone } from './display.js';

describe('resolveDisplay', () => {
  it('prefers x-agul-display, then format, then name, then value', () => {
    expect(resolveDisplay('price', { type: 'number', 'x-agul-display': { kind: 'currency', currency: 'eur' } })).toEqual({
      kind: 'currency',
      currency: 'EUR',
    });
    expect(resolveDisplay('price', { type: 'string', format: 'date' })).toEqual({ kind: 'date' });
    expect(resolveDisplay('totalAmount', { type: 'number' })).toEqual({ kind: 'currency' });
    expect(resolveDisplay('discountPct', { type: 'number' })).toEqual({ kind: 'percent' });
    expect(resolveDisplay('count', { type: 'integer' })).toEqual({ kind: 'number' });
  });

  it('does not guess money or percent from total, balance, rate or ratio', () => {
    expect(resolveDisplay('total', { type: 'integer' })).toEqual({ kind: 'number' });
    expect(resolveDisplay('balance', { type: 'number' })).toEqual({ kind: 'number' });
    expect(resolveDisplay('exchangeRate', { type: 'number' })).toEqual({ kind: 'number' });
    expect(resolveDisplay('heartRate', { type: 'integer' })).toEqual({ kind: 'number' });
    expect(resolveDisplay('ratio', { type: 'number' })).toEqual({ kind: 'number' });
    expect(resolveDisplay('conversionRate', { type: 'number', format: 'percent' })).toEqual({ kind: 'percent' });
  });

  it('reads the percent scale from x-agul-display or a maximum of 1', () => {
    expect(resolveDisplay('share', { type: 'number', 'x-agul-display': { kind: 'percent', scale: 'fraction' } })).toEqual({
      kind: 'percent',
      currency: undefined,
      scale: 'fraction',
    });
    expect(resolveDisplay('conversionRate', { type: 'number', format: 'percent', maximum: 1 })).toEqual({
      kind: 'percent',
      scale: 'fraction',
    });
  });

  it('shows arrays as tags only when the items are plain values', () => {
    expect(resolveDisplay('labels', { type: 'array', items: { type: 'string' } })).toEqual({ kind: 'tags' });
    expect(resolveDisplay('lines', { type: 'array', items: { properties: { sku: { type: 'string' } } } })).toEqual({ kind: 'json' });
    expect(resolveDisplay('lines', { type: 'array', items: { oneOf: [] } }, ['a'])).toEqual({ kind: 'tags' });
  });

  it('ignores an unknown x-agul-display value', () => {
    expect(resolveDisplay('count', { type: 'integer', 'x-agul-display': 'sparkle' })).toEqual({ kind: 'number' });
  });

  it('reads status, dates, images and links from name and sample value', () => {
    expect(resolveDisplay('status', { type: 'string', enum: ['open', 'closed'] })).toEqual({ kind: 'status' });
    expect(resolveDisplay('createdAt', undefined, '2026-11-07T05:10:00Z')).toEqual({ kind: 'datetime' });
    expect(resolveDisplay('dueDate', undefined, '2026-11-07')).toEqual({ kind: 'date' });
    expect(resolveDisplay('avatar', undefined, 'https://cdn.example.com/u/1')).toEqual({ kind: 'image' });
    expect(resolveDisplay('cover', undefined, 'https://cdn.example.com/a.webp')).toEqual({ kind: 'image' });
    expect(resolveDisplay('homepage', undefined, 'https://example.com')).toEqual({ kind: 'url' });
    expect(resolveDisplay('contact', undefined, 'a@b.co')).toEqual({ kind: 'email' });
    expect(resolveDisplay('tags', { type: 'array', items: { type: 'string' } })).toEqual({ kind: 'tags' });
  });

  it('does not call a plain string that looks like a date a date when the name says nothing', () => {
    expect(resolveDisplay('code', undefined, '2026-11-07')).toEqual({ kind: 'text' });
  });
});

describe('statusTone', () => {
  it('maps common status words to tones', () => {
    expect(statusTone('Active')).toBe('positive');
    expect(statusTone('available')).toBe('positive');
    expect(statusTone('failed')).toBe('negative');
    expect(statusTone('in_progress')).toBe('attention');
    expect(statusTone('open')).toBe('attention');
    expect(statusTone('sold')).toBe('neutral');
    expect(statusTone(undefined)).toBe('neutral');
  });
});

describe('formatDisplayValue', () => {
  const locale = 'en-US';

  it('formats money, percent and numbers', () => {
    expect(formatDisplayValue(1234.5, { kind: 'currency' }, { locale })).toBe('1,234.50');
    expect(formatDisplayValue(1234.5, { kind: 'currency', currency: 'USD' }, { locale })).toBe('$1,234.50');
    expect(formatDisplayValue('99', { kind: 'currency', currency: 'EUR' }, { locale })).toBe('€99.00');
    expect(formatDisplayValue(0.425, { kind: 'percent', scale: 'fraction' }, { locale })).toBe('42.5%');
    expect(formatDisplayValue(42, { kind: 'percent' }, { locale })).toBe('42%');
    expect(formatDisplayValue(1, { kind: 'percent' }, { locale })).toBe('1%');
    expect(formatDisplayValue(2024, { kind: 'number' }, { locale })).toBe('2024');
    expect(formatDisplayValue(5551234567, { kind: 'number' }, { locale })).toBe('5551234567');
    expect(formatDisplayValue(37.774929, { kind: 'number' }, { locale })).toBe('37.774929');
    expect(formatDisplayValue(99, { kind: 'currency', currency: 'US$' }, { locale })).toBe('99.00');
  });

  it('formats dates without shifting a plain date across time zones', () => {
    expect(formatDisplayValue('2026-11-07', { kind: 'date' }, { locale })).toBe('Nov 7, 2026');
    expect(formatDisplayValue('not a date', { kind: 'date' }, { locale })).toBe('not a date');
  });

  it('falls back to plain text when the value does not fit the hint', () => {
    expect(formatDisplayValue('abc', { kind: 'currency' }, { locale })).toBe('abc');
    expect(formatDisplayValue(null, { kind: 'currency' }, { locale })).toBe('-');
    expect(formatDisplayValue(true, { kind: 'boolean' })).toBe('Yes');
    expect(formatDisplayValue(['a', 'b'], { kind: 'tags' })).toBe('a, b');
    expect(formatDisplayValue([{ a: 1 }], { kind: 'tags' })).toBe('{"a":1}');
    expect(formatDisplayValue({ a: 1 }, { kind: 'json' })).toBe('{"a":1}');
  });
});
