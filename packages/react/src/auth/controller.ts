import React from 'react';
import {
  decodeJwt,
  grantsFromClaims,
  hashText,
  usedSecuritySchemes,
  type AccessGrants,
  type ParsedAPI,
  type SecurityScheme,
} from '@agul/core';
import {
  AgulSessionStore,
  describeUser,
  grantsFromCredentials,
  isApiUrl,
  signRequest,
  type AgulAuthStorage,
  type AgulCredential,
  type AgulCredentials,
  type AgulUser,
} from './session.js';
import { completeAuthorization, discoverOidc, refreshCredential, startAuthorization } from './oauth.js';

export interface AgulOAuthOptions {
  /** OAuth2/OIDC client id registered for this UI (public client, PKCE). */
  clientId?: string;
  /** Only for confidential test clients — a secret in a browser is not secret. */
  clientSecret?: string;
  /** Defaults to the current page without query or hash. */
  redirectUri?: string;
  /** Extra scopes to request on top of the ones the spec's operations declare. */
  scopes?: string[];
  /** Extra authorization request parameters, e.g. `{ audience: 'https://api.example.com' }`. */
  extraParams?: Record<string, string>;
}

export interface AgulAuthOptions {
  oauth?: AgulOAuthOptions;
  /** Where credentials are kept: `session` (default, per tab), `local`, or `memory` (lost on reload). */
  storage?: AgulAuthStorage;
  /** Ask for sign-in before showing any page when the API is secured (default: ask when the API answers 401). */
  required?: boolean;
}

export type SignInReason = 'required' | 'expired' | 'manual';

export interface AgulAuthState {
  /** Security schemes the user can sign in with (empty when the API is public or the host manages auth). */
  schemes: Record<string, SecurityScheme>;
  credentials: AgulCredentials;
  user?: AgulUser;
  grants?: AccessGrants;
  /** Whether the host passed `token` / `getAuthHeaders` (AGUL shows no sign-in UI then). */
  hostManaged: boolean;
  required: boolean;
  options: AgulAuthOptions;
  signIn: { open: boolean; reason?: SignInReason; error?: string };
  openSignIn(reason?: SignInReason): void;
  closeSignIn(): void;
  setCredential(scheme: string, credential: AgulCredential): void;
  startRedirect(scheme: string, flow: 'authorizationCode' | 'implicit' | 'openIdConnect', clientId?: string): Promise<void>;
  signOut(): void;
  scopesFor(scheme: string): string[];
  sign(url: string): Promise<{ url: string; headers: Record<string, string> }>;
  onUnauthorized(url: string): Promise<boolean>;
}

const REFRESH_MARGIN_MS = 30_000;

export function useAuthController(
  api: ParsedAPI | undefined,
  options: AgulAuthOptions = {},
  host: { token?: string; hostManaged: boolean; onChange?: () => void },
): AgulAuthState {
  const schemes = React.useMemo(
    () => (api && !host.hostManaged ? usedSecuritySchemes(api.endpoints, api.securitySchemes ?? {}) : {}),
    [api, host.hostManaged],
  );
  const storageKey = api ? `agul:auth:${hashText(`${api.title}|${api.baseUrl}`)}` : 'agul:auth:none';
  const store = React.useMemo(() => new AgulSessionStore(storageKey, options.storage), [storageKey, options.storage]);
  const credentials = React.useSyncExternalStore(store.subscribe, () => store.get(), () => store.get());
  const [signIn, setSignIn] = React.useState<AgulAuthState['signIn']>({ open: false });
  const refreshing = React.useRef(new Map<string, Promise<boolean>>());
  const completing = React.useRef<Promise<boolean> | null>(null);
  const onChange = React.useRef(host.onChange);
  onChange.current = host.onChange;

  const scopesFor = React.useCallback(
    (name: string) => {
      const scopes = new Set<string>(options.oauth?.scopes ?? []);
      if (schemes[name]?.type === 'openIdConnect') scopes.add('openid');
      for (const endpoint of api?.endpoints ?? []) {
        for (const requirement of endpoint.security ?? []) for (const scope of requirement[name] ?? []) scopes.add(scope);
      }
      return [...scopes];
    },
    [api, schemes, options.oauth?.scopes],
  );

  React.useEffect(() => {
    if (!api || host.hostManaged) return;
    let cancelled = false;
    const done = completeAuthorization()
      .then((result) => {
        if (!result || cancelled) return false;
        store.set(result.scheme, result.credential);
        setSignIn({ open: false });
        window.history.replaceState(window.history.state, '', result.returnTo);
        window.dispatchEvent(new PopStateEvent('popstate'));
        onChange.current?.();
        return true;
      })
      .catch((error) => {
        if (!cancelled) setSignIn({ open: true, reason: 'manual', error: error instanceof Error ? error.message : String(error) });
        return false;
      });
    completing.current = done;
    done.finally(() => {
      if (completing.current === done) completing.current = null;
    });
    return () => {
      cancelled = true;
    };
  }, [api, host.hostManaged, store]);

  const hasSchemes = Object.keys(schemes).length > 0;
  const signedIn = Object.keys(credentials).length > 0;
  const required = !!options.required && hasSchemes && !signedIn;

  const refresh = React.useCallback(
    (name: string, credential: AgulCredential): Promise<boolean> => {
      let pending = refreshing.current.get(name);
      if (!pending) {
        const request = refreshCredential(credential);
        pending = request
          ? request.then(
              (next) => {
                store.set(name, next);
                return true;
              },
              () => false,
            )
          : Promise.resolve(false);
        pending.finally(() => refreshing.current.delete(name));
        refreshing.current.set(name, pending);
      }
      return pending;
    },
    [store],
  );

  const sign = React.useCallback(
    async (url: string) => {
      if (!api || !hasSchemes || !isApiUrl(url, api.baseUrl)) return { url, headers: {} };
      const current = store.get();
      await Promise.all(
        Object.entries(current).map(([name, credential]) =>
          credential.kind === 'token' && credential.expiresAt && credential.expiresAt - REFRESH_MARGIN_MS < Date.now()
            ? refresh(name, credential)
            : undefined,
        ),
      );
      return signRequest(url, schemes, store.get());
    },
    [api, hasSchemes, schemes, store, refresh],
  );

  const onUnauthorized = React.useCallback(
    async (url: string) => {
      if (!api || !hasSchemes || !isApiUrl(url, api.baseUrl)) return false;
      if (completing.current && (await completing.current)) return true;
      const current = store.get();
      const results = await Promise.all(
        Object.entries(current).map(([name, credential]) =>
          credential.kind === 'token' && credential.refreshToken ? refresh(name, credential) : false,
        ),
      );
      if (results.some(Boolean)) return true;
      setSignIn((state) => (state.open ? state : { open: true, reason: Object.keys(current).length > 0 ? 'expired' : 'required' }));
      return false;
    },
    [api, hasSchemes, store, refresh],
  );

  const setCredential = React.useCallback(
    (name: string, credential: AgulCredential) => {
      store.set(name, credential);
      setSignIn({ open: false });
      onChange.current?.();
    },
    [store],
  );

  const startRedirect = React.useCallback(
    async (name: string, flow: 'authorizationCode' | 'implicit' | 'openIdConnect', clientIdOverride?: string) => {
      const scheme = schemes[name];
      const clientId = clientIdOverride || options.oauth?.clientId;
      if (!scheme || !clientId) throw new Error('A client id is required to sign in');
      let authorizationUrl: string | undefined;
      let tokenUrl: string | undefined;
      if (scheme.type === 'openIdConnect') {
        const discovery = await discoverOidc(scheme.openIdConnectUrl);
        authorizationUrl = discovery.authorization_endpoint;
        tokenUrl = discovery.token_endpoint;
      } else if (scheme.type === 'oauth2') {
        const oauthFlow = flow === 'implicit' ? scheme.flows.implicit : scheme.flows.authorizationCode;
        authorizationUrl = oauthFlow?.authorizationUrl;
        tokenUrl = oauthFlow?.tokenUrl;
      }
      if (!authorizationUrl) throw new Error(`${name} has no authorization URL`);
      await startAuthorization({
        scheme: name,
        authorizationUrl,
        tokenUrl,
        clientId,
        clientSecret: options.oauth?.clientSecret,
        redirectUri: options.oauth?.redirectUri,
        scopes: scopesFor(name),
        responseType: flow === 'implicit' ? 'token' : 'code',
        extraParams: options.oauth?.extraParams,
      });
    },
    [schemes, options.oauth, scopesFor],
  );

  const signOut = React.useCallback(() => {
    const current = store.get();
    store.clear();
    onChange.current?.();
    const oidc = Object.entries(current).find(([name]) => schemes[name]?.type === 'openIdConnect');
    const idToken = oidc && oidc[1].kind === 'token' ? oidc[1].idToken : undefined;
    const scheme = oidc ? schemes[oidc[0]] : undefined;
    if (scheme?.type === 'openIdConnect' && idToken) {
      discoverOidc(scheme.openIdConnectUrl)
        .then((discovery) => {
          if (!discovery.end_session_endpoint) return;
          const url = new URL(discovery.end_session_endpoint, window.location.href);
          url.searchParams.set('id_token_hint', idToken);
          url.searchParams.set('post_logout_redirect_uri', window.location.href);
          window.location.assign(url.toString());
        })
        .catch(() => undefined);
    }
  }, [store, schemes]);

  const hostGrants = React.useMemo(() => (host.token ? grantsFromClaims(decodeJwt(host.token)) : undefined), [host.token]);
  const grants = React.useMemo(
    () => (host.hostManaged ? hostGrants : grantsFromCredentials(credentials)),
    [host.hostManaged, hostGrants, credentials],
  );

  return {
    schemes,
    credentials,
    user: describeUser(credentials),
    grants,
    hostManaged: host.hostManaged,
    required,
    options,
    signIn,
    openSignIn: (reason = 'manual') => setSignIn({ open: true, reason }),
    closeSignIn: () => setSignIn({ open: false }),
    setCredential,
    startRedirect,
    signOut,
    scopesFor,
    sign,
    onUnauthorized,
  };
}
