import type { DecisionContext, OperationSummary, ProposedDecision, UiDecisionProvider } from './decisions.js';

/** JSON Schema for a decision response — usable as an LLM structured-output schema. */
export const DECISION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decisions'],
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['operationId', 'kind', 'label', 'group', 'messageField', 'historyField', 'sessionField', 'replyPath'],
        properties: {
          operationId: { type: 'string' },
          kind: { type: 'string', enum: ['crud', 'action', 'chat', 'hidden'] },
          label: { type: 'string', description: 'Short menu label in the API’s language; empty to keep the default.' },
          group: { type: 'string', description: 'Menu group; empty to keep the operation tag.' },
          messageField: { type: 'string', description: 'chat only: body field carrying the user message; else empty.' },
          historyField: { type: 'string', description: 'chat only: body field taking prior turns; else empty.' },
          sessionField: { type: 'string', description: 'chat only: field keeping a conversation id; else empty.' },
          replyPath: { type: 'string', description: 'chat only: dot path to reply text in a JSON response; else empty.' },
        },
      },
    },
  },
} as const;

export const DECISION_SYSTEM_PROMPT = `You decide how an auto-generated admin UI presents each operation of a REST API.

Kinds:
- crud: part of a resource's list / detail / create / edit / delete pages. Keep "crud" when current.kind is "crud" unless the operation is clearly not record management.
- chat: a conversation with an assistant, bot or AI (the user sends a message and reads a reply, often streamed). Set messageField to the body field holding the user's message, and historyField / sessionField / replyPath when the operation has them.
- action: any other operation a person runs by filling a form and reading the result (search, compute, generate, draw, trigger, login, export...).
- hidden: internal, deprecated, health/metrics, webhook receivers, or anything an operator should not click.

Return one decision per operation whose presentation or label you would change; omit operations where current is already right. Labels are short (2-4 words) and in the language of the API's summaries. Only use field names that appear in the operation summary.`;

export function buildDecisionPrompt(operations: OperationSummary[], context: Pick<DecisionContext, 'title' | 'version'>): string {
  return [
    `API: ${context.title}${context.version ? ` v${context.version}` : ''}`,
    'Operations (JSON):',
    JSON.stringify(operations),
  ].join('\n');
}

/** Accepts `{ decisions: [...] }` or a bare array, with chat fields flat or nested under `chat`. */
export function parseDecisionResponse(payload: unknown): ProposedDecision[] {
  const value = typeof payload === 'string' ? JSON.parse(extractJson(payload)) : payload;
  const list = Array.isArray(value) ? value : (value as { decisions?: unknown })?.decisions;
  if (!Array.isArray(list)) throw new Error('Decision response has no "decisions" array');

  return list
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const nested = (item.chat ?? {}) as Record<string, unknown>;
      const pick = (key: string) => {
        const raw = nested[key] ?? item[key];
        return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
      };
      return {
        operationId: String(item.operationId ?? ''),
        kind: item.kind as ProposedDecision['kind'],
        label: typeof item.label === 'string' ? item.label : undefined,
        group: typeof item.group === 'string' ? item.group : undefined,
        chat: {
          messageField: pick('messageField'),
          historyField: pick('historyField'),
          sessionField: pick('sessionField'),
          replyPath: pick('replyPath'),
        },
      };
    });
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

export interface HttpDecisionProviderOptions {
  /** Endpoint receiving `POST { title, version, operations }` and returning `{ decisions }`. */
  url: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** Delegates decisions to an HTTP API — your own service, or the AGUL Worker's `/decide` route. */
export function createHttpDecisionProvider(options: HttpDecisionProviderOptions): UiDecisionProvider {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  return {
    id: `decision API ${options.url}`,
    async decide(operations, context) {
      const timeout = AbortSignal.timeout(options.timeoutMs ?? 60_000);
      const signal = context.signal ? AbortSignal.any([context.signal, timeout]) : timeout;
      const response = await doFetch(options.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...options.headers },
        body: JSON.stringify({ title: context.title, version: context.version, operations }),
        signal,
      });
      if (!response.ok) throw new Error(`Decision API responded ${response.status}`);
      return parseDecisionResponse(await response.json());
    },
  };
}

export interface LlmCompletionRequest {
  system: string;
  prompt: string;
  /** JSON Schema the answer must match (pass it as the model's structured-output format). */
  schema: typeof DECISION_JSON_SCHEMA;
  signal?: AbortSignal;
}

export interface LlmDecisionProviderOptions {
  /** Calls your LLM and returns its text (JSON matching `schema`). Run it server-side: it holds your API key. */
  complete: (request: LlmCompletionRequest) => Promise<string>;
  /** Operations per request; large specs are split into batches. */
  batchSize?: number;
  id?: string;
}

/** Asks any LLM, through the `complete` callback you supply, how to present each operation. */
export function createLlmDecisionProvider(options: LlmDecisionProviderOptions): UiDecisionProvider {
  const batchSize = options.batchSize ?? 150;
  return {
    id: options.id ?? 'llm',
    async decide(operations, context) {
      const batches: OperationSummary[][] = [];
      for (let i = 0; i < operations.length; i += batchSize) batches.push(operations.slice(i, i + batchSize));

      const results = await Promise.all(
        batches.map(async (batch) =>
          parseDecisionResponse(
            await options.complete({
              system: DECISION_SYSTEM_PROMPT,
              prompt: buildDecisionPrompt(batch, context),
              schema: DECISION_JSON_SCHEMA,
              signal: context.signal,
            }),
          ),
        ),
      );
      return results.flat();
    },
  };
}

/** FNV-1a hash, stable across runtimes; used for decision cache keys. */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export interface DecisionCacheStore {
  get(key: string): string | null | undefined;
  set(key: string, value: string): void;
}

/** Caches a provider's answer per (provider, operation set), e.g. in `localStorage`. Store errors are ignored. */
export function withDecisionCache(provider: UiDecisionProvider, store: DecisionCacheStore, prefix = 'agul:decisions:'): UiDecisionProvider {
  return {
    id: provider.id,
    async decide(operations, context) {
      const key = `${prefix}${hashText(`${provider.id}\n${JSON.stringify(operations)}`)}`;
      try {
        const cached = store.get(key);
        if (cached) return parseDecisionResponse(cached);
      } catch {
        // unreadable cache entry: ask the provider again
      }
      const decisions = await provider.decide(operations, context);
      try {
        store.set(key, JSON.stringify({ decisions }));
      } catch {
        // storage full or unavailable
      }
      return decisions;
    },
  };
}
