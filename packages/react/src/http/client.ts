import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

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
  for (const [key, value] of Object.entries(authHeaders)) {
    config.headers.set(key, value);
  }
  return config;
}

export const agulHttp: AxiosInstance = axios.create();

agulHttp.interceptors.request.use(applyAuthHeaders);

export const agulFetcher = (url: string) => agulHttp.get(url).then((res) => res.data);
