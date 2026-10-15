/**
 * Cloudflare Worker for the AGUL demo: serves the built SPA from static assets and the CORS proxy.
 * Only the default export lives here — every named export of the main module is treated as an entrypoint.
 */
import { handleProxy, PROXY_PREFIX, type Env } from './proxy.js';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith(PROXY_PREFIX)) {
      return handleProxy(request, env);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
