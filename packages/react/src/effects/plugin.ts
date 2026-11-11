/**
 * Effect plugins: optional animation libraries that replace parts of the CSS driver.
 * A plugin is a tiny object whose `load()` dynamic-imports the library, so nothing is fetched
 * until a page actually animates, and hosts that never pass one never pull the library in.
 */
import type { ResolvedMotion } from '@aikitstudio/agul-core';

/** What a loaded plugin can take over. Every method is optional; missing ones fall back to CSS. */
export interface AgulMotionDriver {
  id: string;
  /**
   * Plays the enter of an element that just mounted. Called once per element, during commit
   * (before paint), so the driver can set the start state without a flash.
   */
  enter?(element: HTMLElement, motion: ResolvedMotion, index: number): void;
}

/** Passed in `AGULRenderer effects={[...]}`; later plugins win per method. */
export interface AgulEffectPlugin {
  id: string;
  load(): Promise<AgulMotionDriver>;
}

/** Combines loaded drivers, later ones winning per method. `undefined` when none are loaded. */
export function mergeDrivers(drivers: readonly AgulMotionDriver[]): AgulMotionDriver | undefined {
  if (drivers.length === 0) return undefined;
  const merged: AgulMotionDriver = { id: drivers.map((driver) => driver.id).join('+') };
  for (const driver of drivers) {
    if (driver.enter) merged.enter = driver.enter.bind(driver);
  }
  return merged;
}

/** Elements whose enter already ran, so re-renders, a driver loading later or StrictMode don't replay it. */
const entered = new WeakSet<object>();

/**
 * Ref callback that hands a newly mounted element to the driver's `enter` once.
 * Without a driver it only marks the element, so a driver that loads later won't replay it.
 */
export function createEnterRef(driver: AgulMotionDriver | undefined, motion: ResolvedMotion, index: number) {
  return (element: HTMLElement | null) => {
    if (!element || entered.has(element)) return;
    entered.add(element);
    driver?.enter?.(element, motion, index);
  };
}
