import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from './index.js';
import { isHostAllowed, type Env } from './proxy.js';

const assets = { fetch: vi.fn(async () => new Response('<html>spa</html>')) };
const env = { ASSETS: assets, PROXY_ALLOWED_HOSTS: 'api.example.com,*.example.org' } as unknown as Env;

afterEach(() => vi.unstubAllGlobals());

describe('isHostAllowed', () => {
  it('matches exact hosts and wildcard subdomains', () => {
    expect(isHostAllowed('api.example.com', env.PROXY_ALLOWED_HOSTS)).toBe(true);
    expect(isHostAllowed('a.b.example.org', env.PROXY_ALLOWED_HOSTS)).toBe(true);
    expect(isHostAllowed('evil.com', env.PROXY_ALLOWED_HOSTS)).toBe(false);
    expect(isHostAllowed('example.com.evil.com', env.PROXY_ALLOWED_HOSTS)).toBe(false);
  });

  it('never allows private hosts, even with "*"', () => {
    expect(isHostAllowed('localhost', '*')).toBe(false);
    expect(isHostAllowed('169.254.169.254', '*')).toBe(false);
    expect(isHostAllowed('10.0.0.1', '*')).toBe(false);
  });
});

describe('worker fetch', () => {
  it('serves non-proxy paths from assets', async () => {
    const res = await worker.fetch(new Request('https://demo.dev/pet/findByStatus'), env);
    expect(await res.text()).toContain('spa');
  });

  it('forwards allowed hosts with method, body and auth, dropping cookies', async () => {
    const upstream = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response('{"ok":true}', { status: 201, headers: { 'set-cookie': 'a=b', 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', upstream);

    const res = await worker.fetch(
      new Request('https://demo.dev/proxy/https://api.example.com/v1/items?x=1', {
        method: 'POST',
        body: 'name=rex',
        headers: { authorization: 'Bearer t', cookie: 'session=1', 'content-type': 'application/x-www-form-urlencoded' },
      }),
      env,
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('set-cookie')).toBeNull();
    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/items?x=1');
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer t');
    expect(headers.get('cookie')).toBeNull();
  });

  it('rejects hosts outside the allowlist and malformed targets', async () => {
    const blocked = await worker.fetch(new Request('https://demo.dev/proxy/https://evil.com/x'), env);
    expect(blocked.status).toBe(403);
    const malformed = await worker.fetch(new Request('https://demo.dev/proxy/not-a-url'), env);
    expect(malformed.status).toBe(400);
  });
});
