import { describe, it, expect } from 'vite-plus/test';
import { resolveMotion } from '@aikitstudio/agul-core';
import { createEnterRef, mergeDrivers, type AgulMotionDriver } from './plugin.js';

const motion = resolveMotion({ preset: 'smooth' }, 'cards');
const fakeElement = () => ({}) as HTMLElement;

describe('mergeDrivers', () => {
  it('is undefined with nothing loaded', () => {
    expect(mergeDrivers([])).toBeUndefined();
  });

  it('lets later drivers win per method and keeps earlier ones', () => {
    const calls: string[] = [];
    const a: AgulMotionDriver = { id: 'a', enter: () => calls.push('a') };
    const b: AgulMotionDriver = { id: 'b' };
    const c: AgulMotionDriver = { id: 'c', enter: () => calls.push('c') };
    mergeDrivers([a, b])!.enter!(fakeElement(), motion, 0);
    mergeDrivers([a, c])!.enter!(fakeElement(), motion, 0);
    expect(calls).toEqual(['a', 'c']);
    expect(mergeDrivers([a, c])!.id).toBe('a+c');
  });
});

describe('createEnterRef', () => {
  it('hands each element to the driver once, with its index', () => {
    const seen: number[] = [];
    const driver: AgulMotionDriver = { id: 'x', enter: (_el, _motion, index) => seen.push(index) };
    const element = fakeElement();
    createEnterRef(driver, motion, 3)(element);
    createEnterRef(driver, motion, 3)(element); // re-render with a new ref callback
    createEnterRef(driver, motion, 4)(null); // unmount
    expect(seen).toEqual([3]);
  });

  it('marks elements seen before a driver loads, so they are not replayed', () => {
    const seen: number[] = [];
    const element = fakeElement();
    createEnterRef(undefined, motion, 0)(element);
    createEnterRef({ id: 'late', enter: (_el, _m, index) => seen.push(index) }, motion, 0)(element);
    expect(seen).toEqual([]);
  });
});
