import { decodeJwt, grantsFromClaims, type AccessGrants, type SecurityScheme } from '@aikitstudio/agul-core';

/** A credential the user entered or obtained for one security scheme. */
export type AgulCredential =
  | { kind: 'apiKey'; value: string }
  | { kind: 'basic'; username: string; password: string }
  | {
      kind: 'token';
      accessToken: string;
      refreshToken?: string;
      /** Epoch milliseconds. */
      expiresAt?: number;
      idToken?: string;
      /** Scopes granted by the token response, when it says. */
      scope?: string;
      /** Where to refresh, and as which client. */
      tokenUrl?: string;
      clientId?: string;
    };

export type AgulCredentials = Record<string, AgulCredential>;

export type AgulAuthStorage = 'session' | 'local' | 'memory';

export interface AgulUser {
  name: string;
  claims?: Record<string, unknown>;
}

function storageFor(kind: AgulAuthStorage): Storage | undefined {
  if (kind === 'memory' || typeof window === 'undefined') return undefined;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Holds the credentials per scheme, persists them, and notifies subscribers on change. */
export class AgulSessionStore {
  private credentials: AgulCredentials;
  private listeners = new Set<() => void>();

  constructor(
    private readonly key: string,
    private readonly storage: AgulAuthStorage = 'session',
  ) {
    this.credentials = this.read();
  }

  private read(): AgulCredentials {
    try {
      const raw = storageFor(this.storage)?.getItem(this.key);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private write(): void {
    try {
      const store = storageFor(this.storage);
      if (Object.keys(this.credentials).length > 0) store?.setItem(this.key, JSON.stringify(this.credentials));
      else store?.removeItem(this.key);
    } catch {
      // storage full or blocked: the session lasts until reload
    }
  }

  get(): AgulCredentials {
    return this.credentials;
  }

  set(scheme: string, credential: AgulCredential): void {
    this.credentials = { ...this.credentials, [scheme]: credential };
    this.write();
    this.emit();
  }

  clear(scheme?: string): void {
    if (scheme) {
      const { [scheme]: _removed, ...rest } = this.credentials;
      this.credentials = rest;
    } else {
      this.credentials = {};
    }
    this.write();
    this.emit();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** True when `url` targets the API (same origin as `baseUrl`): credentials are never sent anywhere else. */
export function isApiUrl(url: string, baseUrl: string): boolean {
  const origin = typeof window !== 'undefined' ? window.location.href : 'http://localhost/';
  try {
    return new URL(url, origin).origin === new URL(baseUrl || '/', origin).origin;
  } catch {
    return false;
  }
}

/** Headers (and query parameters, for `in: query` API keys) that carry the stored credentials. */
export function signRequest(
  url: string,
  schemes: Record<string, SecurityScheme>,
  credentials: AgulCredentials,
): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const query: [string, string][] = [];

  for (const [name, credential] of Object.entries(credentials)) {
    const scheme = schemes[name];
    if (!scheme) continue;
    if (scheme.type === 'apiKey' && credential.kind === 'apiKey') {
      if (scheme.in === 'header') headers[scheme.name] = credential.value;
      else if (scheme.in === 'query') query.push([scheme.name, credential.value]);
    } else if (scheme.type === 'http' && credential.kind === 'basic') {
      headers.Authorization = `Basic ${base64Utf8(`${credential.username}:${credential.password}`)}`;
    } else if (credential.kind === 'token' && (scheme.type === 'http' || scheme.type === 'oauth2' || scheme.type === 'openIdConnect')) {
      headers.Authorization = `Bearer ${credential.accessToken}`;
    }
  }

  if (query.length === 0) return { url, headers };
  const [path, hash = ''] = url.split('#');
  const separator = path.includes('?') ? '&' : '?';
  const params = query.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
  return { url: `${path}${separator}${params}${hash ? `#${hash}` : ''}`, headers };
}

function tokenClaims(credentials: AgulCredentials): Record<string, unknown> | undefined {
  let claims: Record<string, unknown> | undefined;
  for (const credential of Object.values(credentials)) {
    if (credential.kind !== 'token') continue;
    const merged = { ...decodeJwt(credential.idToken), ...decodeJwt(credential.accessToken) };
    if (Object.keys(merged).length > 0) claims = { ...claims, ...merged };
  }
  return claims;
}

/** Who is signed in, for the header menu. */
export function describeUser(credentials: AgulCredentials): AgulUser | undefined {
  const entries = Object.values(credentials);
  if (entries.length === 0) return undefined;
  const claims = tokenClaims(credentials);
  const fromClaims = claims && (claims.name ?? claims.preferred_username ?? claims.email ?? claims.sub);
  if (typeof fromClaims === 'string' && fromClaims) return { name: fromClaims, claims };
  const basic = entries.find((entry) => entry.kind === 'basic');
  if (basic?.kind === 'basic') return { name: basic.username };
  return { name: entries.some((entry) => entry.kind === 'token') ? 'Signed in' : 'API key', claims };
}

/** Grants read from the tokens (claims and granted scopes); `undefined` when the credentials say nothing. */
export function grantsFromCredentials(credentials: AgulCredentials): AccessGrants | undefined {
  const tokens = Object.values(credentials).filter((entry) => entry.kind === 'token');
  if (tokens.length === 0) return undefined;
  const scope = tokens.map((token) => token.scope).filter((value): value is string => typeof value === 'string');
  const grants = grantsFromClaims(tokenClaims(credentials), scope.length > 0 ? scope.join(' ') : undefined);
  return grants && { ...grants, schemes: new Set(Object.keys(credentials)) };
}
