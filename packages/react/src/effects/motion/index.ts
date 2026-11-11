/**
 * `@aikitstudio/agul-react/effects/motion`: enter animations with Motion (motion.dev).
 *
 *   import { motionEffects } from '@aikitstudio/agul-react/effects/motion';
 *   <AGULRenderer spec={spec} motion="playful" effects={[motionEffects()]} />
 *
 * Needs the `motion` package (optional peer, ^14). It is imported only when a page animates.
 */
import type { AgulEffectPlugin } from '../plugin.js';

export function motionEffects(): AgulEffectPlugin {
  return {
    id: 'motion',
    load: () => import('./driver.js').then(({ createMotionDriver }) => createMotionDriver()),
  };
}

export type { AgulEffectPlugin, AgulMotionDriver } from '../plugin.js';
