import { describe, it, expect, vi } from 'vite-plus/test';
import tarot from '../../../apps/demo/public/examples/tarot-chat.json' with { type: 'json' };
import petstore from '../../../apps/demo/public/examples/petstore.json' with { type: 'json' };
import { parseOpenAPISync } from './parser.js';
import {
  heuristicDecisions,
  mergeDecisions,
  planUi,
  resolveDecisions,
  summarizeOperations,
  type UiDecisionProvider,
} from './decisions.js';
import {
  DECISION_JSON_SCHEMA,
  createHttpDecisionProvider,
  createLlmDecisionProvider,
  parseDecisionResponse,
  withDecisionCache,
} from './decision-providers.js';

const tarotApi = () => parseOpenAPISync(structuredClone(tarot));
const kindOf = (decisions: Map<string, { kind: string }>, id: string) => decisions.get(id)?.kind;

describe('heuristicDecisions (tarot chat backend)', () => {
  const decisions = heuristicDecisions(tarotApi());

  it('detects the streaming chat endpoint and its fields', () => {
    expect(decisions.get('chatWithReader')).toMatchObject({
      kind: 'chat',
      chat: { messageField: 'message', historyField: 'history', sessionField: 'session_id' },
    });
  });

  it('treats a POST that returns a different record as an action, not a create form', () => {
    expect(kindOf(decisions, 'drawReading')).toBe('action');
    expect(kindOf(decisions, 'flushInterpretationCache')).toBe('action');
  });

  it('keeps record management as CRUD', () => {
    for (const id of ['listReadings', 'getReading', 'deleteReading', 'listCards', 'createPersona', 'updatePersona']) {
      expect(kindOf(decisions, id)).toBe('crud');
    }
  });

  it('plans pages and a menu that includes chat and actions', () => {
    const plan = planUi(tarotApi());
    expect(plan.pages.map((page) => [page.operationId, page.kind, page.path, page.stream])).toEqual([
      ['chatWithReader', 'chat', '/_/chatWithReader', 'sse'],
      ['drawReading', 'action', '/_/drawReading', 'none'],
      ['flushInterpretationCache', 'action', '/_/flushInterpretationCache', 'none'],
    ]);
    expect(plan.resources.some((resource) => resource.key === '/readings/draw')).toBe(false);
    const keys = plan.menu.flatMap((group) => group.children?.map((item) => item.key) ?? []);
    expect(keys).toEqual(expect.arrayContaining(['/_/chatWithReader', '/_/drawReading', '/readings', '/personas']));
  });
});

describe('heuristicDecisions (Petstore)', () => {
  const decisions = heuristicDecisions(parseOpenAPISync(structuredClone(petstore)));

  it('does not turn schema-less GETs into list pages', () => {
    expect(kindOf(decisions, 'logoutUser')).toBe('action');
    expect(kindOf(decisions, 'loginUser')).toBe('action');
  });

  it('keeps create-only resources whose POST echoes the record', () => {
    expect(kindOf(decisions, 'placeOrder')).toBe('crud');
  });
});

describe('spec extensions', () => {
  it('x-agul-view wins over heuristics and providers', () => {
    const spec = structuredClone(tarot) as any;
    spec.paths['/cards'].get['x-agul-view'] = 'hidden';
    spec.paths['/readings/draw'].post['x-agul-view'] = 'chat';
    spec.paths['/readings/draw'].post['x-agul-chat'] = { messageField: 'question' };
    const api = parseOpenAPISync(spec);
    const base = heuristicDecisions(api);

    expect(base.get('listCards')).toMatchObject({ kind: 'hidden', source: 'spec' });
    expect(base.get('drawReading')).toMatchObject({ kind: 'chat', chat: { messageField: 'question' }, source: 'spec' });

    const merged = mergeDecisions(api, base, [{ operationId: 'listCards', kind: 'crud' }]);
    expect(merged.get('listCards')?.kind).toBe('hidden');
    expect(planUi(api, merged).menu.flatMap((g) => g.children ?? []).some((item) => item.key === '/cards')).toBe(false);
  });
});

describe('mergeDecisions', () => {
  const api = tarotApi();
  const base = heuristicDecisions(api);

  it('applies valid proposals and drops invalid ones', () => {
    const merged = mergeDecisions(api, base, [
      { operationId: 'health', kind: 'hidden' },
      { operationId: 'drawReading', kind: 'action', label: 'Rút bài' },
      { operationId: 'nope', kind: 'hidden' },
      { operationId: 'listCards', kind: 'bogus' as never },
      { operationId: 'flushInterpretationCache', kind: 'chat', chat: { messageField: 'missing' } },
    ]);

    expect(merged.get('health')).toMatchObject({ kind: 'hidden', source: 'provider' });
    expect(merged.get('drawReading')).toMatchObject({ kind: 'action', label: 'Rút bài' });
    expect(merged.get('listCards')?.kind).toBe('crud');
    expect(merged.get('flushInterpretationCache')?.kind).toBe('action');
  });

  it('lets a provider turn an action into chat when the message field exists', () => {
    const merged = mergeDecisions(api, base, [
      { operationId: 'drawReading', kind: 'chat', chat: { messageField: 'question', replyPath: 'summary' } },
    ]);
    expect(merged.get('drawReading')).toMatchObject({ kind: 'chat', chat: { messageField: 'question', replyPath: 'summary' } });
  });
});

describe('resolveDecisions', () => {
  it('skips a failing provider and keeps going', async () => {
    const onError = vi.fn();
    const failing: UiDecisionProvider = { id: 'down', decide: () => Promise.reject(new Error('503')) };
    const hider: UiDecisionProvider = { id: 'ok', decide: async () => [{ operationId: 'health', kind: 'hidden' }] };

    const decisions = await resolveDecisions(tarotApi(), [failing, hider], { onError });
    expect(onError).toHaveBeenCalledWith(failing, expect.any(Error));
    expect(decisions.get('health')?.kind).toBe('hidden');
    expect(decisions.get('chatWithReader')?.kind).toBe('chat');
  });

  it('gives providers a compact summary with the current decision', () => {
    const api = tarotApi();
    const chat = summarizeOperations(api, heuristicDecisions(api)).find((op) => op.operationId === 'chatWithReader')!;
    expect(chat.body?.fields.map((field) => field.name)).toEqual(['message', 'session_id', 'history', 'persona']);
    expect(chat.response).toMatchObject({ stream: 'sse', contentType: 'text/event-stream' });
    expect(chat.current.kind).toBe('chat');
  });
});

describe('decision providers', () => {
  it('LLM provider batches operations and parses fenced JSON', async () => {
    const complete = vi.fn(async ({ prompt, schema }: { prompt: string; schema: unknown }) => {
      expect(schema).toBe(DECISION_JSON_SCHEMA);
      const ids = [...prompt.matchAll(/"operationId":"([^"]+)"/g)].map((m) => m[1]);
      return '```json\n' + JSON.stringify({ decisions: ids.map((id) => ({ operationId: id, kind: 'hidden', label: '', group: '', messageField: '', historyField: '', sessionField: '', replyPath: '' })) }) + '\n```';
    });
    const api = tarotApi();
    const provider = createLlmDecisionProvider({ complete, batchSize: 5 });
    const result = await provider.decide(summarizeOperations(api, heuristicDecisions(api)), { title: api.title });

    expect(complete).toHaveBeenCalledTimes(Math.ceil(api.endpoints.length / 5));
    expect(result).toHaveLength(api.endpoints.length);
    expect(result[0].chat).toEqual({ messageField: undefined, historyField: undefined, sessionField: undefined, replyPath: undefined });
  });

  it('HTTP provider posts the summary and reads { decisions }', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.title).toBe('Tarot Chat API');
      return new Response(JSON.stringify({ decisions: [{ operationId: 'health', kind: 'hidden' }] }), { status: 200 });
    });
    const provider = createHttpDecisionProvider({ url: '/decide', fetch: fetchMock as unknown as typeof fetch });
    const api = tarotApi();
    expect(await provider.decide(summarizeOperations(api, heuristicDecisions(api)), { title: api.title })).toEqual([
      expect.objectContaining({ operationId: 'health', kind: 'hidden' }),
    ]);
  });

  it('cache answers repeated requests without calling the provider', async () => {
    const decide = vi.fn(async () => [{ operationId: 'health', kind: 'hidden' as const }]);
    const memory = new Map<string, string>();
    const cached = withDecisionCache({ id: 'x', decide }, { get: (k) => memory.get(k), set: (k, v) => memory.set(k, v) });
    const api = tarotApi();
    const ops = summarizeOperations(api, heuristicDecisions(api));

    await cached.decide(ops, { title: api.title });
    const second = await cached.decide(ops, { title: api.title });
    expect(decide).toHaveBeenCalledTimes(1);
    expect(second[0]).toMatchObject({ operationId: 'health', kind: 'hidden' });
  });

  it('rejects responses without decisions', () => {
    expect(() => parseDecisionResponse({ nope: true })).toThrow(/decisions/);
  });
});

describe('detectChatBinding edge cases (seen in real specs)', () => {
  const op = (path: string, body: object, response: object, extra: object = {}) => ({
    openapi: '3.0.0',
    info: { title: 'T', version: '1' },
    paths: {
      [path]: {
        post: {
          operationId: path.replace(/\W+/g, '_'),
          requestBody: { content: { 'application/json': { schema: body } } },
          responses: { '200': { description: 'OK', content: { 'application/json': { schema: response } } } },
          ...extra,
        },
      },
    },
  });
  const kindFor = (spec: object) => [...heuristicDecisions(parseOpenAPISync(spec)).values()][0];

  it('does not read "ask" inside "tasks"', () => {
    const spec = op('/tasks', { type: 'object', properties: { message: { type: 'string' } } }, { type: 'object', properties: { message: { type: 'string' } } });
    expect(kindFor(spec).kind).not.toBe('chat');
  });

  it('needs something to read back: a stream, a reply field or choices', () => {
    const noReply = op('/calls/messages', { type: 'object', properties: { content: { type: 'string' } } }, { type: 'object', properties: { sid: { type: 'string' } } });
    expect(kindFor(noReply).kind).toBe('action');

    const withAnswer = op('/ai/ask', { type: 'object', properties: { prompt: { type: 'string' } } }, { type: 'object', properties: { answer: { type: 'string' } } });
    expect(kindFor(withAnswer)).toMatchObject({ kind: 'chat', chat: { messageField: 'prompt', replyPath: 'answer' } });
  });

  it('understands OpenAI-style messages arrays, including oneOf items', () => {
    const userMessage = { type: 'object', properties: { role: { type: 'string' }, content: { type: 'string' } } };
    const spec = op(
      '/chat/completions',
      { type: 'object', properties: { model: { type: 'string' }, messages: { type: 'array', items: { oneOf: [userMessage] } } } },
      { type: 'object', properties: { choices: { type: 'array', items: { type: 'object' } } } },
    );
    expect(kindFor(spec)).toMatchObject({
      kind: 'chat',
      chat: { messageField: 'messages', historyField: 'messages', replyPath: 'choices.0.message.content' },
    });
  });

  it('ignores multipart uploads that happen to have a prompt field', () => {
    const spec = op('/audio/transcriptions', {}, {});
    (spec.paths['/audio/transcriptions'].post as any).requestBody = {
      content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, prompt: { type: 'string' } } } } },
    };
    (spec.paths['/audio/transcriptions'].post as any).responses = { '200': { description: 'OK', content: { 'text/event-stream': { schema: { type: 'string' } } } } };
    expect(kindFor(spec).kind).toBe('action');
  });
});
