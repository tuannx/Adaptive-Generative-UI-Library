/**
 * The zero-dependency motion driver: CSS keyframes + easing curves for a {@link ResolvedMotion}.
 * Pure, so tests, SSR and other drivers (Motion, a video renderer) can reuse the same numbers.
 */
import type React from 'react';
import { MOTION_ENTERS, staggerDelayMs, type MotionEase, type MotionEnter, type ResolvedMotion } from '@aikitstudio/agul-core';

/**
 * Samples a damped spring (settles to 1 at t = 1) into a CSS `linear()` easing.
 * `damping` is the damping ratio: lower bounces more. Browsers without `linear()` ignore the
 * declaration and fall back to the default ease, so it degrades without breaking.
 */
export function springEasing(damping: number, points = 32): string {
  const zeta = Math.min(Math.max(damping, 0.05), 0.99);
  const omega = Math.log(1000) / zeta; // envelope down to 0.1% at t = 1
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  const values: string[] = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const envelope = Math.exp(-zeta * omega * t);
    const x = i === points ? 1 : 1 - envelope * (Math.cos(omegaD * t) + ((zeta * omega) / omegaD) * Math.sin(omegaD * t));
    values.push(String(Math.round(x * 1000) / 1000));
  }
  return `linear(${values.join(', ')})`;
}

/** CSS timing functions for each ease token. */
export const EASE_CSS: Record<MotionEase, string> = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasized: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  linear: 'linear',
  'spring-soft': springEasing(0.8),
  'spring-bouncy': springEasing(0.45),
};

/** Start state of each enter; every animation ends at the element's own style. */
const ENTER_FROM: Record<Exclude<MotionEnter, 'none'>, string> = {
  fade: 'opacity: 0;',
  'slide-up': 'opacity: 0; transform: translateY(12px);',
  'slide-left': 'opacity: 0; transform: translateX(16px);',
  scale: 'opacity: 0; transform: scale(0.92);',
  'blur-in': 'opacity: 0; filter: blur(8px); transform: scale(1.02);',
};

export const enterKeyframeName = (enter: MotionEnter) => `agul-enter-${enter}`;

/** One stylesheet with every enter keyframe; rendered once by the motion provider. */
export const MOTION_CSS = MOTION_ENTERS.filter((enter): enter is Exclude<MotionEnter, 'none'> => enter !== 'none')
  .map((enter) => `@keyframes ${enterKeyframeName(enter)} { from { ${ENTER_FROM[enter]} } }`)
  .join('\n');

/**
 * Inline style that plays the enter animation of item `index` (0 for a single element).
 * `undefined` when motion is off, so callers add nothing to the DOM.
 */
export function enterStyle(motion: ResolvedMotion | undefined, index = 0): React.CSSProperties | undefined {
  if (!motion?.enabled || motion.enter === 'none') return undefined;
  const delay = staggerDelayMs(motion, index);
  return {
    // `both` keeps a staggered item hidden until its turn, then leaves it at its own style
    animation: `${enterKeyframeName(motion.enter)} ${motion.durationMs}ms ${EASE_CSS[motion.ease]} ${delay}ms both`,
  };
}
