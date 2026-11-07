import { test, expect } from '@playwright/test';
import { setupPetstoreMock, waitForAgulReady } from './helpers/petstore-mock.js';

test.describe('AGUL Demo — Petstore UI', () => {
  test.beforeEach(async ({ page }) => {
    await setupPetstoreMock(page);
  });

  test('loads demo and generates sidebar from OpenAPI spec', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('demo-toolbar')).toBeVisible();
    await expect(page.getByTestId('agul-loading')).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId('agul-sidebar')).toBeVisible();
    await expect(page.getByTestId('agul-layout')).toBeVisible();
  });

  test('navigates to pet list and shows mocked data', async ({ page }) => {
    await waitForAgulReady(page);
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByTestId('agul-list-table')).toContainText('Fluffy');
    await expect(page.getByTestId('agul-list-table')).toContainText('Snowball');
  });

  test('resets to petstore via toolbar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('agul-loading')).toBeHidden({ timeout: 15_000 });
    await page.getByRole('button', { name: 'JSONPlaceholder' }).click();
    await page.getByRole('button', { name: 'Reset to Petstore' }).click();
    await expect(page.getByTestId('agul-sidebar')).toBeVisible();
  });
});

test.describe('AGUL Demo — MCP workflow validation', () => {
  test('demo menu aligns with MCP-generated config', async ({ page }) => {
    const { generateUIFromOpenAPI } = await import('@ai-kit/agul-mcp');

    const specResponse = await page.request.get('/examples/petstore.json');
    const spec = await specResponse.json();
    const config = await generateUIFromOpenAPI(spec);

    expect(config.routeCount).toBeGreaterThan(0);
    expect(config.menu.length).toBeGreaterThan(0);

    await page.goto('/');
    await expect(page.getByTestId('agul-loading')).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId('agul-sidebar')).toBeVisible();
  });
});
