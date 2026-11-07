import React from 'react';
import type { AxiosInstance } from 'axios';
import { useLocation, useNavigate, type NavigateOptions } from 'react-router-dom';
import { useSWRConfig } from 'swr';
import { buildApiUrl, type Resource, type SchemaObject } from '@aikitstudio/agul-core';
import { agulHttp } from './http/client.js';

export interface AgulRuntime {
  baseUrl: string;
  schemas: Record<string, SchemaObject>;
  http: AxiosInstance;
  /** Pathname under which the generated routes are mounted ('' at the router root). */
  routeBase: string;
  /** `fetch` with AGUL's auth headers and proxy applied — for streaming responses axios can't read incrementally. */
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const RuntimeContext = React.createContext<AgulRuntime>({
  baseUrl: '',
  schemas: {},
  http: agulHttp,
  routeBase: '',
  fetch: (url, init) => fetch(url, init),
});

export const AgulRuntimeProvider = RuntimeContext.Provider;

export function useAgulRuntime(): AgulRuntime {
  return React.useContext(RuntimeContext);
}

export function useAgulFetcher() {
  const { http } = useAgulRuntime();
  return React.useCallback((url: string) => http.get(url).then((res) => res.data), [http]);
}

/**
 * `navigate()` for generated paths, prefixed with the mount point when AGUL is nested in a host router.
 * The current query string is kept: AGUL doesn't use it, the host page may (e.g. `?spec=`, `?tenant=`).
 */
export function useAgulNavigate() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { routeBase } = useAgulRuntime();
  return React.useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === 'number') navigate(to);
      else navigate({ pathname: `${routeBase}${to}`, search }, options);
    },
    [navigate, routeBase, search],
  );
}

/** Revalidates every cached page/filter variant of a resource's list (scoped to the given path params). */
export function useRevalidateList(resource: Resource) {
  const { mutate } = useSWRConfig();
  const { baseUrl } = useAgulRuntime();
  return React.useCallback(
    async (pathParams: Record<string, string | undefined> = {}) => {
      if (!resource.list) return;
      const url = buildApiUrl(baseUrl, resource.list.apiEndpoint, pathParams);
      const prefix = url.includes('{') ? url.slice(0, url.indexOf('{')) : url;
      await mutate((key) => typeof key === 'string' && key.startsWith(prefix));
    },
    [mutate, baseUrl, resource.list],
  );
}
