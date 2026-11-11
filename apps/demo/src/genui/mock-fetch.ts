import type { GenUiScenario } from './scenarios/index.js';

export interface SentCall {
  url: string;
  body: Record<string, unknown>;
}

/**
 * Stands in for the apps' APIs. Answers the confirm call from the scenario, after a short delay;
 * every call is reported to `onSend` so the page can show exactly what would have gone out.
 */
export function createMockFetch(scenario: GenUiScenario, onSend: (call: SentCall) => void) {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    onSend({ url, body });
    await new Promise((resolve) => setTimeout(resolve, 500));
    return new Response(JSON.stringify(scenario.respond(body)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
