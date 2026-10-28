import type { AgulCredential } from './session.js';

const PENDING_KEY = 'agul:oauth:pending';

export interface OidcConfiguration {
  authorization_endpoint?: string;
  token_endpoint?: string;
  end_session_endpoint?: string;
  scopes_supported?: string[];
}

const discoveryCache = new Map<string, Promise<OidcConfiguration>>();

export function discoverOidc(url: string, doFetch: typeof fetch = fetch): Promise<OidcConfiguration> {
  let cached = discoveryCache.get(url);
  if (!cached) {
    cached = doFetch(url).then((response) => {
      if (!response.ok) throw new Error(`OpenID discovery failed: ${response.status}`);
      return response.json() as Promise<OidcConfiguration>;
    });
    cached.catch(() => discoveryCache.delete(url));
    discoveryCache.set(url, cached);
  }
  return cached;
}

function randomString(bytes = 32): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return base64Url(values);
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/** The page the provider redirects back to: the current URL without query or hash. */
export function defaultRedirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

interface PendingAuthorization {
  scheme: string;
  state: string;
  verifier?: string;
  tokenUrl?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  /** Path + query to restore after the callback. */
  returnTo: string;
  responseType: 'code' | 'token';
}

export interface AuthorizeOptions {
  scheme: string;
  authorizationUrl: string;
  tokenUrl?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes: string[];
  responseType?: 'code' | 'token';
  /** Extra query parameters for the authorization request (e.g. `audience`). */
  extraParams?: Record<string, string>;
}

/** Starts an authorization code (+PKCE) or implicit flow by redirecting the browser to the provider. */
export async function startAuthorization(options: AuthorizeOptions): Promise<void> {
  const responseType = options.responseType ?? 'code';
  const state = randomString(16);
  const verifier = responseType === 'code' ? randomString(48) : undefined;
  const redirectUri = options.redirectUri ?? defaultRedirectUri();
  const pending: PendingAuthorization = {
    scheme: options.scheme,
    state,
    verifier,
    tokenUrl: options.tokenUrl,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    redirectUri,
    returnTo: `${window.location.pathname}${window.location.search}`,
    responseType,
  };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  const url = new URL(options.authorizationUrl, window.location.href);
  url.searchParams.set('response_type', responseType);
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  if (options.scopes.length > 0) url.searchParams.set('scope', options.scopes.join(' '));
  if (verifier) {
    url.searchParams.set('code_challenge', await pkceChallenge(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
  }
  for (const [key, value] of Object.entries(options.extraParams ?? {})) url.searchParams.set(key, value);
  window.location.assign(url.toString());
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function toCredential(body: TokenResponse, tokenUrl: string | undefined, clientId: string | undefined): AgulCredential {
  if (!body.access_token) throw new Error(body.error_description ?? body.error ?? 'Token response has no access_token');
  const expiresIn = Number(body.expires_in);
  return {
    kind: 'token',
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    idToken: body.id_token,
    scope: body.scope,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined,
    tokenUrl,
    clientId,
  };
}

/** POSTs a form to a token endpoint (RFC 6749 §4) and returns the resulting credential. */
export async function requestToken(
  tokenUrl: string,
  params: Record<string, string | undefined>,
  doFetch: typeof fetch = fetch,
): Promise<AgulCredential> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') body.set(key, value);
  const response = await doFetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });
  const payload = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok) {
    throw new Error(payload.error_description ?? payload.error ?? `Token request failed: ${response.status}`);
  }
  return toCredential(payload, tokenUrl, params.client_id);
}

export function refreshCredential(credential: AgulCredential, doFetch: typeof fetch = fetch): Promise<AgulCredential> | undefined {
  if (credential.kind !== 'token' || !credential.refreshToken || !credential.tokenUrl) return undefined;
  return requestToken(
    credential.tokenUrl,
    { grant_type: 'refresh_token', refresh_token: credential.refreshToken, client_id: credential.clientId },
    doFetch,
  ).then((next) =>
    next.kind === 'token' ? { ...next, refreshToken: next.refreshToken ?? credential.refreshToken, idToken: next.idToken ?? credential.idToken } : next,
  );
}

const CALLBACK_PARAMS = ['code', 'state', 'session_state', 'iss', 'error', 'error_description', 'error_uri'];

/**
 * Finishes a redirect flow when the current URL is the provider's callback. Returns the scheme and credential,
 * or `undefined` when this page load isn't a callback. Callback parameters are removed from the address bar.
 */
export async function completeAuthorization(
  doFetch: typeof fetch = fetch,
): Promise<{ scheme: string; credential: AgulCredential; returnTo: string } | undefined> {
  if (typeof window === 'undefined') return undefined;
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return undefined;
  const pending = JSON.parse(raw) as PendingAuthorization;

  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const params = new URLSearchParams(pending.responseType === 'token' ? fragment : query);
  const state = params.get('state');
  if (!state) return undefined;

  sessionStorage.removeItem(PENDING_KEY);
  for (const name of CALLBACK_PARAMS) query.delete(name);
  const cleanSearch = query.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`);

  if (state !== pending.state) throw new Error('Sign-in response does not match the request (state mismatch)');
  const error = params.get('error');
  if (error) throw new Error(params.get('error_description') ?? error);

  if (pending.responseType === 'token') {
    return {
      scheme: pending.scheme,
      returnTo: pending.returnTo,
      credential: toCredential(
        {
          access_token: fragment.get('access_token') ?? undefined,
          expires_in: fragment.get('expires_in') ?? undefined,
          scope: fragment.get('scope') ?? undefined,
          id_token: fragment.get('id_token') ?? undefined,
        },
        undefined,
        pending.clientId,
      ),
    };
  }

  const code = params.get('code');
  if (!code || !pending.tokenUrl) throw new Error('Sign-in response has no authorization code');
  const credential = await requestToken(
    pending.tokenUrl,
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: pending.redirectUri,
      client_id: pending.clientId,
      client_secret: pending.clientSecret,
      code_verifier: pending.verifier,
    },
    doFetch,
  );
  return { scheme: pending.scheme, credential, returnTo: pending.returnTo };
}
