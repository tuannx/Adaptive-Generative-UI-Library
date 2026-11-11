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
  /**
   * Animates children added, removed or moved inside a container, from now on.
   * Returns a function that stops it. Items that enter after this replace their own enter.
   */
  list?(container: HTMLElement, motion: ResolvedMotion): () => void;
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
    if (driver.list) merged.list = driver.list.bind(driver);
  }
  return merged;
}

/** Elements whose enter already ran, so re-renders, a driver loading later or StrictMode don't replay it. */
const entered = new WeakSet<object>();

/** Containers with a live `list` driver; an item added to one is animated by the list, not its enter. */
const listContainers = new WeakSet<object>();

/**
 * Ref callback that hands a newly mounted element to the driver's `enter` once.
 * Without a driver it only marks the element, so a driver that loads later won't replay it.
 */
export function createEnterRef(driver: AgulMotionDriver | undefined, motion: ResolvedMotion, index: number) {
  return (element: HTMLElement | null) => {
    if (!element || entered.has(element)) return;
    entered.add(element);
    if (element.parentElement && listContainers.has(element.parentElement)) {
      // added after the first render: the list animation plays instead, so drop the CSS enter too
      element.style.animation = 'none';
      return;
    }
    driver?.enter?.(element, motion, index);
  };
}

/**
 * Ref callback that runs the driver's `list` on a container while it is mounted.
 * Children present on the first render keep their enter; later additions get the list animation.
 */
export function createListRef(driver: AgulMotionDriver | undefined, motion: ResolvedMotion) {
  let current: { element: HTMLElement; stop: () => void } | undefined;
  return (element: HTMLElement | null) => {
    if (current && current.element !== element) {
      current.stop();
      listContainers.delete(current.element);
      current = undefined;
    }
    if (!element || current || !driver?.list) return;
    current = { element, stop: driver.list(element, motion) };
    listContainers.add(element);
  };
}
