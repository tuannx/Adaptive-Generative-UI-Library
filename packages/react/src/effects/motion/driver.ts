/**
 * Motion (motion.dev) driver: enter animations through `motion/mini` (WAAPI) with Motion's spring
 * physics. Loaded only by {@link motionEffects}; about 5 KB gzip.
 */
import { animate } from 'motion/mini';
import { spring } from 'motion';
import { staggerDelayMs, type ResolvedMotion } from '@aikitstudio/agul-core';
import { EASE_BEZIER, ENTER_FROM } from '../css-motion.js';
import type { AgulMotionDriver } from '../plugin.js';

/** Motion's `bounce` for each spring token (0 = none, 1 = very bouncy). */
const SPRING_BOUNCE = { 'spring-soft': 0.15, 'spring-bouncy': 0.45 } as const;

export interface EnterAnimation {
  keyframes: Record<string, Array<string | number>>;
  options: Record<string, unknown>;
}

/** Keyframes and options for one element's enter; `undefined` when it should not animate. Pure. */
export function enterAnimation(motion: ResolvedMotion, index: number): EnterAnimation | undefined {
  if (!motion.enabled || motion.enter === 'none') return undefined;
  const from = ENTER_FROM[motion.enter];
  const keyframes: EnterAnimation['keyframes'] = { opacity: [from.opacity, 1] };
  if (from.transform) keyframes.transform = [from.transform, 'none'];
  if (from.filter) keyframes.filter = [from.filter, 'none'];

  const seconds = motion.durationMs / 1000;
  const delay = staggerDelayMs(motion, index) / 1000;
  if (motion.ease === 'spring-soft' || motion.ease === 'spring-bouncy') {
    // visualDuration: the spring looks settled by then; a bouncy tail may run a little past it
    return { keyframes, options: { type: spring, visualDuration: seconds, bounce: SPRING_BOUNCE[motion.ease], delay } };
  }
  const ease = motion.ease === 'linear' ? 'linear' : EASE_BEZIER[motion.ease];
  return { keyframes, options: { duration: seconds, ease, delay } };
}

export function createMotionDriver(): AgulMotionDriver {
  return {
    id: 'motion',
    enter(element, motion, index) {
      const animation = enterAnimation(motion, index);
      // WAAPI with fill "both": the start state holds during the stagger delay, so no flash
      if (animation) animate(element, animation.keyframes, animation.options);
    },
  };
}
