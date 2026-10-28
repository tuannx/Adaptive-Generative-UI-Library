import axios, { AxiosHeaders, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export type GetAuthHeaders = () =>
  Record<string, string> | Promise<Record<string, string>>;

export interface AgulAuthConfig {
  token?: string;
  getAuthHeaders?: GetAuthHeaders;
  /** Adds the signed-in user's credentials to a request; returns the URL to call (query API keys change it). */
  sign?: (url: string) => Promise<{ url: string; headers: Record<string, string> }>;
  /** Called when the API answers 401; resolves true when credentials were refreshed and the request should be retried. */
  onUnauthorized?: (url: string) => Promise<boolean>;
}

let authConfig: AgulAuthConfig = {};

/** Configures auth for the shared `agulHttp` client. `<AGULRenderer>` uses its own `token`/`getAuthHeaders` props. */
export function configureAgulAuth(config: AgulAuthConfig): void {
  authConfig = config;
}

export async function resolveAuthHeaders(
  config: AgulAuthConfig = authConfig,
): Promise<Record<string, string>> {
  if (config.getAuthHeaders) {
    return config.getAuthHeaders();
  }

  if (config.token) {
    return { Authorization: `Bearer ${config.token}` };
  }

  return {};
}

export async function applyAuthHeaders(
  config: InternalAxiosRequestConfig,
  auth: AgulAuthConfig = authConfig,
): Promise<InternalAxiosRequestConfig> {
  const authHeaders = await resolveAuthHeaders(auth);
  const headers = AxiosHeaders.from(config.headers);

  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }

  config.headers = headers;
  return config;
}

/**
 * Route an absolute URL through a proxy that takes the target URL as its path suffix
 * (`/proxy/` + `https://api.example.com/items` → `/proxy/https://api.example.com/items`).
 * Relative and same-origin URLs are left alone.
 */
export function withProxy(url: string, proxyUrl: string | undefined): string {
  if (!proxyUrl || !/^https?:\/\//i.test(url)) return url;
  if (typeof window !== 'undefined' && url.startsWith(`${window.location.origin}/`)) return url;
  return `${proxyUrl}${url}`;
}

type RetriableConfig = InternalAxiosRequestConfig & { agulUrl?: string; agulRetried?: boolean };

/**
 * Creates an axios instance whose auth headers (and optional proxy) are read on every request.
 * A 401 gives `onUnauthorized` one chance to refresh credentials before the request is retried.
 */
export function createAgulHttp(
  getAuth: () => AgulAuthConfig,
  getProxyUrl: () => string | undefined = () => undefined,
): AxiosInstance {
  const instance = axios.create();
  instance.interceptors.request.use(async (config: RetriableConfig) => {
    const auth = getAuth();
    if (config.url) {
      config.agulUrl ??= config.url;
      let url = config.agulUrl;
      if (auth.sign) {
        const signed = await auth.sign(url);
        url = signed.url;
        const headers = AxiosHeaders.from(config.headers);
        for (const [key, value] of Object.entries(signed.headers)) headers.set(key, value);
        config.headers = headers;
      }
      config.url = withProxy(url, getProxyUrl());
    }
    return applyAuthHeaders(config, auth);
  });
  instance.interceptors.response.use(undefined, async (error) => {
    const config = error?.config as RetriableConfig | undefined;
    const onUnauthorized = getAuth().onUnauthorized;
    if (error?.response?.status === 401 && config && !config.agulRetried && onUnauthorized) {
      config.agulRetried = true;
      if (await onUnauthorized(config.agulUrl ?? config.url ?? '')) return instance.request(config);
    }
    throw error;
  });
  return instance;
}

/** `fetch` with the same auth, proxy and 401 handling as {@link createAgulHttp} (for streamed responses). */
export function createAgulFetch(
  getAuth: () => AgulAuthConfig,
  getProxyUrl: () => string | undefined = () => undefined,
): (url: string, init?: RequestInit) => Promise<Response> {
  const send = async (url: string, init: RequestInit) => {
    const auth = getAuth();
    const headers = new Headers(init.headers);
    let target = url;
    if (auth.sign) {
      const signed = await auth.sign(url);
      target = signed.url;
      for (const [key, value] of Object.entries(signed.headers)) headers.set(key, value);
    }
    for (const [key, value] of Object.entries(await resolveAuthHeaders(auth))) headers.set(key, value);
    return fetch(withProxy(target, getProxyUrl()), { ...init, headers });
  };
  return async (url, init = {}) => {
    const response = await send(url, init);
    const onUnauthorized = getAuth().onUnauthorized;
    const replayable = init.body == null || typeof init.body === 'string' || init.body instanceof URLSearchParams || init.body instanceof FormData;
    if (response.status === 401 && onUnauthorized && replayable && (await onUnauthorized(url))) return send(url, init);
    return response;
  };
}

export const agulHttp: AxiosInstance = createAgulHttp(() => authConfig);

export const agulFetcher = (url: string) => agulHttp.get(url).then((res) => res.data);
