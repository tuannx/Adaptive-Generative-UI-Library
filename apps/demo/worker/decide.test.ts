import { describe, it, expect, vi } from 'vite-plus/test';
import type Anthropic from '@anthropic-ai/sdk';
import tarot from '../public/examples/tarot-chat.json' with { type: 'json' };
import { heuristicDecisions, parseOpenAPISync, summarizeOperations } from '@ai-kit/agul-core';
import { handleDecide } from './decide.js';
import { handleTarotMock } from './tarot-mock.js';

function fakeClient(reply: { stop_reason?: string; text?: string }) {
  const create = vi.fn(async (_params: Record<string, unknown>) => ({
    stop_reason: reply.stop_reason ?? 'end_turn',
    content: reply.text === undefined ? [] : [{ type: 'text', text: reply.text }],
  }));
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

function memoryCache() {
  const store = new Map<string, Response>();
  return {
    match: async (request: Request) => store.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => void store.set(request.url, response.clone()),
  } as unknown as Cache;
}

function decideRequest(origin?: string) {
  const api = parseOpenAPISync(structuredClone(tarot));
  const operations = summarizeOperations(api, heuristicDecisions(api));
  return new Request('https://demo.dev/decide', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    body: JSON.stringify({ title: api.title, version: api.version, operations }),
  });
}

const decisionText = JSON.stringify({
  decisions: [
    { operationId: 'health', kind: 'hidden', label: '', group: '', messageField: '', historyField: '', sessionField: '', replyPath: '' },
  ],
});

describe('POST /decide', () => {
  it('asks Claude with structured output and fallbacks, then caches the answer', async () => {
    const { client, create } = fakeClient({ text: decisionText });
    const cache = memoryCache();
    const env = { AGUL_LLM_MODEL: 'claude-opus-5-5' };

    const first = await handleDecide(decideRequest(), env, { client, cache });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ decisions: [{ operationId: 'health', kind: 'hidden' }], model: 'claude-opus-5-5' });

    const params = create.mock.calls[0][0] as Record<string, any>;
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    });
    expect(params.messages[0].content).toContain('chatWithReader');

    const second = await handleDecide(decideRequest(), env, { client, cache });
    expect(second.headers.get('x-agul-decide-cache')).toBe('hit');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('reports refusals and missing configuration instead of guessing', async () => {
    const refused = await handleDecide(decideRequest(), {}, { client: fakeClient({ stop_reason: 'refusal' }).client, cache: memoryCache() });
    expect(refused.status).toBe(502);
    expect(await refused.json()).toEqual({ error: 'The model declined to classify this API' });

    const unconfigured = await handleDecide(decideRequest(), {});
    expect(unconfigured.status).toBe(501);
  });

  it('rejects cross-origin browser calls unless allowed', async () => {
    const { client } = fakeClient({ text: decisionText });
    expect((await handleDecide(decideRequest('https://evil.example'), {}, { client, cache: memoryCache() })).status).toBe(403);
    const allowed = await handleDecide(decideRequest('https://admin.example'), { DECIDE_ALLOWED_ORIGINS: 'https://admin.example' }, { client, cache: memoryCache() });
    expect(allowed.status).toBe(200);
  });
});

describe('tarot mock API', () => {
  it('streams a chat reply as SSE with a session id', async () => {
    const response = await handleTarotMock(
      new Request('https://demo.dev/mock/tarot/chat', { method: 'POST', body: JSON.stringify({ message: 'Will I find love?' }) }),
    );
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    const text = await response.text();
    expect(text).toMatch(/^data: \{"session_id":"s\d+"\}/);
    const reply = [...text.matchAll(/^data: (\{"delta".*\})$/gm)].map((match) => JSON.parse(match[1]).delta).join('');
    expect(reply).toContain('Will I find love?');
    expect(text.trimEnd().endsWith('data: [DONE]')).toBe(true);
  });

  it('draws a reading that then appears in the readings list', async () => {
    const drawn = await handleTarotMock(
      new Request('https://demo.dev/mock/tarot/readings/draw', { method: 'POST', body: JSON.stringify({ question: 'Career?', spread: 'three-card' }) }),
    );
    const reading = await drawn.json();
    expect(reading.cards.map((card: { position: string }) => card.position)).toEqual(['Past', 'Present', 'Future']);

    const list = await (await handleTarotMock(new Request('https://demo.dev/mock/tarot/readings'))).json();
    expect(list.readings[0].id).toBe(reading.id);
  });
});
