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
    await page.getByLabel('Name').fill('Fluffy Updated');
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

    await page.getByLabel('Name').fill('Buddy');
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
});
