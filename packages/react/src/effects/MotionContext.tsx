import React from 'react';
import { resolveMotion, type MotionConfig, type MotionRegion, type ResolvedMotion } from '@aikitstudio/agul-core';
import { enterStyle, MOTION_CSS } from './css-motion.js';
import { useEffectDriver } from './load-effects.js';
import { createEnterRef, type AgulEffectPlugin, type AgulMotionDriver } from './plugin.js';
import { usePrefersReducedMotion } from './reduced-motion.js';

interface MotionState {
  config?: MotionConfig;
  prefersReducedMotion: boolean;
  driver?: AgulMotionDriver;
}

const MotionContext = React.createContext<MotionState>({ prefersReducedMotion: false });

interface AgulMotionProviderProps {
  config?: MotionConfig;
  /** Optional animation libraries, loaded on demand; the CSS driver covers whatever they don't. */
  effects?: readonly AgulEffectPlugin[];
  children: React.ReactNode;
}

/**
 * Turns motion on for the AGUL components below it. Without a provider, or with no `config`,
 * nothing animates, no plugin is loaded and nothing is added to the page.
 */
export function AgulMotionProvider({ config, effects, children }: AgulMotionProviderProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const driver = useEffectDriver(effects, !!config);
  const value = React.useMemo(() => ({ config, prefersReducedMotion, driver }), [config, prefersReducedMotion, driver]);
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

/** Props that play an element's enter: a CSS animation, or a ref for a loaded plugin driver. */
export interface EnterProps {
  style?: React.CSSProperties;
  ref?: (element: HTMLElement | null) => void;
}

/**
 * `(index) => props` to spread on each animated element of a region, staggered by index.
 * Returns `{}` when motion is off, so nothing changes in the DOM.
 */
export function useEnter(region: MotionRegion): (index?: number) => EnterProps {
  const motion = useAgulMotion(region);
  const { driver } = React.useContext(MotionContext);
  return React.useCallback(
    (index = 0): EnterProps => {
      if (!motion?.enabled || motion.enter === 'none') return {};
      const ref = createEnterRef(driver, motion, index);
      return driver?.enter ? { ref } : { style: enterStyle(motion, index), ref };
    },
    [motion, driver],
  );
}
