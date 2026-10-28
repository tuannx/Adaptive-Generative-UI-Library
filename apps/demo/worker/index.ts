/**
 * Cloudflare Worker for the AGUL demo: serves the built SPA from static assets and the CORS proxy.
 * Only the default export lives here — every named export of the main module is treated as an entrypoint.
 */
import { handleProxy, PROXY_PREFIX, type Env as ProxyEnv } from './proxy.js';
import { handleDecide, type DecideEnv } from './decide.js';
import { handleTarotMock, TAROT_PREFIX } from './tarot-mock.js';
import { handleHelpdeskMock, HELPDESK_PREFIX } from './helpdesk-mock.js';

type Env = ProxyEnv & DecideEnv;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith(PROXY_PREFIX)) {
      return handleProxy(request, env);
    }
    if (pathname === '/decide') {
      return handleDecide(request, env);
    }
    if (pathname === TAROT_PREFIX || pathname.startsWith(`${TAROT_PREFIX}/`)) {
      return handleTarotMock(request);
    }
    if (pathname === HELPDESK_PREFIX || pathname.startsWith(`${HELPDESK_PREFIX}/`)) {
      return handleHelpdeskMock(request);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
