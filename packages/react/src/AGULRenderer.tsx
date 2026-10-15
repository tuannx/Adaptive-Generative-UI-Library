import React from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useInRouterContext,
  useLocation,
  useParams,
} from 'react-router-dom';
import { Alert, ConfigProvider, Spin, message } from 'antd';
import {
  buildMenu,
  buildResources,
  generateRoutes,
  parseOpenAPI,
  parseOpenAPISync,
  parseJsonSchema,
  wrapJsonSchemaAsOpenAPI,
  type JsonSchemaInputOptions,
  type MenuItem,
  type ParsedAPI,
  type Resource,
  type RouteConfig,
  type SchemaObject,
} from '@agul/core';
import { AppLayout } from './components/AppLayout.js';
import { ListView } from './components/ListView.js';
import { DetailView } from './components/DetailView.js';
import { FormView } from './components/FormView.js';
import { createAgulHttp, type GetAuthHeaders } from './http/client.js';
import { PluginProvider } from './plugins/PluginContext.js';
import type { AgulFieldPlugin } from './plugins/types.js';
import { AgulRuntimeProvider, type AgulRuntime } from './runtime.js';

export interface AGULRendererProps {
  /** OpenAPI/Swagger spec object */
  spec?: Record<string, unknown>;
  /** URL to fetch OpenAPI spec from */
  specUrl?: string;
  /** Plain JSON Schema for schema-only UI generation */
  jsonSchema?: SchemaObject;
  /** REST resource path when using jsonSchema (e.g. /pets) */
  resourcePath?: string;
  /** Override API base URL (required when using jsonSchema) */
  baseUrl?: string;
  /** Bearer JWT token for API requests */
  token?: string;
  /** Custom auth headers (takes precedence over token) */
  getAuthHeaders?: GetAuthHeaders;
  /** Custom field renderer plugins */
  plugins?: AgulFieldPlugin[];
  /** Ant Design primary color */
  primaryColor?: string;
  /** Router basename when AGUL creates its own BrowserRouter (ignored inside a host router) */
  basename?: string;
  /** Called when spec processing fails */
  onError?: (error: Error) => void;
  /** Called when spec is loaded and routes are ready */
  onReady?: (api: ParsedAPI, routes: RouteConfig[]) => void;
}

interface AgulModel {
  api: ParsedAPI;
  resources: Resource[];
  menu: MenuItem[];
}

type ModelState = { status: 'loading' } | { status: 'error'; error: Error } | ({ status: 'ready' } & AgulModel);

export function AGULRenderer({ basename, primaryColor = '#1890ff', ...props }: AGULRendererProps) {
  const inRouter = useInRouterContext();
  const app = (
    <ConfigProvider theme={{ token: { colorPrimary: primaryColor } }}>
      <AGULApp {...props} embedded={inRouter} />
    </ConfigProvider>
  );

  return inRouter ? app : <BrowserRouter basename={basename}>{app}</BrowserRouter>;
}

function AGULApp({
  spec,
  specUrl,
  jsonSchema,
  resourcePath,
  baseUrl,
  token,
  getAuthHeaders,
  plugins = [],
  onError,
  onReady,
  embedded,
}: Omit<AGULRendererProps, 'basename' | 'primaryColor'> & { embedded: boolean }) {
  const routeBase = useMountPath(embedded);

  const auth = useLatest({ token, getAuthHeaders });
  const http = React.useMemo(() => createAgulHttp(() => auth.current), [auth]);
  const onReadyRef = useLatest(onReady);
  const onErrorRef = useLatest(onError);

  const stableSpec = useStableValue(spec);
  const stableSchema = useStableValue(jsonSchema);
  const fetched = useFetchedSpec(specUrl);

  const state = React.useMemo<ModelState>(() => {
    try {
      const inputs = [stableSpec, specUrl, stableSchema].filter(Boolean).length;
      if (inputs !== 1) throw new Error('Provide exactly one of spec, specUrl, or jsonSchema');

      let api: ParsedAPI;
      if (stableSchema) {
        if (!baseUrl) throw new Error('baseUrl is required when using jsonSchema');
        api = parseOpenAPISync(wrapJsonSchemaAsOpenAPI(stableSchema, { baseUrl, resourcePath }));
      } else if (stableSpec) {
        api = parseOpenAPISync(stableSpec);
      } else {
        if (fetched.status !== 'ready') return fetched;
        api = parseOpenAPISync(fetched.spec);
        api.baseUrl = resolveAgainst(api.baseUrl, fetched.url);
      }

      if (baseUrl) api.baseUrl = baseUrl;
      const resources = buildResources(api);
      return { status: 'ready', api, resources, menu: buildMenu(resources) };
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, [stableSpec, stableSchema, specUrl, fetched, baseUrl, resourcePath]);

  React.useEffect(() => {
    if (state.status === 'ready') {
      onReadyRef.current?.(state.api, generateRoutes(state.api));
    } else if (state.status === 'error') {
      onErrorRef.current?.(state.error);
      message.error(state.error.message);
    }
  }, [state, onReadyRef, onErrorRef]);

  const runtime = React.useMemo<AgulRuntime | null>(
    () =>
      state.status === 'ready'
        ? { baseUrl: state.api.baseUrl, schemas: state.api.schemas, http, routeBase }
        : null,
    [state, http, routeBase],
  );

  if (state.status === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 64 }}>
        <Spin size="large" />
        <div data-testid="agul-loading">Loading OpenAPI specification...</div>
      </div>
    );
  }

  if (state.status === 'error') {
    return <Alert message="Error" description={state.error.message} type="error" showIcon style={{ margin: 24 }} />;
  }

  if (state.resources.length === 0) {
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

  const defaultPath = state.menu[0]?.children?.[0]?.key;

  return (
    <AgulRuntimeProvider value={runtime!}>
      <PluginProvider plugins={plugins}>
        <AppLayout menu={state.menu} apiTitle={state.api.title} apiVersion={state.api.version}>
          <Routes>
            {defaultPath && <Route index element={<Navigate to={relative(defaultPath)} replace />} />}
            {state.resources.flatMap((resource) => resourceRoutes(resource))}
            <Route
              path="*"
              element={<Alert message="404 Not Found" description="The page you are looking for does not exist" type="warning" showIcon />}
            />
          </Routes>
        </AppLayout>
      </PluginProvider>
    </AgulRuntimeProvider>
  );
}

function resourceRoutes(resource: Resource): React.ReactElement[] {
  const { paths, key } = resource;
  const routes: React.ReactElement[] = [];

  if (paths.list) routes.push(<Route key={`${key}:list`} path={relative(paths.list)} element={<ListView resource={resource} />} />);
  if (paths.create) routes.push(<Route key={`${key}:create`} path={relative(paths.create)} element={<FormView key="create" resource={resource} mode="create" />} />);
  if (paths.detail) routes.push(<Route key={`${key}:detail`} path={relative(paths.detail)} element={<DetailView resource={resource} />} />);
  if (paths.edit) routes.push(<Route key={`${key}:edit`} path={relative(paths.edit)} element={<FormView key="edit" resource={resource} mode="edit" />} />);

  return routes;
}

/** Pathname of the host `<Route path="/x/*">` AGUL is mounted in ('' when AGUL owns the router). */
function useMountPath(embedded: boolean): string {
  const { pathname } = useLocation();
  const splat = useParams()['*'];
  if (!embedded || splat === undefined) return '';
  return pathname.slice(0, pathname.length - splat.length).replace(/\/+$/, '');
}

function relative(path: string): string {
  return path.replace(/^\/+/, '');
}

function resolveAgainst(url: string, specUrl: string): string {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(url) || typeof window === 'undefined') return url;
  return new URL(url || '.', new URL(specUrl, window.location.href)).toString().replace(/\/+$/, '');
}

function useLatest<T>(value: T): React.RefObject<T> {
  const ref = React.useRef(value);
  React.useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Keeps the previous reference while the value is structurally equal, so inline literals don't re-trigger parsing. */
function useStableValue<T>(value: T): T {
  const ref = React.useRef(value);
  if (value !== ref.current && JSON.stringify(value) !== JSON.stringify(ref.current)) {
    ref.current = value;
  }
  return ref.current;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; url: string; spec: Record<string, unknown> };

function useFetchedSpec(specUrl: string | undefined): FetchState {
  const [state, setState] = React.useState<FetchState>({ status: 'loading' });

  React.useEffect(() => {
    if (!specUrl) return;
    let cancelled = false;
    setState({ status: 'loading' });

    fetch(specUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch spec: ${response.status}`);
        return response.json();
      })
      .then((spec) => !cancelled && setState({ status: 'ready', url: specUrl, spec }))
      .catch((err) => !cancelled && setState({ status: 'error', error: err instanceof Error ? err : new Error(String(err)) }));

    return () => {
      cancelled = true;
    };
  }, [specUrl]);

  return state.status === 'ready' && state.url !== specUrl ? { status: 'loading' } : state;
}

export async function createAGULFromSpec(
  spec: Record<string, unknown>,
  options?: { baseUrl?: string },
): Promise<{ api: ParsedAPI; routes: RouteConfig[]; menu: MenuItem[]; resources: Resource[] }> {
  const api = await parseOpenAPI(spec);
  if (options?.baseUrl) api.baseUrl = options.baseUrl;
  return describeApi(api);
}

export async function createAGULFromJsonSchema(
  schema: SchemaObject,
  options: JsonSchemaInputOptions,
): Promise<{ api: ParsedAPI; routes: RouteConfig[]; menu: MenuItem[]; resources: Resource[] }> {
  return describeApi(await parseJsonSchema(schema, options));
}

function describeApi(api: ParsedAPI) {
  const resources = buildResources(api);
  return { api, routes: generateRoutes(api), menu: buildMenu(resources), resources };
}
