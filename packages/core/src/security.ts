import type { OAuthFlows, ParsedEndpoint, SecurityRequirement, SecurityScheme } from './types.js';

const SCHEME_TYPES = new Set(['apiKey', 'http', 'oauth2', 'openIdConnect', 'mutualTLS']);

export function normalizeSecuritySchemes(raw: unknown): Record<string, SecurityScheme> {
  if (!raw || typeof raw !== 'object') return {};
  const schemes: Record<string, SecurityScheme> = {};
  for (const [name, value] of Object.entries(raw as Record<string, any>)) {
    if (!value || typeof value !== 'object' || !SCHEME_TYPES.has(value.type)) continue;
    if (value.type === 'http') {
      schemes[name] = { ...value, scheme: String(value.scheme ?? 'bearer').toLowerCase() };
    } else if (value.type === 'oauth2') {
      schemes[name] = { ...value, flows: (value.flows ?? {}) as OAuthFlows };
    } else if (value.type === 'apiKey' && !value.name) {
      continue;
    } else {
      schemes[name] = value;
    }
  }
  return schemes;
}

/** True when the operation can be called without credentials. */
export function isPublicOperation(endpoint: Pick<ParsedEndpoint, 'security'>): boolean {
  const security = endpoint.security;
  return !security || security.length === 0 || security.some((requirement) => Object.keys(requirement).length === 0);
}

/** Schemes the spec actually uses on at least one operation (falls back to all declared schemes). */
export function usedSecuritySchemes(
  endpoints: Pick<ParsedEndpoint, 'security'>[],
  schemes: Record<string, SecurityScheme>,
): Record<string, SecurityScheme> {
  const used = new Set(endpoints.flatMap((endpoint) => (endpoint.security ?? []).flatMap((req) => Object.keys(req))));
  const picked = Object.fromEntries(Object.entries(schemes).filter(([name]) => used.has(name)));
  return Object.keys(picked).length > 0 ? picked : schemes;
}

/** What the signed-in user may do. `scopes` undefined means "unknown" and skips scope checks. */
export interface AccessGrants {
  /** Roles, permissions, groups and scopes, as plain strings. */
  authorities: ReadonlySet<string>;
  /** OAuth scopes actually granted, when known (token response `scope` or a `scope`/`scp` claim). */
  scopes?: ReadonlySet<string>;
  /** Security schemes the user holds credentials for; requirements naming other schemes can't be met. */
  schemes?: ReadonlySet<string>;
}

/** Roles or permissions an operation asks for via `x-agul-roles` / `x-agul-authorities` (any one suffices). */
export function requiredRoles(endpoint: Pick<ParsedEndpoint, 'extensions'>): string[] {
  const raw = endpoint.extensions?.['x-agul-roles'] ?? endpoint.extensions?.['x-agul-authorities'];
  if (typeof raw === 'string') return [raw];
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Whether the grants allow an operation: one of its security requirements has all its OAuth scopes granted,
 * and the user holds one of its `x-agul-roles`. Without grants (nothing known about the user) everything is allowed;
 * the API stays the real gatekeeper either way.
 */
export function canAccessEndpoint(
  endpoint: Pick<ParsedEndpoint, 'security' | 'extensions'>,
  schemes: Record<string, SecurityScheme>,
  grants: AccessGrants | undefined,
): boolean {
  if (!grants) return true;

  const roles = requiredRoles(endpoint);
  if (roles.length > 0 && !roles.some((role) => grants.authorities.has(role))) return false;

  if (isPublicOperation(endpoint) || (!grants.scopes && !grants.schemes)) return true;
  const { scopes, schemes: held } = grants;
  return endpoint.security!.some((requirement: SecurityRequirement) =>
    Object.entries(requirement).every(([name, needed]) => {
      if (held && !held.has(name)) return false;
      const type = schemes[name]?.type;
      if (!scopes || (type !== 'oauth2' && type !== 'openIdConnect')) return true;
      return (needed ?? []).every((scope) => scopes.has(scope));
    }),
  );
}

/** Decodes a JWT's payload without verifying it — for display and UI gating only, never for trust. */
export function decodeJwt(token: string | undefined): Record<string, unknown> | undefined {
  const payload = token?.split('.')[1];
  if (!payload) return undefined;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    return claims && typeof claims === 'object' ? claims : undefined;
  } catch {
    return undefined;
  }
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/[\s,]+/).filter(Boolean);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Roles, permissions and scopes found in common token claim shapes: `scope`/`scp`, `roles`, `permissions`,
 * `authorities`, `groups`, `cognito:groups`, Keycloak `realm_access.roles` and `resource_access.*.roles`.
 */
export function grantsFromClaims(claims: Record<string, unknown> | undefined, grantedScope?: string): AccessGrants | undefined {
  if (!claims && grantedScope === undefined) return undefined;
  const scopeClaim = claims ? [...strings(claims.scope), ...strings(claims.scp)] : [];
  const scopes = grantedScope !== undefined ? strings(grantedScope) : scopeClaim;
  const authorities = new Set<string>(scopes);
  if (claims) {
    for (const key of ['roles', 'role', 'permissions', 'authorities', 'groups', 'cognito:groups']) {
      for (const item of strings(claims[key])) authorities.add(item);
    }
    const realm = claims.realm_access as { roles?: unknown } | undefined;
    for (const item of strings(realm?.roles)) authorities.add(item);
    const resources = claims.resource_access as Record<string, { roles?: unknown }> | undefined;
    for (const client of Object.values(resources ?? {})) {
      for (const item of strings(client?.roles)) authorities.add(item);
    }
  }
  const scopesKnown = grantedScope !== undefined || (claims ? 'scope' in claims || 'scp' in claims : false);
  return { authorities, scopes: scopesKnown ? new Set(scopes) : undefined };
}
