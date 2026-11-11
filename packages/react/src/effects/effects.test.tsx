import { describe, it, expect } from 'vite-plus/test';
import { renderToStaticMarkup } from 'react-dom/server';
import { planRecord, planRows, resolveMotion } from '@aikitstudio/agul-core';
import { CardGrid } from '../components/present/CardGrid.js';
import { StatRow } from '../components/present/StatRow.js';
import { TimelineView } from '../components/present/TimelineView.js';
import { EASE_CSS, enterStyle, MOTION_CSS, springEasing } from './css-motion.js';
import { AgulMotionProvider } from './MotionContext.js';

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);

describe('springEasing', () => {
  it('starts at 0, ends at 1, and overshoots when bouncy', () => {
    const values = springEasing(0.45).slice('linear('.length, -1).split(', ').map(Number);
    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(1);
    expect(Math.max(...values)).toBeGreaterThan(1);
  });

  it('does not overshoot much when soft', () => {
    const values = springEasing(0.8).slice('linear('.length, -1).split(', ').map(Number);
    expect(Math.max(...values)).toBeLessThan(1.03);
  });
});

describe('enterStyle', () => {
  it('builds a staggered CSS animation from resolved settings', () => {
    const motion = resolveMotion({ preset: 'smooth', stagger: 40 }, 'cards');
    expect(enterStyle(motion, 2)).toEqual({
      animation: `agul-enter-slide-up 260ms ${EASE_CSS.decelerate} 80ms both`,
    });
  });

  it('adds nothing when motion is off or missing', () => {
    expect(enterStyle(undefined)).toBeUndefined();
    expect(enterStyle(resolveMotion({ preset: 'none' }, 'cards'))).toBeUndefined();
  });

  it('has a keyframe for every enter that is not none', () => {
    for (const name of ['fade', 'slide-up', 'slide-left', 'scale', 'blur-in']) {
      expect(MOTION_CSS).toContain(`@keyframes agul-enter-${name}`);
    }
  });
});

describe('motion in presentation blocks', () => {
  const pets = [
    { id: 1, name: 'Fluffy', photoUrl: 'https://e.com/f.jpg', status: 'available' },
    { id: 2, name: 'Snowball', photoUrl: 'https://e.com/s.jpg', status: 'pending' },
  ];

  it('changes nothing without a motion provider', () => {
    const out = html(<CardGrid rows={pets} plan={planRows(pets)} />);
    expect(out).not.toContain('agul-enter');
    expect(out).not.toContain('data-agul-motion');
  });

  it('changes nothing when the provider has no config', () => {
    const out = html(
      <AgulMotionProvider>
        <CardGrid rows={pets} plan={planRows(pets)} />
      </AgulMotionProvider>,
    );
    expect(out).not.toContain('agul-enter');
    expect(out).not.toContain('data-agul-motion');
  });

  it('staggers cards and adds the keyframes once', () => {
    const out = html(
      <AgulMotionProvider config={{ preset: 'playful', stagger: 50 }}>
        <CardGrid rows={pets} plan={planRows(pets)} />
      </AgulMotionProvider>,
    );
    expect(out.match(/data-agul-motion/g)).toHaveLength(1);
    expect(out).toContain('agul-enter-scale 420ms');
    expect(out).toContain(' 0ms both');
    expect(out).toContain(' 50ms both');
  });

  it('animates stats and timeline items with their region settings', () => {
    const config = { preset: 'subtle' as const, regions: { stats: { enter: 'slide-up' as const } } };
    const record = { revenue: 120000, orders: 340, conversionRate: 0.031 };
    const stats = html(
      <AgulMotionProvider config={config}>
        <StatRow record={record} metrics={planRecord(record).metrics} />
      </AgulMotionProvider>,
    );
    expect(stats).toContain('agul-enter-slide-up');

    const tickets = [
      { id: 'a', subject: 'Older', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'b', subject: 'Newer', createdAt: '2026-11-05T10:00:00Z' },
    ];
    const timeline = html(
      <AgulMotionProvider config={config}>
        <TimelineView rows={tickets} plan={planRows(tickets)} />
      </AgulMotionProvider>,
    );
    expect(timeline).toContain('agul-enter-fade');
  });
});
