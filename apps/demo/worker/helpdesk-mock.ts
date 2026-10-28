/**
 * Mock of the secured sample "Helpdesk API" (public/examples/helpdesk-secured.json) and of the OpenID Connect
 * provider that guards it: discovery, an authorize page to pick a demo user, a token endpoint with PKCE,
 * refresh and password grants, and logout. Tokens are unsigned JWTs — this is a demo, not an identity provider.
 */

export const HELPDESK_PREFIX = '/mock/helpdesk';
const ACCESS_TTL_SECONDS = 600;
export const SERVICE_API_KEY = 'demo-service-key';

interface DemoUser {
  sub: string;
  name: string;
  email: string;
  roles: string[];
  scope: string;
}

export const DEMO_USERS: DemoUser[] = [
  { sub: 'lan', name: 'Lan Pham', email: 'lan@helpdesk.test', roles: ['admin', 'agent'], scope: 'openid profile tickets:read tickets:write users:read' },
  { sub: 'minh', name: 'Minh Tran', email: 'minh@helpdesk.test', roles: ['agent'], scope: 'openid profile tickets:read tickets:write' },
  { sub: 'vy', name: 'Vy Nguyen', email: 'vy@helpdesk.test', roles: ['viewer'], scope: 'openid profile tickets:read' },
];

interface Ticket {
  id: string;
  title: string;
  status: 'open' | 'pending' | 'closed';
  priority: 'low' | 'normal' | 'high';
  requester: string;
  assignee?: string;
  description?: string;
  created_at: string;
}

const tickets = new Map<string, Ticket>(
  [
    { id: 'T-1001', title: 'Cannot reset my password', status: 'open', priority: 'high', requester: 'an@example.com', assignee: 'minh', created_at: '2026-10-20T08:12:00Z' },
    { id: 'T-1002', title: 'Invoice shows the wrong VAT', status: 'pending', priority: 'normal', requester: 'binh@example.com', assignee: 'lan', created_at: '2026-10-21T10:40:00Z' },
    { id: 'T-1003', title: 'Feature request: dark mode', status: 'open', priority: 'low', requester: 'chi@example.com', created_at: '2026-10-22T15:05:00Z' },
    { id: 'T-1004', title: 'App crashes on upload', status: 'closed', priority: 'high', requester: 'dung@example.com', assignee: 'minh', created_at: '2026-10-23T09:30:00Z' },
  ].map((ticket) => [ticket.id, ticket as Ticket]),
);
let counter = 1005;

const encoder = new TextEncoder();

function base64Url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  return new TextDecoder().decode(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)));
}

function readJson<T>(encoded: string | null | undefined): T | undefined {
  if (!encoded) return undefined;
  try {
    return JSON.parse(fromBase64Url(encoded)) as T;
  } catch {
    return undefined;
  }
}

function json(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}

function accessToken(user: DemoUser, issuer: string): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: issuer, sub: user.sub, name: user.name, preferred_username: user.sub, email: user.email, roles: user.roles, scope: user.scope, iat: now, exp: now + ACCESS_TTL_SECONDS };
  return `${base64Url('{"alg":"none","typ":"JWT"}')}.${base64Url(JSON.stringify(claims))}.mock`;
}

function tokenResponse(user: DemoUser, issuer: string): Response {
  const token = accessToken(user, issuer);
  return json(200, {
    access_token: token,
    id_token: token,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: base64Url(JSON.stringify({ u: user.sub })),
    scope: user.scope,
  });
}

async function sha256(text: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function authorizePage(url: URL): Response {
  const redirectUri = url.searchParams.get('redirect_uri') ?? '';
  if (!redirectUri.startsWith(`${url.origin}/`)) return json(400, { error: 'invalid_request', error_description: 'redirect_uri must be on this site' });
  const state = url.searchParams.get('state') ?? '';
  const responseType = url.searchParams.get('response_type') ?? 'code';
  const challenge = url.searchParams.get('code_challenge') ?? '';

  const links = DEMO_USERS.map((user) => {
    const code = base64Url(JSON.stringify({ u: user.sub, c: challenge, r: redirectUri, e: Date.now() + 120_000 }));
    const target = new URL(redirectUri);
    if (responseType === 'token') {
      target.hash = new URLSearchParams({ access_token: accessToken(user, url.origin + HELPDESK_PREFIX), token_type: 'Bearer', expires_in: String(ACCESS_TTL_SECONDS), scope: user.scope, state }).toString();
    } else {
      target.searchParams.set('code', code);
      target.searchParams.set('state', state);
    }
    return `<a class="user" data-testid="mock-login-${user.sub}" href="${escapeHtml(target.toString())}"><b>${escapeHtml(user.name)}</b><span>${escapeHtml(user.roles.join(', '))}</span></a>`;
  }).join('');
  const deny = new URL(redirectUri);
  deny.searchParams.set('error', 'access_denied');
  deny.searchParams.set('error_description', 'You declined to sign in');
  deny.searchParams.set('state', state);

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Helpdesk ID — sign in</title>
<style>body{font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;display:grid;place-items:center;min-height:100vh}
.card{background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px #0001;width:min(380px,90vw)}h1{font-size:20px;margin:0 0 4px}p{color:#666;margin:0 0 20px;font-size:14px}
.user{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border:1px solid #e5e5e5;border-radius:8px;margin-bottom:8px;color:#222;text-decoration:none}
.user:hover{border-color:#1677ff}.user span{color:#888;font-size:13px}.deny{display:block;text-align:center;margin-top:16px;color:#888;font-size:13px}</style></head>
<body><div class="card"><h1>Helpdesk ID</h1><p>Demo identity provider — pick a user to sign in as.</p>${links}<a class="deny" data-testid="mock-login-deny" href="${escapeHtml(deny.toString())}">Cancel</a></div></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function tokenEndpoint(request: Request, issuer: string): Promise<Response> {
  const form = new URLSearchParams(await request.text());
  const grant = form.get('grant_type');
  const userBy = (sub: string | undefined) => DEMO_USERS.find((user) => user.sub === sub);

  if (grant === 'authorization_code') {
    const code = readJson<{ u: string; c: string; r: string; e: number }>(form.get('code'));
    if (!code || code.e < Date.now()) return json(400, { error: 'invalid_grant', error_description: 'Code expired or invalid' });
    if (code.r !== form.get('redirect_uri')) return json(400, { error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
    if (code.c && code.c !== (await sha256(form.get('code_verifier') ?? ''))) {
      return json(400, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
    }
    const user = userBy(code.u);
    return user ? tokenResponse(user, issuer) : json(400, { error: 'invalid_grant' });
  }
  if (grant === 'refresh_token') {
    const user = userBy(readJson<{ u: string }>(form.get('refresh_token'))?.u);
    return user ? tokenResponse(user, issuer) : json(400, { error: 'invalid_grant', error_description: 'Unknown refresh token' });
  }
  if (grant === 'password') {
    const user = userBy(form.get('username') ?? undefined);
    if (!user || form.get('password') !== 'demo') return json(400, { error: 'invalid_grant', error_description: 'Wrong username or password (password: demo)' });
    return tokenResponse(user, issuer);
  }
  return json(400, { error: 'unsupported_grant_type' });
}

interface Principal {
  sub: string;
  roles: string[];
  scopes: string[];
}

function authenticate(request: Request): Principal | Response {
  if (request.headers.get('x-api-key') === SERVICE_API_KEY) {
    return { sub: 'service', roles: ['admin', 'agent'], scopes: ['tickets:read', 'tickets:write', 'users:read'] };
  }
  const header = request.headers.get('authorization') ?? '';
  const claims = readJson<{ sub: string; roles: string[]; scope: string; exp: number }>(header.replace(/^Bearer\s+/i, '').split('.')[1]);
  if (!header || !claims) {
    return json(401, { error: 'unauthorized', message: 'Sign in to use the Helpdesk API' }, { 'www-authenticate': 'Bearer' });
  }
  if (claims.exp * 1000 < Date.now()) {
    return json(401, { error: 'invalid_token', message: 'Access token expired' }, { 'www-authenticate': 'Bearer error="invalid_token"' });
  }
  return { sub: claims.sub, roles: claims.roles ?? [], scopes: (claims.scope ?? '').split(' ') };
}

function forbidden(message: string): Response {
  return json(403, { error: 'forbidden', message });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function validateTicket(body: Record<string, unknown>, partial: boolean): string | undefined {
  if (!partial && (typeof body.title !== 'string' || body.title.trim().length < 3)) return 'title must be at least 3 characters';
  if (body.status !== undefined && !['open', 'pending', 'closed'].includes(String(body.status))) return 'status is invalid';
  if (body.priority !== undefined && !['low', 'normal', 'high'].includes(String(body.priority))) return 'priority is invalid';
  if (String(body.requester ?? '').endsWith('@blocked.test')) return 'requester is on the block list';
  return undefined;
}

async function api(request: Request, path: string, url: URL): Promise<Response> {
  if (path === '/health') return json(200, { status: 'ok', tickets: tickets.size });

  const principal = authenticate(request);
  if (principal instanceof Response) return principal;
  const can = (scope: string) => principal.scopes.includes(scope);
  const method = request.method;

  if (path === '/me' && method === 'GET') {
    const user = DEMO_USERS.find((candidate) => candidate.sub === principal.sub);
    return json(200, { sub: principal.sub, name: user?.name ?? 'Service account', email: user?.email ?? '', roles: principal.roles.join(', '), scopes: principal.scopes.join(' ') });
  }

  if (path === '/tickets') {
    if (method === 'GET') {
      if (!can('tickets:read')) return forbidden('tickets:read scope required');
      const status = url.searchParams.get('status');
      const q = url.searchParams.get('q')?.toLowerCase();
      const rows = [...tickets.values()].filter(
        (ticket) => (!status || ticket.status === status) && (!q || `${ticket.title} ${ticket.requester}`.toLowerCase().includes(q)),
      );
      return json(200, rows);
    }
    if (method === 'POST') {
      if (!can('tickets:write')) return forbidden('tickets:write scope required');
      const body = await readBody(request);
      const problem = validateTicket(body, false);
      if (problem) return json(422, { message: problem, errors: [{ field: problem.split(' ')[0], message: problem }] });
      const ticket: Ticket = {
        id: `T-${counter++}`,
        title: String(body.title).trim(),
        status: (body.status as Ticket['status']) ?? 'open',
        priority: (body.priority as Ticket['priority']) ?? 'normal',
        requester: String(body.requester ?? principal.sub),
        assignee: body.assignee ? String(body.assignee) : undefined,
        description: body.description ? String(body.description) : undefined,
        created_at: new Date().toISOString(),
      };
      tickets.set(ticket.id, ticket);
      return json(201, ticket);
    }
  }

  const ticketMatch = path.match(/^\/tickets\/([^/]+)$/);
  if (ticketMatch) {
    const ticket = tickets.get(decodeURIComponent(ticketMatch[1]));
    if (!ticket) return json(404, { message: 'Ticket not found' });
    if (method === 'GET') return can('tickets:read') ? json(200, ticket) : forbidden('tickets:read scope required');
    if (method === 'PATCH') {
      if (!can('tickets:write')) return forbidden('tickets:write scope required');
      const body = await readBody(request);
      const problem = validateTicket(body, true);
      if (problem) return json(422, { message: problem, errors: [{ field: problem.split(' ')[0], message: problem }] });
      const { id: _id, created_at: _created, ...changes } = body;
      const next = { ...ticket, ...changes } as Ticket;
      tickets.set(ticket.id, next);
      return json(200, next);
    }
    if (method === 'DELETE') {
      if (!principal.roles.includes('admin')) return forbidden('Only admins can delete tickets');
      tickets.delete(ticket.id);
      return new Response(null, { status: 204 });
    }
  }

  if (path === '/users' && method === 'GET') {
    if (!can('users:read')) return forbidden('users:read scope required');
    return json(200, DEMO_USERS.map(({ sub, name, email, roles }) => ({ id: sub, name, email, roles: roles.join(', ') })));
  }

  if (path === '/admin/reindex' && method === 'POST') {
    if (!principal.roles.includes('admin')) return forbidden('Only admins can reindex');
    return json(200, { reindexed: tickets.size, took_ms: 42 });
  }

  return json(404, { message: 'Not found' });
}

export async function handleHelpdeskMock(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(HELPDESK_PREFIX.length) || '/';
  const issuer = `${url.origin}${HELPDESK_PREFIX}`;

  if (path === '/.well-known/openid-configuration') {
    return json(200, {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      end_session_endpoint: `${issuer}/logout`,
      response_types_supported: ['code', 'token'],
      grant_types_supported: ['authorization_code', 'refresh_token', 'password'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['openid', 'profile', 'tickets:read', 'tickets:write', 'users:read'],
    });
  }
  if (path === '/authorize') return authorizePage(url);
  if (path === '/token' && request.method === 'POST') return tokenEndpoint(request, issuer);
  if (path === '/logout') {
    const target = url.searchParams.get('post_logout_redirect_uri') ?? '/';
    return Response.redirect(target.startsWith(`${url.origin}/`) ? target : `${url.origin}/`, 302);
  }
  if (path.startsWith('/api/')) return api(request, path.slice(4), url);
  return json(404, { message: 'Not found' });
}
