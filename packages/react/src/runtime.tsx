import React from 'react';
import type { AxiosInstance } from 'axios';
import { useNavigate, type NavigateOptions } from 'react-router-dom';
import { useSWRConfig } from 'swr';
import { buildApiUrl, type Resource, type SchemaObject } from '@agul/core';
import { agulHttp } from './http/client.js';

export interface AgulRuntime {
  baseUrl: string;
  schemas: Record<string, SchemaObject>;
  http: AxiosInstance;
  /** Pathname under which the generated routes are mounted ('' at the router root). */
  routeBase: string;
}

const RuntimeContext = React.createContext<AgulRuntime>({
  baseUrl: '',
  schemas: {},
  http: agulHttp,
  routeBase: '',
});

export const AgulRuntimeProvider = RuntimeContext.Provider;

export function useAgulRuntime(): AgulRuntime {
  return React.useContext(RuntimeContext);
}

export function useAgulFetcher() {
  const { http } = useAgulRuntime();
  return React.useCallback((url: string) => http.get(url).then((res) => res.data), [http]);
}

/** `navigate()` for generated paths, prefixed with the mount point when AGUL is nested in a host router. */
export function useAgulNavigate() {
  const navigate = useNavigate();
  const { routeBase } = useAgulRuntime();
  return React.useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === 'number') navigate(to);
      else navigate(`${routeBase}${to}`, options);
    },
    [navigate, routeBase],
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
