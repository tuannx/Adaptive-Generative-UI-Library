import { test, expect } from '@playwright/test';
import { setupPetstoreMock } from './helpers/petstore-mock.js';

test.describe('AGUL Demo — Bearer auth header', () => {
  test('sends Authorization header when demo token is set', async ({ page }) => {
    const authHeaders: string[] = [];

    await setupPetstoreMock(page, undefined, {
      onRequest: ({ authorization }) => {
        authHeaders.push(authorization ?? '');
      },
    });

    await page.goto('/?token=demo-jwt-token');
    await page.getByTestId('agul-list-view').waitFor({ state: 'visible', timeout: 15_000 });

    expect(authHeaders.some((header) => header === 'Bearer demo-jwt-token')).toBe(true);
  });
});
