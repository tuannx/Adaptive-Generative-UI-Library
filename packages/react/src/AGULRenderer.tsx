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
import { Alert, App as AntdApp, Button, ConfigProvider, Result, Space, Spin, Tag, Tooltip } from 'antd';
import { useSWRConfig } from 'swr';
import {
  generateRoutes,
  heuristicDecisions,
  planUi,
  resolveDecisions,
  withDecisionCache,
  parseOpenAPI,
  parseOpenAPISync,
  parseJsonSchema,
  wrapJsonSchemaAsOpenAPI,
  type AccessGrants,
  type JsonSchemaInputOptions,
  type OperationPage,
  type ParsedAPI,
  type Resource,
  type RouteConfig,
  type SchemaObject,
  type UiDecision,
  type UiDecisionProvider,
  type UiPlan,
} from '@agul/core';
import { ActionView } from './components/ActionView.js';
import { ChatView } from './components/ChatView.js';
import { AppLayout } from './components/AppLayout.js';
import { ListView } from './components/ListView.js';
import { DetailView } from './components/DetailView.js';
import { FormView } from './components/FormView.js';
import { createAgulFetch, createAgulHttp, withProxy, type AgulAuthConfig, type GetAuthHeaders } from './http/client.js';
import { useAuthController, type AgulAuthOptions } from './auth/controller.js';
import { AgulAuthProvider, AuthMenu, SignInModal, SignInPanel } from './auth/AuthUi.js';
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
  /**
   * Built-in sign-in from the spec's `securitySchemes` (API key, Basic, Bearer, OAuth 2 / OpenID Connect).
   * Used when neither `token` nor `getAuthHeaders` is given. Credentials are only sent to the API's origin.
   */
  auth?: AgulAuthOptions;
  /**
   * Roles / permissions / scopes of the current user. Operations needing others (`x-agul-roles`, OAuth scopes
   * in `security`) are left out of menus, pages and buttons. Defaults to what the signed-in token's claims say.
   */
  authorities?: string[];
  /** Custom field renderer plugins */
  plugins?: AgulFieldPlugin[];
  /** Ant Design primary color */
  primaryColor?: string;
  /**
   * Prefix for a same-origin CORS proxy; absolute API and spec URLs are requested as
   * `${proxyUrl}${url}` (e.g. `/proxy/`). See `apps/demo/worker` for a Cloudflare implementation.
   */
  proxyUrl?: string;
  /** Router basename when AGUL creates its own BrowserRouter (ignored inside a host router) */
  basename?: string;
  /**
   * Decides how each operation is presented (CRUD / action / chat / hidden) — e.g.
   * `createHttpDecisionProvider({ url: '/decide' })` backed by an LLM. AGUL renders its own
   * heuristic layout immediately and switches when the provider answers; failures keep the heuristic layout.
   * `x-agul-view` in the spec always wins.
   */
  decisionProvider?: UiDecisionProvider | UiDecisionProvider[];
  /** Cache provider decisions in localStorage per spec (default true). */
  cacheDecisions?: boolean;
  /** Called with the decisions in effect whenever they change. */
  onDecisions?: (decisions: Map<string, UiDecision>) => void;
  /** Called when spec processing fails */
  onError?: (error: Error) => void;
  /** Called when spec is loaded and routes are ready */
  onReady?: (api: ParsedAPI, routes: RouteConfig[]) => void;
}

interface AgulModel {
  api: ParsedAPI;
}

type ModelState = { status: 'loading' } | { status: 'error'; error: Error } | ({ status: 'ready' } & AgulModel);

const ALL_KEYS = () => true;

export function AGULRenderer({ basename, primaryColor = '#1890ff', ...props }: AGULRendererProps) {
  const inRouter = useInRouterContext();
  const app = (
    <ConfigProvider theme={{ token: { colorPrimary: primaryColor } }}>
      {/* antd's App context makes message / modal work under React 19, where the static helpers render nothing */}
      <AntdApp component={false}>
        <AGULApp {...props} embedded={inRouter} />
      </AntdApp>
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
  auth: authOptions,
  authorities,
  proxyUrl,
  plugins = [],
  decisionProvider,
  cacheDecisions = true,
  onDecisions,
  onError,
  onReady,
  embedded,
}: Omit<AGULRendererProps, 'basename' | 'primaryColor'> & { embedded: boolean }) {
  const routeBase = useMountPath(embedded);
  const { search } = useLocation();

  const auth = React.useRef<AgulAuthConfig>({ token, getAuthHeaders });
  const proxy = useLatest(proxyUrl);
  const http = React.useMemo(() => createAgulHttp(() => auth.current, () => proxy.current), [auth, proxy]);
  const agulFetch = React.useMemo(() => createAgulFetch(() => auth.current, () => proxy.current), [auth, proxy]);
  const { mutate } = useSWRConfig();
  const { message } = AntdApp.useApp();
  const onReadyRef = useLatest(onReady);
  const onErrorRef = useLatest(onError);

  const stableSpec = useStableValue(spec);
  const stableSchema = useStableValue(jsonSchema);
  const fetched = useFetchedSpec(specUrl, proxyUrl);

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
        resolveSchemeUrls(api, fetched.url);
      }

      if (baseUrl) api.baseUrl = baseUrl;
      return { status: 'ready', api };
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
  }, [state, onReadyRef, onErrorRef, message]);

  const decided = useProviderDecisions(
    state.status === 'ready' ? state.api : undefined,
    decisionProvider,
    cacheDecisions,
  );
  const authState = useAuthController(state.status === 'ready' ? state.api : undefined, authOptions, {
    token,
    hostManaged: !!(token || getAuthHeaders),
    onChange: () => void mutate(ALL_KEYS),
  });
  auth.current = { token, getAuthHeaders, sign: authState.sign, onUnauthorized: authState.onUnauthorized };

  const grants = useGrants(authorities, authState.grants);
  const heuristics = React.useMemo(() => (state.status === 'ready' ? heuristicDecisions(state.api) : undefined), [state]);
  const plan = React.useMemo<UiPlan | undefined>(
    () => (state.status !== 'ready' ? undefined : planUi(state.api, decided.decisions ?? heuristics, { grants })),
    [state, decided.decisions, heuristics, grants],
  );
  const onDecisionsRef = useLatest(onDecisions);
  React.useEffect(() => {
    if (plan) onDecisionsRef.current?.(plan.decisions);
  }, [plan, onDecisionsRef]);

  const runtime = React.useMemo<AgulRuntime | null>(
    () =>
      state.status === 'ready'
        ? { baseUrl: state.api.baseUrl, schemas: state.api.schemas, http, routeBase, fetch: agulFetch }
        : null,
    [state, http, routeBase, agulFetch],
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

  if (authState.required) {
    return (
      <AgulAuthProvider value={authState}>
        <div style={{ maxWidth: 480, margin: '64px auto', padding: 24 }} data-testid="agul-signin-gate">
          <Result status="403" title={state.api.title} subTitle="Sign in to continue." style={{ paddingBottom: 0 }} />
          <SignInPanel />
        </div>
      </AgulAuthProvider>
    );
  }

  if (!plan || (plan.resources.length === 0 && plan.pages.length === 0)) {
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

  const defaultPath = plan.menu.flatMap((group) => group.children ?? []).find((item) => !item.params)?.key;

  const signedOut = Object.keys(authState.schemes).length > 0 && !authState.user;

  return (
    <AgulAuthProvider value={authState}>
    <AgulRuntimeProvider value={runtime!}>
      <PluginProvider plugins={plugins}>
        <AppLayout
          menu={plan.menu}
          apiTitle={state.api.title}
          apiVersion={state.api.version}
          headerExtra={
            <Space>
              {decisionProvider && <DecisionStatus status={decided.status} error={decided.error} />}
              <AuthMenu />
            </Space>
          }
        >
          <Routes>
            <Route
              index
              element={
                defaultPath ? (
                  <Navigate to={{ pathname: relative(defaultPath), search }} replace />
                ) : (
                  <div data-testid="agul-welcome">
                    <Result
                      status="info"
                      title={state.api.title}
                      subTitle="Pick a page from the menu. Pages under a path parameter ask for its value first."
                    />
                  </div>
                )
              }
            />
            {plan.resources.flatMap((resource) => resourceRoutes(resource))}
            {plan.pages.map((page) => pageRoute(page))}
            <Route
              path="*"
              element={
                <div data-testid="agul-not-found">
                <Result
                  status={signedOut || grants ? '403' : '404'}
                  title={signedOut ? 'Sign in to see this page' : grants ? 'Not available' : 'Page not found'}
                  subTitle={
                    signedOut
                      ? 'This page may need you to be signed in.'
                      : grants
                        ? "This page doesn't exist, or your account isn't allowed to use it."
                        : 'The page you are looking for does not exist.'
                  }
                  extra={
                    signedOut ? (
                      <Button type="primary" onClick={() => authState.openSignIn('required')}>
                        Sign in
                      </Button>
                    ) : undefined
                  }
                />
                </div>
              }
            />
          </Routes>
        </AppLayout>
        <SignInModal />
      </PluginProvider>
    </AgulRuntimeProvider>
    </AgulAuthProvider>
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

function pageRoute(page: OperationPage): React.ReactElement {
  const element =
    page.kind === 'chat' ? <ChatView key={page.operationId} page={page} /> : <ActionView key={page.operationId} page={page} />;
  return <Route key={`op:${page.operationId}`} path={relative(page.path)} element={element} />;
}

type DecisionStatusValue = 'idle' | 'pending' | 'done' | 'error';

function DecisionStatus({ status, error }: { status: DecisionStatusValue; error?: string }) {
  const [color, text] =
    status === 'pending'
      ? ['processing', 'Arranging layout…']
      : status === 'done'
        ? ['purple', 'AI layout']
        : status === 'error'
          ? ['warning', 'Default layout']
          : ['default', 'Default layout'];
  return (
    <Tooltip title={status === 'error' ? `Decision provider failed: ${error}` : undefined}>
      <Tag color={color} data-testid="agul-decision-status" data-status={status}>
        {text}
      </Tag>
    </Tooltip>
  );
}

/** Grants from the `authorities` prop when given, else from the signed-in token. */
function useGrants(authorities: string[] | undefined, fromToken: AccessGrants | undefined): AccessGrants | undefined {
  const key = authorities?.join('\n');
  return React.useMemo(
    () => (key !== undefined ? { authorities: new Set(key ? key.split('\n') : []) } : fromToken),
    [key, fromToken],
  );
}

function storageStore() {
  return {
    get: (key: string) => window.localStorage.getItem(key),
    set: (key: string, value: string) => window.localStorage.setItem(key, value),
  };
}

/** Runs the decision providers for a spec; keeps the heuristic plan until they answer. */
function useProviderDecisions(
  api: ParsedAPI | undefined,
  provider: UiDecisionProvider | UiDecisionProvider[] | undefined,
  cache: boolean,
): { decisions?: Map<string, UiDecision>; status: DecisionStatusValue; error?: string } {
  const providers = React.useMemo(() => (provider ? (Array.isArray(provider) ? provider : [provider]) : []), [provider]);
  const providerKey = providers.map((item) => item.id).join('|');
  const providersRef = useLatest(providers);
  const [result, setResult] = React.useState<{
    api?: ParsedAPI;
    decisions?: Map<string, UiDecision>;
    status: DecisionStatusValue;
    error?: string;
  }>({ status: 'idle' });

  React.useEffect(() => {
    if (!api || !providerKey) return;
    const controller = new AbortController();
    const errors: string[] = [];
    const active = providersRef.current.map((item) =>
      cache && typeof window !== 'undefined' ? withDecisionCache(item, storageStore()) : item,
    );
    setResult({ api, status: 'pending' });

    resolveDecisions(api, active, {
      signal: controller.signal,
      onError: (failed, error) => errors.push(`${failed.id}: ${error instanceof Error ? error.message : String(error)}`),
    })
      .then((decisions) => {
        if (controller.signal.aborted) return;
        const allFailed = errors.length === active.length;
        setResult({ api, decisions: allFailed ? undefined : decisions, status: allFailed ? 'error' : 'done', error: errors.join('; ') || undefined });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ api, status: 'error', error: String(error) });
      });

    return () => controller.abort();
  }, [api, providerKey, cache, providersRef]);

  return result.api === api ? result : { status: providerKey ? 'pending' : 'idle' };
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

/** Relative sign-in URLs in `securitySchemes` are relative to the spec document, like `servers`. */
function resolveSchemeUrls(api: ParsedAPI, specUrl: string): void {
  for (const scheme of Object.values(api.securitySchemes ?? {})) {
    if (scheme.type === 'openIdConnect') scheme.openIdConnectUrl = resolveAgainst(scheme.openIdConnectUrl, specUrl);
    if (scheme.type === 'oauth2') {
      for (const flow of Object.values(scheme.flows)) {
        if (!flow) continue;
        if (flow.authorizationUrl) flow.authorizationUrl = resolveAgainst(flow.authorizationUrl, specUrl);
        if (flow.tokenUrl) flow.tokenUrl = resolveAgainst(flow.tokenUrl, specUrl);
        if (flow.refreshUrl) flow.refreshUrl = resolveAgainst(flow.refreshUrl, specUrl);
      }
    }
  }
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

function useFetchedSpec(specUrl: string | undefined, proxyUrl: string | undefined): FetchState {
  const [state, setState] = React.useState<FetchState>({ status: 'loading' });

  React.useEffect(() => {
    if (!specUrl) return;
    let cancelled = false;
    setState({ status: 'loading' });

    fetch(withProxy(specUrl, proxyUrl))
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch spec: ${response.status}`);
        return response.text();
      })
      .then(parseSpecText)
      .then((spec) => !cancelled && setState({ status: 'ready', url: specUrl, spec }))
      .catch((err) => !cancelled && setState({ status: 'error', error: err instanceof Error ? err : new Error(String(err)) }));

    return () => {
      cancelled = true;
    };
  }, [specUrl, proxyUrl]);

  return state.status === 'ready' && state.url !== specUrl ? { status: 'loading' } : state;
}

/** Parses a spec document as JSON, falling back to YAML (the parser is loaded only when needed). */
export async function parseSpecText(text: string): Promise<Record<string, unknown>> {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) return JSON.parse(text);
  const { load } = await import('js-yaml');
  const doc = load(text);
  if (!doc || typeof doc !== 'object') throw new Error('Spec is neither JSON nor a YAML mapping');
  return doc as Record<string, unknown>;
}

export async function createAGULFromSpec(
  spec: Record<string, unknown>,
  options?: { baseUrl?: string },
): Promise<ReturnType<typeof describeApi>> {
  const api = await parseOpenAPI(spec);
  if (options?.baseUrl) api.baseUrl = options.baseUrl;
  return describeApi(api);
}

export async function createAGULFromJsonSchema(
  schema: SchemaObject,
  options: JsonSchemaInputOptions,
): Promise<ReturnType<typeof describeApi>> {
  return describeApi(await parseJsonSchema(schema, options));
}

function describeApi(api: ParsedAPI) {
  const plan = planUi(api);
  return { api, routes: generateRoutes(api), menu: plan.menu, resources: plan.resources, pages: plan.pages, decisions: plan.decisions };
}
