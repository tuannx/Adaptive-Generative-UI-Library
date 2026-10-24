# UI decisions: CRUD, actions, chat — and who decides

AGUL presents **every** operation of a spec. Each one gets a kind:

| Kind | Page | Typical endpoints |
|---|---|---|
| `crud` | list / detail / create / edit / delete of a resource | `GET /readings`, `GET /readings/{id}`, `PATCH /personas/{id}` |
| `action` | a form (params + body) and the result: table, record, text, or a **live stream** | `POST /readings/draw`, `POST /admin/cache/flush`, `GET /user/login` |
| `chat` | a conversation UI: history, streaming replies, session id, extra settings | `POST /chat` (SSE), `POST /ai/ask`, OpenAI-style `messages[]` |
| `hidden` | nothing | health checks, webhooks, deprecated operations |

## Three layers, highest priority first

```
x-agul-view in the spec  >  decision provider (LLM / your decision API)  >  built-in rules
```

1. **Spec** — `x-agul-view: crud | action | chat | hidden` on an operation, plus optional
   `x-agul-chat: { messageField, historyField, sessionField, replyPath }`. Never overridden.
2. **Decision provider** — anything implementing `UiDecisionProvider`. It receives a compact summary of
   every operation (fields, content types, whether the response streams, and what the rules decided) and
   returns decisions for the operations it wants to change. Invalid answers (unknown operation or kind, a
   chat `messageField` the body doesn't have) are dropped, never trusted.
3. **Rules** (always available, synchronous):
   - chat: a JSON POST with a message field (`message`, `prompt`, `question`, … or `messages: [{role, content}]`),
     a chat-like name, and something to read back (a stream, a reply field, or `choices`);
   - CRUD: the resource model (`buildResources`); a POST with nothing else on its path counts as "create" only
     if it answers with the record it was sent, otherwise it is an action;
   - everything else: action (deprecated operations: hidden).

The UI renders the rule-based layout immediately and switches when the provider answers. If the provider
fails, the rule-based layout stays and the header shows "Default layout" with the reason.

Streaming responses (`text/event-stream`, `application/x-ndjson`, `text/plain`) are read incrementally;
chunks in OpenAI (`choices[0].delta.content`), Anthropic (`delta.text`) and plain `{ delta | text | token }`
shapes are understood. `x-agul-stream: sse | ndjson | text` forces a format.

## Configuring a provider

```tsx
import { AGULRenderer, createHttpDecisionProvider } from '@agul/react';

// Your own decision API, or the AGUL Worker's /decide route (below)
<AGULRenderer specUrl="/openapi.json" decisionProvider={createHttpDecisionProvider({ url: '/decide' })} />
```

Any LLM can be plugged in server-side with `createLlmDecisionProvider({ complete })` from `@agul/core`:
`complete` receives `{ system, prompt, schema }` (the schema is `DECISION_JSON_SCHEMA`, ready to use as a
structured-output format) and returns the model's JSON text. Keep API keys on the server — never pass an LLM
key to the browser.

Decisions are cached in `localStorage` per (provider, operation set); pass `cacheDecisions={false}` to disable.

### The Cloudflare Worker's `/decide` route (Claude)

`apps/demo/worker/decide.ts` implements the decision API with the Anthropic SDK: structured output against
`DECISION_JSON_SCHEMA`, `effort: "low"` (it is a classification task), server-side `fallbacks: "default"` for
safety-classifier refusals, answers cached per spec in the Workers cache (one model call per spec), browser
calls limited to the Worker's own origin (`DECIDE_ALLOWED_ORIGINS` to add more), and request size caps.

```bash
cd apps/demo
npx wrangler secret put ANTHROPIC_API_KEY     # required
# optional: AGUL_LLM_MODEL in wrangler.jsonc (default claude-opus-5-5)
npm run deploy
```

Without the secret `/decide` answers 501 and the demo keeps the rule-based layout.

### Agents (MCP)

The agent calling `generate_ui_from_openapi` is itself an LLM, so it can be the decision provider:
call with `includeOperationSummaries: true` to get the summaries, `DECISION_SYSTEM_PROMPT` and the schema,
then call again with `decisions: [...]`. The response lists `pages`, `decisions` (with their source) and an
embed snippet that carries the decisions.

## Try it

The demo ships a sample **Tarot Chat API** (`apps/demo/public/examples/tarot-chat.json`) with a mock backend in
the Worker (`/mock/tarot/*`): cards and personas (CRUD), readings (list/detail/delete), "Draw a reading"
(action), a streaming reader chat, an ops group. Click **Tarot Chat** in the demo toolbar.

## Limits

- A chat page sends one request per turn; WebSockets and bidirectional streams are out of scope.
- File inputs in action forms are plain text fields unless a field plugin handles them.
- Provider decisions only choose among the four kinds, labels and groups; they don't design new widgets.
