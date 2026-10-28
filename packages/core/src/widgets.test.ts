import { describe, it, expect } from 'vitest';
import { isMultiChoice, readChoices, readScore, readXp } from './widgets.js';

describe('readChoices', () => {
  it('uses declared choices with labels, descriptions and icons', () => {
    const schema = {
      type: 'string',
      enum: ['sales', 'support'],
      'x-agul-choices': [
        { value: 'sales', label: 'Bán hàng', description: 'Tìm và chăm lead', icon: '💼' },
        { value: 'support', label: 'Chăm sóc khách' },
      ],
    };
    expect(readChoices(schema)).toEqual([
      { value: 'sales', label: 'Bán hàng', description: 'Tìm và chăm lead', icon: '💼' },
      { value: 'support', label: 'Chăm sóc khách' },
    ]);
  });

  it('drops a declared choice that the enum does not allow', () => {
    const schema = { enum: ['a'], 'x-agul-choices': [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] };
    expect(readChoices(schema).map((choice) => choice.value)).toEqual(['a']);
  });

  it('falls back to enum values', () => {
    expect(readChoices({ enum: ['1', '2-10', null] })).toEqual([
      { value: '1', label: '1' },
      { value: '2-10', label: '2-10' },
    ]);
  });

  it('reads the items of a multi-choice field', () => {
    const schema = { type: 'array', items: { type: 'string', enum: ['slack', 'jira'] } };
    expect(isMultiChoice(schema)).toBe(true);
    expect(readChoices(schema).map((choice) => choice.value)).toEqual(['slack', 'jira']);
  });
});

describe('readScore', () => {
  const schema = {
    type: 'integer',
    'x-agul-bands': [
      { min: 70, label: 'Dùng thử ngay', tone: 'positive' },
      { min: 0, label: 'Đọc hướng dẫn' },
      { min: 40, label: 'Đặt lịch demo', tone: 'neutral' },
    ],
  };

  it('picks the highest band the score reaches', () => {
    expect(readScore(schema, 74)).toEqual({
      value: 74,
      min: 0,
      max: 100,
      percent: 74,
      band: { min: 70, label: 'Dùng thử ngay', tone: 'positive' },
    });
    expect(readScore(schema, 40)?.band?.label).toBe('Đặt lịch demo');
  });

  it('clamps into minimum..maximum and scales the percent', () => {
    expect(readScore({ minimum: 0, maximum: 10 }, 12)).toEqual({ value: 10, min: 0, max: 10, percent: 100 });
  });

  it('returns null for a missing value or an empty range', () => {
    expect(readScore(schema, undefined)).toBeNull();
    expect(readScore({ minimum: 5, maximum: 5 }, 5)).toBeNull();
  });
});

describe('readXp', () => {
  const schema = {
    'x-agul-levels': [
      { at: 0, label: 'Phác thảo' },
      { at: 50, label: 'Thành hình' },
      { at: 100, label: 'Sẵn sàng' },
    ],
  };

  it('gives the level reached and the next one', () => {
    expect(readXp(schema, 66)).toEqual({
      percent: 66,
      level: { at: 50, label: 'Thành hình' },
      next: { at: 100, label: 'Sẵn sàng' },
    });
  });

  it('works without levels and clamps', () => {
    expect(readXp({}, 140)).toEqual({ percent: 100 });
    expect(readXp({}, 'x')).toBeNull();
  });
});
