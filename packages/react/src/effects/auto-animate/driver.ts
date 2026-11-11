/**
 * AutoAnimate (auto-animate.formkit.com) driver: smooth add, remove and reorder inside a container.
 * Loaded only by {@link autoAnimateEffects}; about 3.5 KB gzip.
 */
import autoAnimate, { type AutoAnimateOptions } from '@formkit/auto-animate';
import type { ResolvedMotion } from '@aikitstudio/agul-core';
import { EASE_BEZIER } from '../css-motion.js';
import type { AgulMotionDriver } from '../plugin.js';

const bezier = (points: readonly number[]) => `cubic-bezier(${points.join(', ')})`;

/**
 * AutoAnimate options for a region. Springs map to bezier curves (an overshoot for bouncy),
 * because AutoAnimate passes easing to WAAPI, which throws on `linear()` in older browsers. Pure.
 */
export function listOptions(motion: ResolvedMotion): Partial<AutoAnimateOptions> {
  const easing =
    motion.ease === 'linear'
      ? 'linear'
      : motion.ease === 'spring-bouncy'
        ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
        : motion.ease === 'spring-soft'
          ? bezier(EASE_BEZIER.decelerate)
          : bezier(EASE_BEZIER[motion.ease]);
  // AutoAnimate checks prefers-reduced-motion itself; `reducedMotion: "always"` already turns listChanges off
  return { duration: Math.max(motion.durationMs, 120), easing };
}

export function createAutoAnimateDriver(): AgulMotionDriver {
  return {
    id: 'auto-animate',
    list(container, motion) {
      const controller = autoAnimate(container, listOptions(motion));
      return () => controller.disable();
    },
  };
}
