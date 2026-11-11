import { describe, it, expect, vi } from 'vite-plus/test';
import { resolveMotion } from '@aikitstudio/agul-core';

const animate = vi.fn();
vi.mock('motion/mini', () => ({ animate }));

const { createMotionDriver, enterAnimation } = await import('./driver.js');
const { spring } = await import('motion');
const { motionEffects } = await import('./index.js');

describe('enterAnimation', () => {
  it('maps a bezier ease to Motion options in seconds, with stagger', () => {
    const anim = enterAnimation(resolveMotion({ preset: 'smooth', stagger: 40 }, 'cards'), 2);
    expect(anim).toEqual({
      keyframes: { opacity: [0, 1], transform: ['translateY(12px)', 'none'] },
      options: { duration: 0.26, ease: [0, 0, 0, 1], delay: 0.08 },
    });
  });

  it('uses Motion springs for spring tokens', () => {
    const anim = enterAnimation(resolveMotion({ preset: 'playful' }, 'cards'), 0)!;
    expect(anim.keyframes).toEqual({ opacity: [0, 1], transform: ['scale(0.92)', 'none'] });
    expect(anim.options).toEqual({ type: spring, visualDuration: 0.42, bounce: 0.45, delay: 0 });
  });

  it('animates filter for blur-in and nothing when off', () => {
    expect(enterAnimation(resolveMotion({ preset: 'cinematic' }, 'cards'), 0)!.keyframes.filter).toEqual(['blur(8px)', 'none']);
    expect(enterAnimation(resolveMotion({ preset: 'none' }, 'cards'), 0)).toBeUndefined();
  });

  it('keeps reduced motion to a short plain fade', () => {
    const anim = enterAnimation(resolveMotion({ preset: 'playful' }, 'cards', { prefersReducedMotion: true }), 5)!;
    expect(anim).toEqual({ keyframes: { opacity: [0, 1] }, options: { duration: 0.15, ease: [0.2, 0, 0, 1], delay: 0 } });
  });
});

describe('motion driver', () => {
  it('calls motion/mini animate with the element', () => {
    const element = {} as HTMLElement;
    createMotionDriver().enter!(element, resolveMotion({ preset: 'smooth' }, 'stats'), 1);
    expect(animate).toHaveBeenCalledWith(element, expect.objectContaining({ opacity: [0, 1] }), expect.objectContaining({ duration: 0.26 }));
  });

  it('loads lazily through motionEffects()', async () => {
    const plugin = motionEffects();
    expect(plugin.id).toBe('motion');
    const driver = await plugin.load();
    expect(driver.id).toBe('motion');
    expect(typeof driver.enter).toBe('function');
  });
});
