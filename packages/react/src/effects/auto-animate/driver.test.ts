import { describe, it, expect, vi } from 'vite-plus/test';
import { resolveMotion } from '@aikitstudio/agul-core';

const disable = vi.fn();
const autoAnimate = vi.fn(() => ({ disable }));
vi.mock('@formkit/auto-animate', () => ({ default: autoAnimate }));

const { createAutoAnimateDriver, listOptions } = await import('./driver.js');
const { autoAnimateEffects } = await import('./index.js');

describe('listOptions', () => {
  it('uses the region duration and a bezier curve', () => {
    expect(listOptions(resolveMotion({ preset: 'smooth' }, 'cards'))).toEqual({
      duration: 260,
      easing: 'cubic-bezier(0, 0, 0, 1)',
    });
  });

  it('maps springs to bezier curves WAAPI accepts everywhere', () => {
    expect(listOptions(resolveMotion({ preset: 'playful' }, 'cards')).easing).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)');
    expect(listOptions(resolveMotion({ preset: 'smooth', ease: 'spring-soft' }, 'cards')).easing).toBe('cubic-bezier(0, 0, 0, 1)');
    expect(listOptions(resolveMotion({ preset: 'smooth', ease: 'linear' }, 'cards')).easing).toBe('linear');
  });

  it('keeps a short floor so changes stay visible', () => {
    expect(listOptions(resolveMotion({ preset: 'subtle', duration: 40 }, 'chat')).duration).toBe(120);
  });
});

describe('auto-animate driver', () => {
  it('attaches to the container and stops with disable()', () => {
    const container = {} as HTMLElement;
    const stop = createAutoAnimateDriver().list!(container, resolveMotion({ preset: 'smooth' }, 'chat'));
    expect(autoAnimate).toHaveBeenCalledWith(container, { duration: 260, easing: 'cubic-bezier(0, 0, 0, 1)' });
    stop();
    expect(disable).toHaveBeenCalledOnce();
  });

  it('loads lazily through autoAnimateEffects()', async () => {
    const driver = await autoAnimateEffects().load();
    expect(driver.id).toBe('auto-animate');
    expect(typeof driver.list).toBe('function');
  });
});
