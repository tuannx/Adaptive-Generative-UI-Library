/**
 * `POST /decide` — the AGUL decision API backed by Claude. Receives `{ title, version, operations }`
 * (what `createHttpDecisionProvider` sends) and returns `{ decisions }`.
 *
 * The API key stays here (Worker secret ANTHROPIC_API_KEY); the browser only sees decisions.
 * Answers are cached per operation set in the Workers cache, so a spec costs one model call.
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  DECISION_JSON_SCHEMA,
  createLlmDecisionProvider,
  hashText,
  type OperationSummary,
} from '@ai-kit/agul-core';

export interface DecideEnv {
  ANTHROPIC_API_KEY?: string;
  /** Model for layout decisions; defaults to claude-opus-5-5. */
  AGUL_LLM_MODEL?: string;
  /** Comma-separated origins allowed to call /decide from a browser; defaults to this Worker's own origin. */
  DECIDE_ALLOWED_ORIGINS?: string;
}

const MAX_BODY_BYTES = 1_500_000;
const MAX_OPERATIONS = 600;
const DEFAULT_MODEL = 'claude-opus-5-5';

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function originAllowed(request: Request, env: DecideEnv): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = (env.DECIDE_ALLOWED_ORIGINS ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);
  return origin === new URL(request.url).origin || allowed.includes(origin);
}

/** Calls Claude with the AGUL decision prompt and returns its JSON text. */
export function claudeCompletion(client: Anthropic, model: string) {
  return async ({ system, prompt, schema, signal }: { system: string; prompt: string; schema: typeof DECISION_JSON_SCHEMA; signal?: AbortSignal }) => {
    const response = await client.beta.messages.create(
      {
        model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: schema as unknown as Record<string, unknown> },
        },
        system,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal },
    );

    if (response.stop_reason === 'refusal') throw new Error('The model declined to classify this API');
    if (response.stop_reason === 'max_tokens') throw new Error('Decision output was truncated');
    const text = response.content.find((block) => block.type === 'text');
    if (!text || text.type !== 'text') throw new Error('The model returned no decisions');
    return text.text;
  };
}

export async function handleDecide(
  request: Request,
  env: DecideEnv,
  deps: { client?: Anthropic; cache?: Cache } = {},
): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'POST only' }, { allow: 'POST' });
  if (!originAllowed(request, env)) return json(403, { error: 'Origin not allowed' });
  if (!env.ANTHROPIC_API_KEY && !deps.client) {
    return json(501, { error: 'Set the ANTHROPIC_API_KEY secret on this Worker to enable AI layout decisions' });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'Spec summary too large' });

  let payload: { title?: string; version?: string; operations?: OperationSummary[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: 'Body must be JSON' });
  }
  const operations = Array.isArray(payload.operations) ? payload.operations.slice(0, MAX_OPERATIONS) : [];
  if (operations.length === 0) return json(400, { error: 'No operations' });

  const model = env.AGUL_LLM_MODEL || DEFAULT_MODEL;
  const cache = deps.cache ?? (typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : undefined);
  const cacheKey = new Request(`https://agul-decide.cache/${model}/${hashText(raw)}`);
  const hit = await cache?.match(cacheKey);
  if (hit) return new Response(hit.body, { headers: { 'content-type': 'application/json', 'x-agul-decide-cache': 'hit' } });

  const client = deps.client ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const provider = createLlmDecisionProvider({ id: `claude:${model}`, complete: claudeCompletion(client, model) });

  try {
    const decisions = await provider.decide(operations, {
      title: String(payload.title ?? 'API'),
      version: payload.version ? String(payload.version) : undefined,
      signal: request.signal,
    });
    const response = json(200, { decisions, model }, { 'cache-control': 'public, max-age=86400', 'x-agul-decide-cache': 'miss' });
    await cache?.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json(429, { error: 'Model rate limited, retry later' });
    if (error instanceof Anthropic.APIError) return json(502, { error: `Model API error ${error.status}` });
    return json(502, { error: error instanceof Error ? error.message : String(error) });
  }
}
