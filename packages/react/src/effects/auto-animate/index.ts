/**
 * `@aikitstudio/agul-react/effects/auto-animate`: cards and chat messages slide into place when
 * items are added, removed or reordered, with AutoAnimate.
 *
 *   import { autoAnimateEffects } from '@aikitstudio/agul-react/effects/auto-animate';
 *   <AGULRenderer spec={spec} motion="smooth" effects={[autoAnimateEffects()]} />
 *
 * Needs `@formkit/auto-animate` (optional peer, ^0.10). Imported only when a page animates.
 * Works with `motionEffects()` in the same list: Motion plays first renders, AutoAnimate the changes.
 */
import type { AgulEffectPlugin } from '../plugin.js';

export function autoAnimateEffects(): AgulEffectPlugin {
  return {
    id: 'auto-animate',
    load: () => import('./driver.js').then(({ createAutoAnimateDriver }) => createAutoAnimateDriver()),
  };
}

export type { AgulEffectPlugin, AgulMotionDriver } from '../plugin.js';
