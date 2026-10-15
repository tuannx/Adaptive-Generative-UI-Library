import axios, { AxiosHeaders, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export type GetAuthHeaders = () =>
  Record<string, string> | Promise<Record<string, string>>;

export interface AgulAuthConfig {
  token?: string;
  getAuthHeaders?: GetAuthHeaders;
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

/**
 * Creates an axios instance whose auth headers (and optional proxy) are read on every request.
 */
export function createAgulHttp(
  getAuth: () => AgulAuthConfig,
  getProxyUrl: () => string | undefined = () => undefined,
): AxiosInstance {
  const instance = axios.create();
  instance.interceptors.request.use((config) => {
    if (config.url) config.url = withProxy(config.url, getProxyUrl());
    return applyAuthHeaders(config, getAuth());
  });
  return instance;
}

export const agulHttp: AxiosInstance = createAgulHttp(() => authConfig);

export const agulFetcher = (url: string) => agulHttp.get(url).then((res) => res.data);
