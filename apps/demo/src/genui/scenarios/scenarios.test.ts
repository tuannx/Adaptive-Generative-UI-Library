import { describe, expect, it } from 'vite-plus/test';
import { parseOpenAPISync, planUi, schemaDefaultsForTest } from './test-helpers.js';
import { scenarios } from './index.js';

describe('generative UI scenarios', () => {
  for (const scenario of scenarios) {
    describe(scenario.id, () => {
      const plan = planUi(parseOpenAPISync(structuredClone(scenario.spec)));
      const page = plan.pages[0];

      it('is one action page with its own confirm label', () => {
        expect(plan.pages).toHaveLength(1);
        expect(page?.kind).toBe('action');
        expect(page?.decidedBy).toBe('spec');
        expect(page?.submitLabel).toBeTruthy();
      });

      it('answers the confirm call with one done row per step for the proposed values', () => {
        const rows = scenario.respond(schemaDefaultsForTest(page?.body)) as Array<Record<string, unknown>>;
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => row.status === 'done' && typeof row.result === 'string')).toBe(true);
      });
    });
  }

  it('skips the sick-day steps the user switched off', () => {
    const sickDay = scenarios.find((scenario) => scenario.id === 'sick-day')!;
    const rows = sickDay.respond({ soup: { include: false } }) as Array<Record<string, unknown>>;
    expect(rows.find((row) => row.step === 'soup')).toMatchObject({ status: 'skipped', result: 'No soup ordered' });
    expect(rows).toHaveLength(6);
  });
});
