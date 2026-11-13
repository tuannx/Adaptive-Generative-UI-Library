import { describe, expect, it } from 'vite-plus/test';
import { summarizeSteps } from './reply.js';

const row = (result: string, status: string) => ({ step: 'x', result, status });

describe('summarizeSteps', () => {
  it('says all done when every step went through', () => {
    expect(summarizeSteps([row('A', 'done'), row('B', 'done')])?.lead).toBe('Done. All 2 are taken care of.');
  });

  it('counts skipped steps', () => {
    const reply = summarizeSteps([row('A', 'done'), row('Skipped', 'skipped')]);
    expect(reply?.lead).toBe('Done. 1 of 2 sent, the rest skipped as you asked.');
    expect(reply?.lines).toEqual([{ text: 'A', done: true }, { text: 'Skipped', done: false }]);
  });

  it('says nothing was sent when all are skipped', () => {
    expect(summarizeSteps([row('Skipped', 'skipped')])?.lead).toBe('Nothing was sent.');
  });

  it('leaves other shapes to the generic view', () => {
    expect(summarizeSteps({ ok: true })).toBeNull();
    expect(summarizeSteps([1, 2])).toBeNull();
  });
});
