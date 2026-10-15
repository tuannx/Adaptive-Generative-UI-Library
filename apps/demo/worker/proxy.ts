/**
 * Same-origin CORS proxy at `/proxy/<absolute-url>` for APIs that can't be called from a browser.
 * Only forwards to hosts in PROXY_ALLOWED_HOSTS (comma-separated, `*.example.com` wildcards
 * allowed) so the deployment can't be used as an open relay.
 */

export interface Env {
  ASSETS: Fetcher;
  PROXY_ALLOWED_HOSTS?: string;
}

export const PROXY_PREFIX = '/proxy/';

const DROPPED_REQUEST_HEADERS = ['cookie', 'host', 'origin', 'referer', 'connection'];
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/i;

export function isHostAllowed(hostname: string, allowList: string | undefined): boolean {
  const host = hostname.toLowerCase();
  if (PRIVATE_HOST.test(host)) return false;

  return (allowList ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) =>
      entry === '*' ||
      entry === host ||
      (entry.startsWith('*.') && (host === entry.slice(2) || host.endsWith(entry.slice(1)))),
    );
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function handleProxy(request: Request, env: Env): Promise<Response> {
  const { origin } = new URL(request.url);
  const raw = request.url
    .slice(origin.length + PROXY_PREFIX.length)
    .replace(/^(https?):\/(?!\/)/i, '$1://');

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return jsonError(400, 'Expected /proxy/<absolute http(s) URL>');
  }

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return jsonError(400, 'Only http(s) targets can be proxied');
  }
  if (!isHostAllowed(target.hostname, env.PROXY_ALLOWED_HOSTS)) {
    return jsonError(
      403,
      `Host ${target.hostname} is not in PROXY_ALLOWED_HOSTS. Add it in wrangler.jsonc (vars) or the Cloudflare dashboard.`,
    );
  }

  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (DROPPED_REQUEST_HEADERS.includes(name) || name.startsWith('cf-') || name.startsWith('x-forwarded-')) {
      headers.delete(name);
    }
  }

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const upstream = await fetch(target.toString(), {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'follow',
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('set-cookie');
  responseHeaders.set('x-agul-proxy', target.hostname);
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}
