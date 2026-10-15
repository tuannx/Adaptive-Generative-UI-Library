import { test, expect } from '@playwright/test';
import { setupPetstoreMock, waitForAgulReady } from './helpers/petstore-mock.js';

test.describe('AGUL Demo — CRUD flow', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await setupPetstoreMock(page);
  });

  test('list → detail → edit → create → delete', async ({ page }) => {
    await waitForAgulReady(page);

    await expect(page.getByTestId('agul-list-table')).toContainText('Fluffy');
    await expect(page.getByTestId('agul-list-table')).toContainText('Snowball');

    // List → Detail → List
    await page.getByTestId('agul-action-view-1').click();
    await expect(page.getByTestId('agul-detail-view')).toBeVisible();
    await expect(page.getByText('Fluffy', { exact: true })).toBeVisible();
    await page.getByTestId('agul-detail-back').click();
    await expect(page.getByTestId('agul-list-view')).toBeVisible();

    // List → Edit → List
    await page.getByTestId('agul-action-edit-1').click();
    await expect(page.getByTestId('agul-form-view')).toBeVisible();
    await page.getByLabel('Name', { exact: true }).fill('Fluffy Updated');
    const editPhotoUrls = page.locator('.ant-form-item').filter({ hasText: 'Photo Urls' }).locator('input');
    if (await editPhotoUrls.count()) {
      await editPhotoUrls.fill('https://example.com/fluffy.jpg');
      await editPhotoUrls.press('Enter');
    }
    await page.getByTestId('agul-form-submit').click();
    await expect(page.getByTestId('agul-list-view')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('agul-list-table')).toContainText('Fluffy Updated');

    // List → Create → List
    await page.getByTestId('agul-list-view').getByRole('button', { name: 'Create New' }).click();
    await expect(page.getByTestId('agul-form-view')).toBeVisible();

    await page.getByLabel('Name', { exact: true }).fill('Buddy');
    const photoUrlsField = page.locator('.ant-form-item').filter({ hasText: 'Photo Urls' }).locator('input');
    if (await photoUrlsField.count()) {
      await photoUrlsField.fill('https://example.com/buddy.jpg');
      await photoUrlsField.press('Enter');
    }
    const statusSelect = page.locator('.ant-form-item').filter({ hasText: 'Status' }).locator('.ant-select');
    if (await statusSelect.count()) {
      await statusSelect.click();
      await page.locator('.ant-select-item-option').filter({ hasText: 'available' }).click();
    }

    await page.getByTestId('agul-form-submit').click();
    await expect(page.getByTestId('agul-list-view')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('agul-list-table')).toContainText('Buddy');

    // Detail → Delete → List
    await page.getByTestId('agul-action-view-3').click();
    await expect(page.getByTestId('agul-detail-view')).toBeVisible();

    const deleteButton = page.getByRole('button', { name: 'Delete' });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.getByTestId('agul-list-view')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('agul-list-table')).not.toContainText('Buddy');
    await expect(page.getByTestId('agul-list-table')).toContainText('Snowball');
  });

  test('delete from list via row action', async ({ page }) => {
    await waitForAgulReady(page);

    await page.getByTestId('agul-action-delete-2').click();
    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.getByTestId('agul-list-table')).not.toContainText('Snowball');
    await expect(page.getByTestId('agul-list-table')).toContainText('Fluffy');
  });

  test('filters list via status query param', async ({ page }) => {
    await waitForAgulReady(page);

    await page.getByTestId('agul-list-filter-status').click();
    await page
      .locator('.ant-select-dropdown:visible .ant-select-item-option')
      .filter({ hasText: 'pending' })
      .click();

    await expect(page.getByTestId('agul-list-table')).toContainText('Snowball');
    await expect(page.getByTestId('agul-list-table')).not.toContainText('Fluffy');
  });

  test('searches list client-side when no search param', async ({ page }) => {
    await waitForAgulReady(page);

    await page.getByTestId('agul-list-search').fill('Snow');
    await expect(page.getByTestId('agul-list-table')).toContainText('Snowball');
    await expect(page.getByTestId('agul-list-table')).not.toContainText('Fluffy');
  });
});

test.describe('AGUL Demo — resource model', () => {
  test.beforeEach(async ({ page }) => {
    await setupPetstoreMock(page);
  });

  test('edit page deep link prefills from the detail endpoint', async ({ page }) => {
    await page.goto('/pet/findByStatus/1/edit');
    await expect(page.getByTestId('agul-form-view')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Fluffy');
    await expect(page.getByLabel('Category name')).toHaveValue('Dogs');
  });

  test('create-only resources are reachable from the menu', async ({ page }) => {
    await waitForAgulReady(page);
    await page.getByTestId('agul-sidebar').getByText('Store', { exact: true }).click();
    await page.getByTestId('agul-sidebar').getByText('Place an order for a pet').click();
    await expect(page.getByTestId('agul-form-view')).toBeVisible();
    await expect(page.getByLabel('Ship Date')).toBeVisible();
  });
});
