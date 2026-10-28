import { test, expect } from '@playwright/test';
import { HELPDESK_SPEC, mockHelpdesk, signInAs } from './helpers/helpdesk.js';
import { setupPetstoreMock, waitForAgulReady } from './helpers/petstore-mock.js';

test.describe('AGUL — forms and lists', () => {
  test('validates on the client, maps server field errors, and asks before discarding', async ({ page }) => {
    await mockHelpdesk(page);
    await page.goto(`/?spec=${HELPDESK_SPEC}`);
    await signInAs(page, 'lan');

    await page.getByTestId('agul-list-view').getByRole('button', { name: 'Create New' }).click();
    await expect(page.getByTestId('agul-form-view')).toBeVisible();
    await page.getByLabel('Title').fill('ab');
    await page.getByLabel('Requester').fill('someone@blocked.test');
    await page.getByTestId('agul-form-submit').click();
    await expect(page.getByText('Title needs at least 3 characters')).toBeVisible();

    await page.getByLabel('Title').fill('Laptop will not boot');
    await page.getByTestId('agul-form-submit').click();
    await expect(page.locator('.ant-form-item').filter({ hasText: 'Requester' })).toContainText('requester is on the block list');
    await expect(page.getByText(/Validation failed \(HTTP 422\)/)).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.ant-modal-confirm-title')).toHaveText('Discard your changes?');
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByTestId('agul-list-view')).toBeVisible();
  });

  test('remembers filters when coming back from a record, and deletes in bulk', async ({ page }) => {
    await mockHelpdesk(page);
    await page.goto(`/?spec=${HELPDESK_SPEC}`);
    await signInAs(page, 'lan');

    await page.getByTestId('agul-list-filter-status').click();
    await page.locator('.ant-select-item-option').filter({ hasText: /^open$/ }).click();
    await expect(page.getByTestId('agul-list-table')).not.toContainText('Invoice shows the wrong VAT');
    await page.getByTestId('agul-action-view-T-1001').click();
    await expect(page.getByTestId('agul-detail-view')).toContainText('Cannot reset my password');
    await page.getByTestId('agul-detail-back').click();
    await expect(page.getByTestId('agul-list-filter-status')).toContainText('open');
    await expect(page.getByTestId('agul-list-table')).not.toContainText('Invoice shows the wrong VAT');

    const table = page.getByTestId('agul-list-table');
    await table.locator('tr[data-row-key="T-1001"] .ant-checkbox').click();
    await table.locator('tr[data-row-key="T-1003"] .ant-checkbox').click();
    await page.getByTestId('agul-list-bulk-delete').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Deleted 2 items')).toBeVisible();
    await expect(table.locator('tbody tr.ant-table-row')).toHaveCount(0);
    await expect(page.getByText('Nothing matches the search or filters')).toBeVisible();
  });

  test('edits arrays of objects (Petstore tags)', async ({ page }) => {
    await setupPetstoreMock(page);
    await waitForAgulReady(page);
    const posted = page.waitForRequest((request) => request.method() === 'POST' && /\/pet\/?$/.test(new URL(request.url()).pathname));

    await page.getByTestId('agul-list-view').getByRole('button', { name: 'Create New' }).click();
    await expect(page.getByTestId('agul-form-view')).toBeVisible();
    await page.getByLabel('Name', { exact: true }).fill('Tagged');
    const photoUrls = page.locator('.ant-form-item').filter({ hasText: 'Photo Urls' }).locator('input');
    await photoUrls.fill('https://example.com/tagged.jpg');
    await photoUrls.press('Enter');
    const tags = page.getByTestId('agul-form-list-tags');
    await tags.getByRole('button', { name: 'Add tag' }).click();
    await tags.getByRole('button', { name: 'Add tag' }).click();
    await tags.getByLabel('Name').nth(0).fill('friendly');
    await tags.getByLabel('Name').nth(1).fill('vaccinated');
    await tags.getByRole('button', { name: 'Remove' }).nth(0).click();
    await page.getByTestId('agul-form-submit').click();

    const body = (await posted).postDataJSON();
    expect(body.tags).toEqual([{ name: 'vaccinated' }]);
  });
});
