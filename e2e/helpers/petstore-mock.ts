import type { Page, Route } from '@playwright/test';

export interface MockPet {
  id: number;
  name: string;
  status: string;
  category: { id: number; name: string };
  photoUrls?: string[];
}

export const defaultMockPets: MockPet[] = [
  { id: 1, name: 'Fluffy', status: 'available', category: { id: 1, name: 'Dogs' }, photoUrls: [] },
  { id: 2, name: 'Snowball', status: 'pending', category: { id: 2, name: 'Cats' }, photoUrls: [] },
];

export async function setupPetstoreMock(
  page: Page,
  initialPets = defaultMockPets,
  options?: { onRequest?: (request: { authorization?: string; method: string; url: string }) => void },
): Promise<void> {
  let pets = initialPets.map((p) => ({ ...p }));
  let nextId = Math.max(...pets.map((p) => p.id), 0) + 1;

  await page.route('**/*', async (route: Route) => {
    const url = route.request().url();
    if (!url.includes('petstore.swagger.io')) {
      await route.continue();
      return;
    }

    const method = route.request().method();
    if (!new URL(url).pathname.startsWith('/v2/')) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"missing /v2 base path"}' });
      return;
    }

    options?.onRequest?.({
      authorization: route.request().headers()['authorization'],
      method,
      url,
    });

    if (method === 'GET' && /\/pet\/\d+/.test(url)) {
      const id = Number(url.match(/\/pet\/(\d+)/)?.[1]);
      const pet = pets.find((p) => p.id === id);
      await route.fulfill({
        status: pet ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(pet ?? { message: 'Not found' }),
      });
      return;
    }

    if (method === 'GET' && /\/pet/.test(url) && !/\/pet\/\d+/.test(url)) {
      const urlObj = new URL(url);
      const status = urlObj.searchParams.get('status');
      const filtered = status ? pets.filter((p) => p.status === status) : pets;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(filtered),
      });
      return;
    }

    if (method === 'POST' && /\/pet\/?$/.test(url.replace(/\?.*$/, ''))) {
      const body = route.request().postDataJSON() as Partial<MockPet>;
      const created: MockPet = {
        id: nextId++,
        name: body.name ?? 'New Pet',
        status: body.status ?? 'available',
        category: body.category ?? { id: 1, name: 'Dogs' },
        photoUrls: body.photoUrls ?? [],
      };
      pets.push(created);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    if (method === 'PUT') {
      const body = route.request().postDataJSON() as MockPet;
      const idx = pets.findIndex((p) => p.id === body.id);
      if (idx >= 0) {
        pets[idx] = { ...pets[idx], ...body };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
      return;
    }

    if (method === 'DELETE' && /\/pet\/\d+/.test(url)) {
      const id = Number(url.match(/\/pet\/(\d+)/)?.[1]);
      pets = pets.filter((p) => p.id !== id);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }

    await route.continue();
  });
}

export async function waitForAgulReady(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('agul-loading').waitFor({ state: 'hidden', timeout: 15_000 });
  await page.getByTestId('agul-list-view').waitFor({ state: 'visible', timeout: 10_000 });
}
