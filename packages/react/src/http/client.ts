import axios, { AxiosHeaders, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export type GetAuthHeaders = () =>
  Record<string, string> | Promise<Record<string, string>>;

export interface AgulAuthConfig {
  token?: string;
  getAuthHeaders?: GetAuthHeaders;
}

let authConfig: AgulAuthConfig = {};

export function configureAgulAuth(config: AgulAuthConfig): void {
  authConfig = config;
}

export async function resolveAuthHeaders(): Promise<Record<string, string>> {
  if (authConfig.getAuthHeaders) {
    return authConfig.getAuthHeaders();
  }

  if (authConfig.token) {
    return { Authorization: `Bearer ${authConfig.token}` };
  }

  return {};
}

export async function applyAuthHeaders(
  config: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig> {
  const authHeaders = await resolveAuthHeaders();
  const headers = AxiosHeaders.from(config.headers);

  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }

  config.headers = headers;
  return config;
}

export const agulHttp: AxiosInstance = axios.create();

agulHttp.interceptors.request.use(applyAuthHeaders);

export const agulFetcher = (url: string) => agulHttp.get(url).then((res) => res.data);
