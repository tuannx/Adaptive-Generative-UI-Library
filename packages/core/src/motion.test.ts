import { describe, it, expect } from 'vite-plus/test';
import {
  MOTION_LIMITS,
  mergeMotionConfigs,
  normalizeMotionConfig,
  readMotionConfig,
  resolveMotion,
  staggerDelayMs,
} from './motion.js';

describe('normalizeMotionConfig', () => {
  it('keeps valid fields, drops unknown values and clamps numbers', () => {
    expect(
      normalizeMotionConfig({
        preset: 'playful',
        enter: 'explode',
        ease: 'spring-bouncy',
        duration: 99999,
        stagger: -5,
        countUp: 'yes',
        celebrate: 'confetti',
        style: 'color: red',
      }),
    ).toEqual({ preset: 'playful', ease: 'spring-bouncy', duration: MOTION_LIMITS.durationMs.max, stagger: 0, celebrate: 'confetti' });
  });

  it('accepts a preset name as shorthand and rejects other strings', () => {
    expect(normalizeMotionConfig('cinematic')).toEqual({ preset: 'cinematic' });
    expect(normalizeMotionConfig('cubic-bezier(0,0,1,1)')).toBeUndefined();
  });

  it('keeps known regions only', () => {
    expect(normalizeMotionConfig({ regions: { stats: { countUp: true }, sidebar: { enter: 'fade' }, chat: { enter: 'nope' } } })).toEqual({
      regions: { stats: { countUp: true } },
    });
  });

  it('returns undefined for nothing usable', () => {
    expect(normalizeMotionConfig(undefined)).toBeUndefined();
    expect(normalizeMotionConfig([])).toBeUndefined();
    expect(normalizeMotionConfig({ enter: 42 })).toBeUndefined();
    expect(normalizeMotionConfig({ duration: Number.NaN })).toBeUndefined();
  });
});

describe('readMotionConfig', () => {
  it('reads x-agul-motion from a schema or spec root', () => {
    expect(readMotionConfig({ type: 'object', 'x-agul-motion': { preset: 'smooth' } })).toEqual({ preset: 'smooth' });
    expect(readMotionConfig({ openapi: '3.1.0', 'x-agul-motion': 'none' })).toEqual({ preset: 'none' });
    expect(readMotionConfig({ type: 'object' })).toBeUndefined();
    expect(readMotionConfig(undefined)).toBeUndefined();
  });
});

describe('resolveMotion', () => {
  it('uses the subtle preset by default', () => {
    expect(resolveMotion(undefined, 'cards')).toEqual({
      region: 'cards',
      enabled: true,
      reduced: false,
      enter: 'fade',
      ease: 'standard',
      durationMs: 180,
      staggerMs: 20,
      countUp: false,
      celebrate: 'none',
      listChanges: 'auto',
    });
  });

  it('applies preset, then own fields, then the region override', () => {
    const config = { preset: 'playful' as const, duration: 300, regions: { stats: { duration: 500, enter: 'fade' as const } } };
    expect(resolveMotion(config, 'cards')).toMatchObject({ enter: 'scale', ease: 'spring-bouncy', durationMs: 300 });
    expect(resolveMotion(config, 'stats')).toMatchObject({ enter: 'fade', durationMs: 500, countUp: true });
  });

  it('ignores undefined fields instead of erasing preset values', () => {
    expect(resolveMotion({ preset: 'smooth', enter: undefined, regions: { cards: { ease: undefined } } }, 'cards')).toMatchObject({
      enter: 'slide-up',
      ease: 'decelerate',
    });
  });

  it('is off with the none preset', () => {
    expect(resolveMotion({ preset: 'none' }, 'route')).toMatchObject({ enabled: false, enter: 'none', durationMs: 0 });
  });

  it('keeps only a short fade under reduced motion', () => {
    const reduced = resolveMotion({ preset: 'cinematic' }, 'cards', { prefersReducedMotion: true });
    expect(reduced).toMatchObject({
      enabled: true,
      reduced: true,
      enter: 'fade',
      ease: 'standard',
      durationMs: MOTION_LIMITS.reducedDurationMs,
      staggerMs: 0,
      countUp: false,
      celebrate: 'none',
      listChanges: 'none',
    });
  });

  it('honours reducedMotion always / never', () => {
    expect(resolveMotion({ reducedMotion: 'always' }, 'cards').reduced).toBe(true);
    expect(resolveMotion({ reducedMotion: 'never' }, 'cards', { prefersReducedMotion: true }).reduced).toBe(false);
  });
});

describe('mergeMotionConfigs', () => {
  it('lets later configs win field by field', () => {
    expect(mergeMotionConfigs({ duration: 200, stagger: 10 }, undefined, { stagger: 40 })).toEqual({ duration: 200, stagger: 40 });
  });

  it('merges regions per field', () => {
    expect(mergeMotionConfigs({ regions: { stats: { countUp: true } } }, { regions: { stats: { duration: 400 } } })).toEqual({
      regions: { stats: { countUp: true, duration: 400 } },
    });
  });

  it('starts a new look when a later config names a preset, but keeps reducedMotion', () => {
    expect(
      mergeMotionConfigs({ reducedMotion: 'always', duration: 900, regions: { chat: { enter: 'fade' } } }, { preset: 'playful', stagger: 30 }),
    ).toEqual({ reducedMotion: 'always', preset: 'playful', stagger: 30 });
  });

  it('returns undefined when nothing is given', () => {
    expect(mergeMotionConfigs(undefined, undefined)).toBeUndefined();
  });
});

describe('staggerDelayMs', () => {
  it('delays items by index and caps long lists', () => {
    const motion = resolveMotion({ stagger: 50 }, 'cards');
    expect(staggerDelayMs(motion, 0)).toBe(0);
    expect(staggerDelayMs(motion, 3)).toBe(150);
    expect(staggerDelayMs(motion, 500)).toBe(MOTION_LIMITS.maxStaggerItems * 50);
  });

  it('is zero when motion is off', () => {
    expect(staggerDelayMs(resolveMotion({ preset: 'none' }, 'cards'), 5)).toBe(0);
  });
});
