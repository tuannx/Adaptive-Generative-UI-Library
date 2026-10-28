import { test, expect } from '@playwright/test';
import { HELPDESK_SPEC as SPEC, menuItems, mockHelpdesk, sidebar, signInAs } from './helpers/helpdesk.js';

test.describe('AGUL — secured API (OpenID Connect, scopes, roles)', () => {
  test.beforeEach(async ({ page }) => {
    await mockHelpdesk(page);
  });

  test('asks to sign in when the API answers 401', async ({ page }) => {
    await page.goto(`/?spec=${SPEC}`);
    await expect(page.getByTestId('agul-signin-notice')).toContainText('needs you to sign in');
    await expect(page.getByRole('tab', { name: /helpdeskId/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /serviceKey/ })).toBeVisible();
  });

  test('a viewer signs in with OIDC + PKCE and only sees read-only pages', async ({ page }) => {
    await page.goto(`/?spec=${SPEC}`);
    await signInAs(page, 'vy');

    await expect(page).toHaveURL(/spec=/);
    await expect(page).not.toHaveURL(/code=|state=/);
    await expect(page.getByTestId('agul-list-table')).toContainText('Cannot reset my password');
    await expect(page.getByTestId('agul-list-view').getByRole('button', { name: 'Create New' })).toHaveCount(0);
    await expect(page.locator('[data-testid^="agul-action-delete-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="agul-action-edit-"]')).toHaveCount(0);
    await expect(menuItems(page)).not.toContainText(['Users']);
    await expect(sidebar(page)).not.toContainText('Rebuild search index');

    await page.getByTestId('agul-user-menu').click();
    await expect(page.getByTestId('agul-user-authorities')).toContainText('viewer');
    await expect(page.getByTestId('agul-user-authorities')).toContainText('tickets:read');
  });

  test('an admin gets every page and can create and delete', async ({ page }) => {
    await page.goto(`/?spec=${SPEC}`);
    await signInAs(page, 'lan');

    await expect(sidebar(page)).toContainText('Users');
    await expect(sidebar(page)).toContainText('Rebuild search index');

    await page.getByTestId('agul-list-view').getByRole('button', { name: 'Create New' }).click();
    await expect(page.getByTestId('agul-form-view')).toBeVisible();
    await page.getByLabel('Title').fill('Printer on fire');
    await page.getByLabel('Requester').fill('ops@example.com');
    await page.getByTestId('agul-form-submit').click();
    await expect(page.getByTestId('agul-list-table')).toContainText('Printer on fire');

    const row = page.getByTestId('agul-list-table').locator('tr').filter({ hasText: 'Printer on fire' });
    await row.locator('[data-testid^="agul-action-delete-"]').click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByTestId('agul-list-table')).not.toContainText('Printer on fire');
  });

  test('an agent can edit but not delete; sign out returns to signed-out state', async ({ page }) => {
    await page.goto(`/?spec=${SPEC}`);
    await signInAs(page, 'minh');

    await expect(page.locator('[data-testid^="agul-action-edit-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="agul-action-delete-"]')).toHaveCount(0);
    await expect(sidebar(page)).not.toContainText('Users');

    await page.getByTestId('agul-user-menu').click();
    await page.getByTestId('agul-signout').click();
    await expect(page.getByTestId('agul-signin')).toBeVisible();
  });

  test('a service API key works from the API key tab', async ({ page }) => {
    await page.goto(`/?spec=${SPEC}`);
    await page.getByRole('tab', { name: /serviceKey/ }).click();
    await page.getByTestId('agul-signin-apikey').fill('demo-service-key');
    await page.getByRole('button', { name: 'Save key' }).click();
    await expect(page.getByTestId('agul-list-table')).toContainText('Invoice shows the wrong VAT');
    await expect(sidebar(page)).toContainText('Users');
  });
});
