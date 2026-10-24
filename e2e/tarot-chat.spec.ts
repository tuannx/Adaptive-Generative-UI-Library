import { test, expect, type Page } from '@playwright/test';
import { handleTarotMock } from '../apps/demo/worker/tarot-mock.js';

const SPEC = '/examples/tarot-chat.json';

async function mockTarotBackend(page: Page) {
  await page.route('**/mock/tarot/**', async (route) => {
    const request = route.request();
    const response = await handleTarotMock(
      new Request(request.url(), { method: request.method(), body: request.postData() ?? undefined }),
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}

const sidebar = (page: Page) => page.getByTestId('agul-sidebar');

/** Clicks a menu entry, opening its group first only if the entry isn't visible yet. */
async function openMenu(page: Page, group: string, item: string) {
  const entry = sidebar(page).locator('.ant-menu-item').filter({ hasText: item });
  if (!(await entry.isVisible())) {
    await sidebar(page).locator('.ant-menu-submenu-title').filter({ hasText: new RegExp(`^${group}$`) }).click();
  }
  await entry.click();
}

const isDecideCall = (url: URL) => url.pathname === '/decide';

test.describe('AGUL — tarot chat backend', () => {
  test.beforeEach(async ({ page }) => {
    await mockTarotBackend(page);
  });

  test('chat endpoint gets a conversation UI with streamed replies', async ({ page }) => {
    await page.goto(`/?spec=${SPEC}`);
    await openMenu(page, 'Chat', 'Chat with the reader');

    await expect(page.getByTestId('agul-chat-view')).toBeVisible();
    await page.getByTestId('agul-chat-input').fill('Will I find love?');
    await page.getByTestId('agul-chat-send').click();

    const reply = page.getByTestId('agul-chat-message-assistant').last();
    await expect(reply).toContainText('You asked: "Will I find love?"');
    await expect(reply).toContainText('Sit with that');

    await page.getByTestId('agul-chat-input').fill('And my career?');
    await page.getByTestId('agul-chat-input').press('Enter');
    await expect(page.getByTestId('agul-chat-message-user')).toHaveCount(2);
    await expect(page.getByTestId('agul-chat-message-assistant').last()).toContainText('And my career?');
  });

  test('non-CRUD POST becomes an action form whose result shows up in the CRUD list', async ({ page }) => {
    await page.goto(`/?spec=${SPEC}`);
    await openMenu(page, 'Readings', 'Draw a reading');

    await expect(page.getByTestId('agul-action-view')).toBeVisible();
    await page.getByLabel('Question').fill('What about my new job?');
    await page.locator('.ant-form-item').filter({ hasText: 'Spread' }).locator('.ant-select').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'three-card' }).click();
    await page.getByTestId('agul-action-run').click();

    const result = page.getByTestId('agul-action-result');
    await expect(result).toContainText('HTTP 200');
    await expect(result).toContainText('Past');
    await expect(result).toContainText('Future');

    await openMenu(page, 'Readings', 'Readings');
    await expect(page.getByTestId('agul-list-table')).toContainText('What about my new job?');
  });

  test('decision API can relabel and hide operations', async ({ page }) => {
    const seen: unknown[] = [];
    await page.route(isDecideCall, async (route) => {
      seen.push(route.request().postDataJSON());
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          decisions: [
            { operationId: 'health', kind: 'hidden' },
            { operationId: 'drawReading', kind: 'action', label: 'Rút bài', group: 'readings' },
          ],
        }),
      });
    });

    await page.goto(`/?spec=${SPEC}&decide=/decide`);
    await expect(page.getByTestId('agul-decision-status')).toHaveText('AI layout');
    await openMenu(page, 'Readings', 'Rút bài');
    await expect(page.getByTestId('agul-action-view')).toContainText('Rút bài');
    await sidebar(page).locator('.ant-menu-submenu-title').filter({ hasText: /^Ops$/ }).click();
    await expect(sidebar(page).locator('.ant-menu-item').filter({ hasText: 'Flush interpretation cache' })).toBeVisible();
    await expect(sidebar(page).getByText('Liveness probe')).toHaveCount(0);

    const body = seen[0] as { title: string; operations: Array<{ operationId: string; current: { kind: string } }> };
    expect(body.title).toBe('Tarot Chat API');
    expect(body.operations.find((op) => op.operationId === 'chatWithReader')?.current.kind).toBe('chat');
  });

  test('a failing decision API keeps the rule-based layout', async ({ page }) => {
    await page.route(isDecideCall, (route) => route.fulfill({ status: 503, body: 'down' }));
    await page.goto(`/?spec=${SPEC}&decide=/decide`);

    await expect(page.getByTestId('agul-decision-status')).toHaveAttribute('data-status', 'error');
    await openMenu(page, 'Chat', 'Chat with the reader');
    await expect(page.getByTestId('agul-chat-view')).toBeVisible();
  });
});
