import { expect, type Page } from '@playwright/test';
import { handleHelpdeskMock } from '../../apps/demo/worker/helpdesk-mock.js';

export const HELPDESK_SPEC = '/examples/helpdesk-secured.json';

export async function mockHelpdesk(page: Page) {
  await page.route('**/mock/helpdesk/**', async (route) => {
    const request = route.request();
    const response = await handleHelpdeskMock(
      new Request(request.url(), {
        method: request.method(),
        headers: request.headers(),
        body: request.postData() ?? undefined,
        redirect: 'manual',
      }),
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}

export const sidebar = (page: Page) => page.getByTestId('agul-sidebar');
export const menuItems = (page: Page) => sidebar(page).locator('.ant-menu-item');

export async function signInAs(page: Page, user: 'lan' | 'minh' | 'vy') {
  // the first API call answers 401, which opens the sign-in dialog by itself
  await expect(page.getByTestId('agul-signin-panel')).toBeVisible();
  await page.getByRole('tab', { name: /helpdeskId/ }).click();
  await page.getByTestId('agul-signin-panel').getByRole('button', { name: /Continue with helpdeskId/ }).click();
  await page.getByTestId(`mock-login-${user}`).click();
  await expect(page.getByTestId('agul-user-menu')).toBeVisible();
}

