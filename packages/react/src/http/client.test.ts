import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AxiosHeaders } from 'axios';
import {
  configureAgulAuth,
  resolveAuthHeaders,
  applyAuthHeaders,
  agulHttp,
} from './client.js';

describe('resolveAuthHeaders', () => {
  beforeEach(() => {
    configureAgulAuth({});
  });

  it('returns Bearer header when token is set', async () => {
    configureAgulAuth({ token: 'test-jwt' });

    expect(await resolveAuthHeaders()).toEqual({
      Authorization: 'Bearer test-jwt',
    });
  });

  it('prefers getAuthHeaders over token', async () => {
    configureAgulAuth({
      token: 'ignored',
      getAuthHeaders: () => ({ 'X-Api-Key': 'secret' }),
    });

    expect(await resolveAuthHeaders()).toEqual({ 'X-Api-Key': 'secret' });
  });

  it('supports async getAuthHeaders', async () => {
    configureAgulAuth({
      getAuthHeaders: async () => ({ Authorization: 'Bearer async-token' }),
    });

    expect(await resolveAuthHeaders()).toEqual({
      Authorization: 'Bearer async-token',
    });
  });
});

describe('agulHttp interceptor', () => {
  beforeEach(() => {
    configureAgulAuth({});
  });

  it('attaches Authorization header via applyAuthHeaders', async () => {
    configureAgulAuth({ token: 'intercepted' });

    const config = await applyAuthHeaders({
      headers: new AxiosHeaders(),
      url: '/pets',
      method: 'get',
    });

    expect(config.headers.get('Authorization')).toBe('Bearer intercepted');
  });

  it('sends auth header via agulHttp', async () => {
    configureAgulAuth({ token: 'live-token' });

    const adapter = vi.fn(async (config) => ({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));

    agulHttp.defaults.adapter = adapter;
    await agulHttp.get('https://api.example.com/pets');

    expect(adapter).toHaveBeenCalled();
    const requestConfig = adapter.mock.calls[0][0];
    expect(requestConfig.headers.get('Authorization')).toBe('Bearer live-token');
  });
});
