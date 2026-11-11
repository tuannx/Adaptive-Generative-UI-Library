import React from 'react';
import { resolveMotion, type MotionConfig, type MotionRegion, type ResolvedMotion } from '@aikitstudio/agul-core';
import { enterStyle, MOTION_CSS } from './css-motion.js';
import { usePrefersReducedMotion } from './reduced-motion.js';

interface MotionState {
  config?: MotionConfig;
  prefersReducedMotion: boolean;
}

const MotionContext = React.createContext<MotionState>({ prefersReducedMotion: false });

/**
 * Turns motion on for the AGUL components below it. Without a provider, or with no `config`,
 * nothing animates and nothing is added to the page.
 */
export function AgulMotionProvider({ config, children }: { config?: MotionConfig; children: React.ReactNode }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const value = React.useMemo(() => ({ config, prefersReducedMotion }), [config, prefersReducedMotion]);
  return (
    <MotionContext.Provider value={value}>
      {config && <style data-agul-motion="">{MOTION_CSS}</style>}
      {children}
    </MotionContext.Provider>
  );
}

/** Resolved settings for a region, or `undefined` when no motion config is in effect. */
export function useAgulMotion(region: MotionRegion): ResolvedMotion | undefined {
  const { config, prefersReducedMotion } = React.useContext(MotionContext);
  return React.useMemo(
    () => (config ? resolveMotion(config, region, { prefersReducedMotion }) : undefined),
    [config, region, prefersReducedMotion],
  );
}

/** `(index) => style` that plays a region's enter animation, staggered by index. */
export function useEnterStyle(region: MotionRegion): (index?: number) => React.CSSProperties | undefined {
  const motion = useAgulMotion(region);
  return React.useCallback((index = 0) => enterStyle(motion, index), [motion]);
}
