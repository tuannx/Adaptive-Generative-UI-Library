/// <reference types="node" />
import { describe, it, expect, vi } from 'vite-plus/test';
import type { SecurityScheme } from '@ai-kit/agul-core';
import { AgulSessionStore, describeUser, grantsFromCredentials, isApiUrl, signRequest } from './session.js';
import { refreshCredential, requestToken } from './oauth.js';
import { createAgulHttp } from '../http/client.js';

const schemes: Record<string, SecurityScheme> = {
  key: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
  queryKey: { type: 'apiKey', in: 'query', name: 'api_key' },
  basic: { type: 'http', scheme: 'basic' },
  oidc: { type: 'openIdConnect', openIdConnectUrl: 'https://id.test/.well-known/openid-configuration' },
};

const jwt = (claims: object) => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;

describe('signRequest', () => {
  it('puts each credential where its scheme says', () => {
    const signed = signRequest('https://api.test/items?page=2', schemes, {
      key: { kind: 'apiKey', value: 'k1' },
      queryKey: { kind: 'apiKey', value: 'a b' },
    });
    expect(signed.headers).toEqual({ 'X-API-Key': 'k1' });
    expect(signed.url).toBe('https://api.test/items?page=2&api_key=a%20b');
  });

  it('encodes Basic credentials as UTF-8', () => {
    const { headers } = signRequest('/x', schemes, { basic: { kind: 'basic', username: 'ngọc', password: 'p' } });
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('ngọc:p').toString('base64')}`);
  });

  it('sends tokens as Bearer and ignores credentials of unknown schemes', () => {
    const { headers } = signRequest('/x', schemes, {
      oidc: { kind: 'token', accessToken: 't1' },
      gone: { kind: 'apiKey', value: 'x' },
    });
    expect(headers).toEqual({ Authorization: 'Bearer t1' });
  });
});

describe('isApiUrl', () => {
  it('only matches the API origin', () => {
    expect(isApiUrl('https://api.test/v1/items', 'https://api.test/v1')).toBe(true);
    expect(isApiUrl('https://evil.test/v1/items', 'https://api.test/v1')).toBe(false);
    expect(isApiUrl('/items', '')).toBe(true);
  });
});

describe('user and grants from tokens', () => {
  it('names the user and reads roles from the access token', () => {
    const credentials = {
      oidc: { kind: 'token' as const, accessToken: jwt({ preferred_username: 'linh', roles: ['admin'] }), scope: 'openid tickets:read' },
    };
    expect(describeUser(credentials)?.name).toBe('linh');
    const grants = grantsFromCredentials(credentials)!;
    expect(grants.authorities.has('admin')).toBe(true);
    expect([...grants.scopes!]).toEqual(['openid', 'tickets:read']);
  });

  it('knows nothing about opaque tokens or API keys', () => {
    expect(grantsFromCredentials({ oidc: { kind: 'token', accessToken: 'opaque' } })).toBeUndefined();
    expect(grantsFromCredentials({ key: { kind: 'apiKey', value: 'k' } })).toBeUndefined();
  });
});

describe('AgulSessionStore', () => {
  it('notifies subscribers and clears one scheme or all', () => {
    const store = new AgulSessionStore('test', 'memory');
    const listener = vi.fn();
    store.subscribe(listener);
    store.set('key', { kind: 'apiKey', value: '1' });
    store.set('basic', { kind: 'basic', username: 'u', password: 'p' });
    store.clear('key');
    expect(Object.keys(store.get())).toEqual(['basic']);
    store.clear();
    expect(store.get()).toEqual({});
    expect(listener).toHaveBeenCalledTimes(4);
  });
});

describe('token endpoint', () => {
  it('posts a form and maps the response, keeping the refresh token on refresh', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = new URLSearchParams(String(init.body));
      if (body.get('grant_type') === 'password') {
        expect(body.get('username')).toBe('u');
        return Response.json({ access_token: 'a1', refresh_token: 'r1', expires_in: 60, scope: 's' });
      }
      expect(body.get('refresh_token')).toBe('r1');
      return Response.json({ access_token: 'a2', expires_in: 60 });
    });
    const first = await requestToken('https://id.test/token', { grant_type: 'password', username: 'u', password: 'p', client_id: 'ui' }, fetchMock as never);
    expect(first).toMatchObject({ kind: 'token', accessToken: 'a1', refreshToken: 'r1', scope: 's', clientId: 'ui' });
    const next = await refreshCredential(first, fetchMock as never)!;
    expect(next).toMatchObject({ accessToken: 'a2', refreshToken: 'r1' });
  });

  it('surfaces the provider error', async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: 'invalid_grant', error_description: 'Wrong password' }, { status: 400 }));
    await expect(requestToken('https://id.test/token', { grant_type: 'password' }, fetchMock as never)).rejects.toThrow('Wrong password');
  });
});

describe('createAgulHttp with session auth', () => {
  it('signs requests and retries once after a refreshed 401', async () => {
    let token = 'old';
    const seen: string[] = [];
    const onUnauthorized = vi.fn(async () => {
      token = 'new';
      return true;
    });
    const http = createAgulHttp(() => ({
      sign: async (url) => ({ url, headers: { Authorization: `Bearer ${token}` } }),
      onUnauthorized,
    }));
    http.defaults.adapter = async (config) => {
      const auth = String(config.headers.Authorization);
      seen.push(auth);
      if (auth === 'Bearer old') {
        const error = Object.assign(new Error('401'), { config, response: { status: 401, data: {}, headers: {}, config } });
        throw error;
      }
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };
    const response = await http.get('https://api.test/items');
    expect(response.data).toEqual({ ok: true });
    expect(seen).toEqual(['Bearer old', 'Bearer new']);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
