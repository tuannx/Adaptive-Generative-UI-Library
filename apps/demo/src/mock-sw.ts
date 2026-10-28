/**
 * Service worker for the static (GitHub Pages) demo: answers the sample APIs' /mock/* requests in the browser
 * with the same handlers the Cloudflare Worker uses, so sign-in, CRUD and the streamed chat work without a server.
 * State lives in this worker and resets when the browser stops it.
 */
import { handleTarotMock, TAROT_PREFIX } from '../worker/tarot-mock.js';
import { handleHelpdeskMock, HELPDESK_PREFIX } from '../worker/helpdesk-mock.js';

interface FetchEventLike extends Event {
  request: Request;
  respondWith(response: Promise<Response>): void;
}
interface ExtendableEventLike extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface ServiceWorkerScope {
  location: Location;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEventLike) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEventLike) => void): void;
}

const worker = self as unknown as ServiceWorkerScope;

worker.addEventListener('install', () => void worker.skipWaiting());
worker.addEventListener('activate', (event) => event.waitUntil(worker.clients.claim()));
worker.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== worker.location.origin) return;
  if (url.pathname.includes(`${HELPDESK_PREFIX}/`)) event.respondWith(handleHelpdeskMock(event.request));
  else if (url.pathname.includes(`${TAROT_PREFIX}/`) || url.pathname.endsWith(TAROT_PREFIX)) event.respondWith(handleTarotMock(event.request));
  else if (event.request.mode === 'navigate') event.respondWith(withAppFallback(event.request));
});

/** Deep links (`/demo/tickets/T-1`) have no file on a static host: serve the app shell instead of a 404. */
async function withAppFallback(request: Request): Promise<Response> {
  const response = await fetch(request);
  if (response.status !== 404) return response;
  const shell = await fetch(new URL('./', worker.location.href));
  return shell.ok ? shell : response;
}
