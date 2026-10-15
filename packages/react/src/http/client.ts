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

/** Creates an axios instance whose auth headers are read from `getAuth()` on every request. */
export function createAgulHttp(getAuth: () => AgulAuthConfig): AxiosInstance {
  const instance = axios.create();
  instance.interceptors.request.use((config) => applyAuthHeaders(config, getAuth()));
  return instance;
}

export const agulHttp: AxiosInstance = createAgulHttp(() => authConfig);

export const agulFetcher = (url: string) => agulHttp.get(url).then((res) => res.data);
