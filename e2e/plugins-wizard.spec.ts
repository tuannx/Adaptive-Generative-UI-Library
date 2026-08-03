import { test, expect } from '@playwright/test';
import { setupPetstoreMock } from './helpers/petstore-mock.js';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function loadPluginsWizardDemo(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('demo-load-plugins-spec').click();
  await page.getByTestId('agul-loading').waitFor({ state: 'hidden', timeout: 15_000 });
  await page.getByTestId('agul-list-view').waitFor({ state: 'visible', timeout: 10_000 });
}

test.describe('AGUL Demo — plugins and wizard', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await setupPetstoreMock(page);
  });

  test('renders wizard steps and plugin fields on create', async ({ page }) => {
    await loadPluginsWizardDemo(page);

    await page.getByTestId('agul-list-view').getByRole('button', { name: 'Create New' }).click();
    await expect(page.getByTestId('agul-form-wizard')).toBeVisible();
    await expect(page.getByTestId('agul-form-wizard')).toContainText('Basics');
    await expect(page.getByTestId('agul-form-wizard')).toContainText('Media');
    await expect(page.getByTestId('agul-form-wizard')).toContainText('Notes');

    await page.getByLabel('Name').fill('Plugin Pet');
    await page.locator('.ant-form-item').filter({ hasText: 'Status' }).locator('.ant-select').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'available' }).click();

    await page.getByTestId('agul-wizard-next').click();
    await expect(page.getByTestId('agul-plugin-image-upload-photoUrls')).toBeVisible();
    await expect(page.getByTestId('agul-plugin-color-picker-accentColor')).toBeVisible();

    await page
      .getByTestId('agul-plugin-image-upload-photoUrls')
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'pet.png',
        mimeType: 'image/png',
        buffer: tinyPng,
      });

    await page.getByTestId('agul-wizard-next').click();
    await page.getByLabel('Notes').fill('Created via plugin wizard');

    await page.getByTestId('agul-form-submit').click();
    await expect(page.getByTestId('agul-list-view')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('agul-list-table')).toContainText('Plugin Pet');
  });

  test('wizard validates required fields before advancing', async ({ page }) => {
    await loadPluginsWizardDemo(page);

    await page.getByTestId('agul-list-view').getByRole('button', { name: 'Create New' }).click();
    await page.getByTestId('agul-wizard-next').click();

    await expect(page.getByText('Please input Name')).toBeVisible();
    await expect(page.getByTestId('agul-form-wizard')).toBeVisible();
  });
});
