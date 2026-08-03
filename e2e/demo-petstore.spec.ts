import { test, expect } from '@playwright/test';

const mockPets = [
  { id: 1, name: 'Fluffy', status: 'available', category: { id: 1, name: 'Dogs' } },
  { id: 2, name: 'Snowball', status: 'pending', category: { id: 2, name: 'Cats' } },
];

test.describe('AGUL Demo — Petstore UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (!url.includes('petstore.swagger.io')) {
        await route.continue();
        return;
      }
      if (route.request().method() === 'GET' && /petstore\.swagger\.io.*\/pet/.test(url)) {
        if (/\/pet\/\d+/.test(url)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockPets[0]),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockPets),
        });
        return;
      }
      await route.continue();
    });
  });

  test('loads demo and generates sidebar from OpenAPI spec', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('demo-toolbar')).toBeVisible();
    await expect(page.getByTestId('agul-loading')).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId('agul-sidebar')).toBeVisible();
    await expect(page.getByTestId('agul-layout')).toBeVisible();
  });

  test('navigates to pet list and shows mocked data', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('agul-loading')).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId('agul-list-view')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('Fluffy')).toBeVisible();
    await expect(page.getByText('Snowball')).toBeVisible();
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
    const { generateUIFromOpenAPI } = await import('@agul/mcp');

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
