import { test, expect } from '@playwright/test';

// A YAML spec exercising shapes found in real APIs (Twilio, Stripe, GitHub, Django REST):
// nested collection under a path param, list envelope with a resource-named key,
// trailing slashes, and an x-www-form-urlencoded create body.
const SPEC_URL = 'https://specs.example.test/team.yaml';
const API = 'https://api.example.test/v1';

const specYaml = `
openapi: 3.0.3
info: { title: Team API, version: '2.1' }
servers: [{ url: '${API}' }]
paths:
  /orgs/{org}/members/:
    parameters:
      - { name: org, in: path, required: true, schema: { type: string } }
    get:
      tags: [members]
      summary: List members
      responses:
        '200': { $ref: '#/components/responses/MemberPage' }
    post:
      tags: [members]
      summary: Add member
      requestBody:
        content:
          application/x-www-form-urlencoded:
            schema:
              type: object
              required: [login]
              properties:
                login: { type: string }
                role: { type: string, enum: [admin, member] }
      responses:
        '201': { description: Created }
  /orgs/{org}/members/{login}/:
    parameters:
      - { name: org, in: path, required: true, schema: { type: string } }
      - { name: login, in: path, required: true, schema: { type: string } }
    get:
      tags: [members]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Member' }
components:
  schemas:
    Member:
      type: object
      properties:
        login: { type: string }
        role: { type: string }
  responses:
    MemberPage:
      description: OK
      content:
        application/json:
          schema:
            type: object
            properties:
              members: { type: array, items: { $ref: '#/components/schemas/Member' } }
              next_page_uri: { type: string }
`;

test.describe('AGUL Demo — real-world spec shapes', () => {
  test('loads a YAML spec by URL and handles nested, enveloped, urlencoded resources', async ({ page }) => {
    const members = [{ login: 'ada', role: 'admin' }];
    const posts: Array<{ contentType?: string; body: string | null }> = [];

    await page.route(SPEC_URL, (route) =>
      route.fulfill({ contentType: 'application/yaml', body: specYaml }),
    );
    await page.route(`${API}/**`, async (route) => {
      const request = route.request();
      const { pathname } = new URL(request.url());
      if (request.method() === 'POST' && pathname === '/v1/orgs/acme/members/') {
        posts.push({ contentType: request.headers()['content-type'], body: request.postData() });
        const body = new URLSearchParams(request.postData() ?? '');
        members.push({ login: body.get('login') ?? '', role: body.get('role') ?? 'member' });
        return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      }
      if (request.method() === 'GET' && pathname === '/v1/orgs/acme/members/') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ members, next_page_uri: null }),
        });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/');
    await page.getByTestId('demo-spec-url').fill(SPEC_URL);
    await page.getByTestId('demo-toolbar').getByRole('button', { name: 'Load', exact: true }).click();
    await expect(page).toHaveURL(/spec=https/);

    await page.getByTestId('agul-sidebar').getByText('List members').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Org').fill('acme');
    await dialog.getByRole('button', { name: 'Open' }).click();

    await expect(page).toHaveURL(/\/orgs\/acme\/members(\?|$)/);
    await expect(page.getByTestId('agul-list-table')).toContainText('ada');

    await page.getByTestId('agul-list-view').getByRole('button', { name: 'Create New' }).click();
    await page.getByLabel('Login').fill('grace');
    await page.getByTestId('agul-form-submit').click();

    await expect(page.getByTestId('agul-list-table')).toContainText('grace');
    expect(posts).toHaveLength(1);
    expect(posts[0].contentType).toContain('application/x-www-form-urlencoded');
    expect(posts[0].body).toBe('login=grace');
  });
});
