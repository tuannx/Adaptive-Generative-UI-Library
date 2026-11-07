import { describe, it, expect } from 'vite-plus/test';
import { parseOpenAPISync } from './parser.js';
import { planUi } from './decisions.js';
import { canAccessEndpoint, decodeJwt, grantsFromClaims, isPublicOperation, requiredRoles } from './security.js';

const itemSchema = { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' } } };
const json = (schema: object) => ({ content: { 'application/json': { schema } } });

const spec = {
  openapi: '3.0.3',
  info: { title: 'Helpdesk', version: '1' },
  security: [{ oidc: ['tickets:read'] }],
  components: {
    securitySchemes: {
      oidc: { type: 'openIdConnect', openIdConnectUrl: 'https://id.example.test/.well-known/openid-configuration' },
      key: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    },
  },
  paths: {
    '/health': { get: { operationId: 'health', security: [], responses: { '200': { description: 'OK' } } } },
    '/tickets': {
      get: { operationId: 'listTickets', responses: { '200': { description: 'OK', ...json({ type: 'array', items: itemSchema }) } } },
      post: {
        operationId: 'createTicket',
        security: [{ oidc: ['tickets:write'] }],
        requestBody: json(itemSchema),
        responses: { '201': { description: 'Created', ...json(itemSchema) } },
      },
    },
    '/tickets/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { operationId: 'getTicket', responses: { '200': { description: 'OK', ...json(itemSchema) } } },
      delete: { operationId: 'deleteTicket', 'x-agul-roles': ['admin'], responses: { '204': { description: 'Gone' } } },
    },
    '/admin/reindex': {
      post: { operationId: 'reindex', 'x-agul-roles': 'admin', security: [{ key: [] }], responses: { '202': { description: 'Queued' } } },
    },
  },
};

const jwt = (claims: object) =>
  `e30.${btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.sig`;

describe('security schemes', () => {
  const api = parseOpenAPISync(structuredClone(spec));

  it('parses schemes and applies document security to operations without their own', () => {
    expect(Object.keys(api.securitySchemes)).toEqual(['oidc', 'key']);
    const byId = Object.fromEntries(api.endpoints.map((endpoint) => [endpoint.operationId, endpoint]));
    expect(byId.listTickets.security).toEqual([{ oidc: ['tickets:read'] }]);
    expect(isPublicOperation(byId.health)).toBe(true);
    expect(isPublicOperation(byId.listTickets)).toBe(false);
    expect(requiredRoles(byId.reindex)).toEqual(['admin']);
  });

  it('converts Swagger 2.0 securityDefinitions', () => {
    const swagger = parseOpenAPISync({
      swagger: '2.0',
      info: { title: 'S', version: '1' },
      securityDefinitions: {
        basic: { type: 'basic' },
        petstore_auth: { type: 'oauth2', flow: 'accessCode', authorizationUrl: 'https://a/authorize', tokenUrl: 'https://a/token', scopes: { 'write:pets': 'w' } },
      },
      security: [{ basic: [] }],
      paths: { '/x': { get: { operationId: 'x', responses: { '200': { description: 'OK' } } } } },
    });
    expect(swagger.securitySchemes.basic).toMatchObject({ type: 'http', scheme: 'basic' });
    expect(swagger.securitySchemes.petstore_auth).toMatchObject({
      type: 'oauth2',
      flows: { authorizationCode: { tokenUrl: 'https://a/token', scopes: { 'write:pets': 'w' } } },
    });
    expect(swagger.endpoints[0].security).toEqual([{ basic: [] }]);
  });
});

describe('claims → grants', () => {
  it('reads scopes, roles and Keycloak role claims from a JWT', () => {
    const claims = decodeJwt(
      jwt({ sub: 'u1', scope: 'openid tickets:read', realm_access: { roles: ['agent'] }, resource_access: { app: { roles: ['triage'] } } }),
    );
    const grants = grantsFromClaims(claims)!;
    expect([...grants.authorities].sort()).toEqual(['agent', 'openid', 'tickets:read', 'triage']);
    expect([...grants.scopes!]).toEqual(['openid', 'tickets:read']);
  });

  it('leaves scopes unknown when the token has no scope claim', () => {
    expect(grantsFromClaims({ roles: ['admin'] })!.scopes).toBeUndefined();
    expect(decodeJwt('not-a-jwt')).toBeUndefined();
  });
});

describe('access control in the UI plan', () => {
  const api = parseOpenAPISync(structuredClone(spec));
  const byId = Object.fromEntries(api.endpoints.map((endpoint) => [endpoint.operationId, endpoint]));

  it('allows everything when nothing is known about the user', () => {
    expect(canAccessEndpoint(byId.deleteTicket, api.securitySchemes, undefined)).toBe(true);
    const tickets = planUi(api).resources.find((resource) => resource.key === '/tickets')!;
    expect(tickets.paths.create).toBe('/tickets/new');
    expect(tickets.remove).toBeDefined();
  });

  it('hides operations whose scopes or roles are missing', () => {
    const reader = grantsFromClaims({ scope: 'tickets:read', roles: ['agent'] });
    const plan = planUi(api, undefined, { grants: reader });
    const tickets = plan.resources.find((resource) => resource.key === '/tickets')!;
    expect(tickets.paths.list).toBe('/tickets');
    expect(tickets.paths.detail).toBe('/tickets/:id');
    expect(tickets.paths.create).toBeUndefined();
    expect(tickets.remove).toBeUndefined();
    expect(plan.pages.map((page) => page.operationId)).not.toContain('reindex');
  });

  it('shows admin operations to admins', () => {
    const admin = grantsFromClaims({ scope: 'tickets:read tickets:write', roles: ['admin'] });
    const plan = planUi(api, undefined, { grants: admin });
    const tickets = plan.resources.find((resource) => resource.key === '/tickets')!;
    expect(tickets.paths.create).toBe('/tickets/new');
    expect(tickets.remove).toBeDefined();
    expect(plan.pages.map((page) => page.operationId)).toContain('reindex');
  });

  it('drops a resource the user cannot reach at all', () => {
    const none = grantsFromClaims({ scope: 'profile' });
    const plan = planUi(api, undefined, { grants: none });
    expect(plan.resources.find((resource) => resource.key === '/tickets')).toBeUndefined();
    expect(plan.menu.flatMap((group) => group.children ?? []).map((item) => item.key)).not.toContain('/tickets');
  });
});

describe('alternative security requirements', () => {
  const api = parseOpenAPISync({
    ...structuredClone(spec),
    security: [{ oidc: ['tickets:read'] }, { key: [] }],
  });
  const list = api.endpoints.find((endpoint) => endpoint.operationId === 'listTickets')!;

  it('ignores alternatives that use a scheme the user has no credential for', () => {
    const viaOidc = { ...grantsFromClaims({ scope: 'profile' })!, schemes: new Set(['oidc']) };
    expect(canAccessEndpoint(list, api.securitySchemes, viaOidc)).toBe(false);
    const viaKey = { ...grantsFromClaims({ scope: '' })!, schemes: new Set(['key']) };
    expect(canAccessEndpoint(list, api.securitySchemes, viaKey)).toBe(true);
  });
});
