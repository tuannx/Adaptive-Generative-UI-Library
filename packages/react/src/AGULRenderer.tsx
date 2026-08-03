/**
 * AGULRenderer - Public API for Agent/library consumers
 * Renders a full CRUD admin UI from an OpenAPI specification
 */

import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin, Alert, message } from 'antd';
import {
  parseOpenAPI,
  generateRoutes,
  groupRoutesByTag,
  generateMenu,
  type ParsedAPI,
  type RouteConfig,
} from '@agul/core';
import { AppLayout } from './components/AppLayout.js';
import { ListView } from './components/ListView.js';
import { DetailView } from './components/DetailView.js';
import { FormView } from './components/FormView.js';

export interface AGULRendererProps {
  /** OpenAPI/Swagger spec object */
  spec?: Record<string, unknown>;
  /** URL to fetch OpenAPI spec from */
  specUrl?: string;
  /** Override API base URL */
  baseUrl?: string;
  /** Ant Design primary color */
  primaryColor?: string;
  /** Called when spec processing fails */
  onError?: (error: Error) => void;
  /** Called when spec is loaded and routes are ready */
  onReady?: (api: ParsedAPI, routes: RouteConfig[]) => void;
}

export function AGULRenderer({
  spec,
  specUrl,
  baseUrl,
  primaryColor = '#1890ff',
  onError,
  onReady,
}: AGULRendererProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parsedAPI, setParsedAPI] = useState<ParsedAPI | null>(null);
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [menu, setMenu] = useState<ReturnType<typeof generateMenu>>([]);

  const processSpec = useCallback(
    async (specData: Record<string, unknown>) => {
      const parsed = await parseOpenAPI(specData);
      if (baseUrl) {
        parsed.baseUrl = baseUrl;
      }

      const generatedRoutes = generateRoutes(parsed);
      const grouped = groupRoutesByTag(generatedRoutes);
      const generatedMenu = generateMenu(grouped);

      setParsedAPI(parsed);
      setRoutes(generatedRoutes);
      setMenu(generatedMenu);
      onReady?.(parsed, generatedRoutes);
    },
    [baseUrl, onReady],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        let specData = spec;
        if (!specData && specUrl) {
          const response = await fetch(specUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch spec: ${response.status}`);
          }
          specData = await response.json();
        }

        if (!specData) {
          throw new Error('Either spec or specUrl is required');
        }

        if (!cancelled) {
          await processSpec(specData);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (!cancelled) {
          setError(errorMessage);
          onError?.(err instanceof Error ? err : new Error(errorMessage));
          message.error(errorMessage);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [spec, specUrl, processSpec, onError]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Spin size="large" />
        <div data-testid="agul-loading">Loading OpenAPI specification...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert message="Error" description={error} type="error" showIcon style={{ margin: 24 }} />
    );
  }

  if (!parsedAPI || routes.length === 0) {
    return (
      <Alert
        message="No Routes Found"
        description="No API endpoints found in the OpenAPI specification"
        type="warning"
        showIcon
        style={{ margin: 24 }}
      />
    );
  }

  const firstListRoute = routes.find((r) => r.component === 'list');
  const defaultPath = firstListRoute?.path || '/';

  return (
    <ConfigProvider theme={{ token: { colorPrimary: primaryColor } }}>
      <BrowserRouter>
        <AppLayout menu={menu} apiTitle={parsedAPI.basePath} apiVersion="1.0">
          <Routes>
            <Route path="/" element={<Navigate to={defaultPath} replace />} />
            {routes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  route.component === 'list' ? (
                    <ListView route={route} baseUrl={parsedAPI.baseUrl} allRoutes={routes} />
                  ) : route.component === 'detail' ? (
                    <DetailView route={route} baseUrl={parsedAPI.baseUrl} allRoutes={routes} />
                  ) : (
                    <FormView
                      route={route}
                      baseUrl={parsedAPI.baseUrl}
                      allRoutes={routes}
                      schemas={parsedAPI.schemas}
                    />
                  )
                }
              />
            ))}
            <Route
              path="*"
              element={
                <Alert
                  message="404 Not Found"
                  description="The page you are looking for does not exist"
                  type="warning"
                  showIcon
                />
              }
            />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export async function createAGULFromSpec(
  spec: Record<string, unknown>,
  options?: { baseUrl?: string },
): Promise<{ api: ParsedAPI; routes: RouteConfig[]; menu: ReturnType<typeof generateMenu> }> {
  const parsed = await parseOpenAPI(spec);
  if (options?.baseUrl) {
    parsed.baseUrl = options.baseUrl;
  }
  const routes = generateRoutes(parsed);
  const grouped = groupRoutesByTag(routes);
  const menu = generateMenu(grouped);
  return { api: parsed, routes, menu };
}
