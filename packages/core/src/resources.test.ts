import { describe, it, expect } from 'vite-plus/test';
import { parseOpenAPISync } from './parser.js';
import { buildResources, buildMenu } from './resources.js';
import { dereferenceSchema, MAX_REF_DEPTH } from './schema.js';
import { buildApiUrl, generateRoutes } from './generator.js';
import { buildListApiUrl } from './list-query.js';
import petstore from '../../../apps/demo/public/examples/petstore.json' with { type: 'json' };

describe('buildResources (Petstore, Swagger 2.0)', () => {
  const parsed = parseOpenAPISync(petstore);
  const resources = buildResources(parsed);
  const byKey = Object.fromEntries(resources.map((r) => [r.key, r]));

  it('exposes info title and version', () => {
    expect(parsed.title).toBe('Swagger Petstore');
    expect(parsed.version).toBe('1.0.7');
  });

  it('lets /pet/findByStatus borrow item operations from /pet/{petId}', () => {
    const findByStatus = byKey['/pet/findByStatus'];
    expect(findByStatus.idParam).toBe('petId');
    expect(findByStatus.detail?.apiEndpoint).toBe('/pet/{petId}');
    expect(findByStatus.remove?.apiEndpoint).toBe('/pet/{petId}');
    expect(findByStatus.update).toMatchObject({ method: 'put', apiEndpoint: '/pet' });
    expect(findByStatus.create?.apiEndpoint).toBe('/pet');
    expect(findByStatus.paths).toEqual({
      list: '/pet/findByStatus',
      detail: '/pet/findByStatus/:petId',
      create: '/pet/findByStatus/new',
      edit: '/pet/findByStatus/:petId/edit',
    });
  });

  it('dereferences the record schema', () => {
    const pet = byKey['/pet/findByStatus'].recordSchema!;
    expect(pet.title).toBe('Pet');
    expect(pet.properties?.category?.properties?.name).toEqual({ type: 'string' });
    expect(pet.properties?.tags?.items?.title).toBe('Tag');
  });

  it('does not emit /pet as a duplicate resource once borrowed', () => {
    expect(byKey['/pet']).toBeUndefined();
  });

  it('skips actions that are not resources', () => {
    expect(byKey['/user/login']).toBeUndefined();
    expect(byKey['/user/createWithList']).toBeUndefined();
    expect(byKey['/pet/{petId}/uploadImage']).toBeUndefined();
  });

  it('models GET /store/inventory as a singleton', () => {
    const inventory = byKey['/store/inventory'];
    expect(inventory.list).toBeUndefined();
    expect(inventory.paths).toEqual({ detail: '/store/inventory' });
  });

  it('keeps create-only resources reachable', () => {
    const order = byKey['/store/order'];
    expect(order.create?.apiEndpoint).toBe('/store/order');
    expect(order.paths.detail).toBe('/store/order/:orderId');

    const user = byKey['/user'];
    expect(user.update).toMatchObject({ method: 'put', apiEndpoint: '/user/{username}' });
  });

  it('builds a linkable menu', () => {
    const menu = buildMenu(resources);
    const keys = menu.flatMap((group) => group.children?.map((item) => item.key) ?? []);
    expect(keys).toContain('/pet/findByStatus');
    expect(keys).toContain('/store/inventory');
    expect(keys).toContain('/store/order/new');
    expect(keys.every((key) => !key.includes(':'))).toBe(true);
  });

  it('generates unique route paths', () => {
    const pages = generateRoutes(parsed).filter((route) => route.component !== 'delete');
    expect(new Set(pages.map((route) => route.path)).size).toBe(pages.length);
  });
});

describe('dereferenceSchema', () => {
  it('merges allOf and cuts recursion at MAX_REF_DEPTH', () => {
    const schemas = {
      Base: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
      Node: {
        allOf: [
          { $ref: '#/components/schemas/Base' },
          { type: 'object', properties: { parent: { $ref: '#/components/schemas/Node' } } },
        ],
      },
    };

    const node = dereferenceSchema({ $ref: '#/components/schemas/Node' }, schemas)!;
    expect(node.required).toEqual(['id']);
    expect(Object.keys(node.properties!)).toEqual(['id', 'parent']);

    let cursor = node;
    for (let hop = 1; hop < MAX_REF_DEPTH; hop++) cursor = cursor.properties!.parent;
    expect(cursor.properties!.parent).toEqual({ type: 'object', title: 'Node' });
  });

  it('stays bounded on densely cross-referenced schemas', () => {
    const schemas: Record<string, { type: string; properties: Record<string, { $ref: string }> }> = {};
    for (let i = 0; i < 40; i++) {
      schemas[`S${i}`] = {
        type: 'object',
        properties: Object.fromEntries(
          Array.from({ length: 40 }, (_, j) => [`f${j}`, { $ref: `#/components/schemas/S${j}` }]),
        ),
      };
    }

    const started = performance.now();
    dereferenceSchema({ $ref: '#/components/schemas/S0' }, schemas);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('URL building', () => {
  it('keeps the server base path', () => {
    expect(buildApiUrl('https://petstore.swagger.io/v2', '/pet/{petId}', { petId: '1' })).toBe(
      'https://petstore.swagger.io/v2/pet/1',
    );
  });

  it('encodes path params', () => {
    expect(buildApiUrl('https://x.io/', '/user/{name}', { name: 'a b/c' })).toBe(
      'https://x.io/user/a%20b%2Fc',
    );
  });

  it('applies list query state', () => {
    const url = buildListApiUrl(
      'https://x.io/api',
      '/items',
      [{ name: '_page', role: 'page' }],
      { page: 2, pageSize: 10, search: '', filters: {} },
    );
    expect(url).toBe('https://x.io/api/items?_page=2');
  });
});

describe('parseOpenAPISync', () => {
  it('rejects non-OpenAPI input with a clear message', () => {
    expect(() => parseOpenAPISync({ hello: 'world' })).toThrow(/Not an OpenAPI document/);
  });

  it('substitutes server variables and merges path-level parameters', () => {
    const parsed = parseOpenAPISync({
      openapi: '3.0.0',
      info: { title: 'Vars', version: '1' },
      servers: [{ url: 'https://{region}.api.io/v1/', variables: { region: { default: 'eu' } } }],
      paths: {
        '/items/{id}': {
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          get: { responses: { '200': { description: 'OK' } } },
        },
      },
    });

    expect(parsed.baseUrl).toBe('https://eu.api.io/v1');
    expect(parsed.endpoints[0].parameters?.map((p) => p.name)).toEqual(['id']);
  });

  it('keeps Swagger 2.0 path-level parameters', () => {
    const parsed = parseOpenAPISync({
      swagger: '2.0',
      info: { title: 'S2', version: '1' },
      host: 'x.io',
      paths: {
        '/items/{id}': {
          parameters: [{ name: 'id', in: 'path', required: true, type: 'string' }],
          get: { responses: { '200': { description: 'OK' } } },
        },
      },
    });

    expect(parsed.endpoints).toHaveLength(1);
    expect(parsed.endpoints[0].parameters?.[0].name).toBe('id');
  });
});

describe('real-world spec shapes', () => {
  const ok = (schema: object) => ({ '200': { description: 'OK', content: { 'application/json': { schema } } } });
  const body = (type: string, schema: object) => ({ content: { [type]: { schema } } });
  const Item = { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } };
  const resourcesOf = (paths: object, components: object = {}) =>
    buildResources(parseOpenAPISync({ openapi: '3.0.0', info: { title: 'T', version: '1' }, paths, components }));

  it('groups Django REST trailing-slash paths', () => {
    const [items] = resourcesOf({
      '/items/': { get: { responses: ok({ type: 'array', items: Item }) } },
      '/items/{id}/': {
        get: { responses: ok(Item) },
        patch: { requestBody: body('application/json', Item), responses: ok(Item) },
        delete: { responses: { '204': { description: 'gone' } } },
      },
    });
    expect(items.paths).toEqual({ list: '/items', detail: '/items/:id', edit: '/items/:id/edit' });
    expect(items.update?.apiEndpoint).toBe('/items/{id}/');
    expect(items.remove).toBeDefined();
  });

  it('groups format-suffixed paths and finds resource-named envelopes (Twilio)', () => {
    const [calls] = resourcesOf({
      '/Accounts/{AccountSid}/Calls.json': {
        get: { responses: ok({ type: 'object', properties: { calls: { type: 'array', items: Item }, page: { type: 'integer' } } }) },
        post: { requestBody: body('application/x-www-form-urlencoded', Item), responses: ok(Item) },
      },
      '/Accounts/{AccountSid}/Calls/{Sid}.json': {
        get: { responses: ok(Item) },
        post: { requestBody: body('application/x-www-form-urlencoded', Item), responses: ok(Item) },
      },
    });
    expect(calls.list?.rowsPath).toEqual(['calls']);
    expect(calls.paths.list).toBe('/Accounts/:AccountSid/Calls');
    expect(calls.create?.contentType).toBe('application/x-www-form-urlencoded');
    expect(calls.update).toMatchObject({ method: 'post', apiEndpoint: '/Accounts/{AccountSid}/Calls/{Sid}.json' });
  });

  it('resolves response, parameter and requestBody refs', () => {
    const [albums] = resourcesOf(
      {
        '/albums': {
          get: {
            parameters: [{ $ref: '#/components/parameters/Q' }],
            responses: { '200': { $ref: '#/components/responses/Page' } },
          },
          post: { requestBody: { $ref: '#/components/requestBodies/New' }, responses: ok(Item) },
        },
      },
      {
        parameters: { Q: { name: 'q', in: 'query', schema: { type: 'string' } } },
        responses: { Page: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: Item } } } } } } },
        requestBodies: { New: body('application/json', Item) },
      },
    );
    expect(albums.list?.parameters?.[0].name).toBe('q');
    expect(albums.list?.rowsPath).toEqual(['items']);
    expect(albums.recordSchema?.properties?.name).toEqual({ type: 'string' });
    expect(albums.create?.schema?.properties?.name).toBeDefined();
  });

  it('picks the object variant of oneOf bodies (NetBox bulk create)', () => {
    const [devices] = resourcesOf({
      '/devices/': {
        get: { responses: ok({ type: 'array', items: Item }) },
        post: { requestBody: body('application/json', { oneOf: [Item, { type: 'array', items: Item }] }), responses: ok(Item) },
      },
    });
    expect(Object.keys(devices.create?.schema?.properties ?? {})).toEqual(['id', 'name']);
  });

  it('finds rows one object level down (Discourse)', () => {
    const [latest] = resourcesOf({
      '/latest': { get: { responses: ok({ type: 'object', properties: { topic_list: { type: 'object', properties: { topics: { type: 'array', items: Item } } } } }) } },
    });
    expect(latest.list?.rowsPath).toEqual(['topic_list', 'topics']);
  });

  it('exposes nested lists in the menu with the params to ask for', () => {
    const resources = resourcesOf({
      '/orgs/{org}/members': { get: { tags: ['org'], responses: ok({ type: 'array', items: Item }) } },
      '/orgs': { get: { tags: ['org'], responses: ok({ type: 'array', items: Item }) } },
    });
    expect(buildMenu(resources)[0].children).toEqual([
      { key: '/orgs', label: 'Orgs' },
      { key: '/orgs/:org/members', label: 'Orgs Members', params: ['org'] },
    ]);
  });

  it('turns Swagger 2.0 formData parameters into a request body', () => {
    const parsed = parseOpenAPISync(petstore);
    const updateWithForm = parsed.endpoints.find((e) => e.operationId === 'updatePetWithForm')!;
    const media = updateWithForm.requestBody?.content['application/x-www-form-urlencoded'];
    expect(Object.keys(media?.schema.properties ?? {})).toEqual(['name', 'status']);
  });
});
