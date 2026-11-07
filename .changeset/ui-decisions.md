---
"@aikitstudio/agul-core": minor
"@aikitstudio/agul-react": minor
"@aikitstudio/agul-mcp": minor
---

Every operation now gets a page: CRUD, **action** (form → result or live stream) or **chat** (conversation UI with SSE/NDJSON streaming), or is hidden.

- core: `planUi`, `heuristicDecisions`, `resolveDecisions`, `mergeDecisions`, `summarizeOperations`, `UiDecisionProvider`; providers `createHttpDecisionProvider`, `createLlmDecisionProvider`, `withDecisionCache`; `DECISION_JSON_SCHEMA` / `DECISION_SYSTEM_PROMPT`; `x-agul-view` / `x-agul-chat` / `x-agul-stream` spec extensions. Chat detection (incl. OpenAI-style `messages[]`), POSTs that don't return the record they create become actions, undocumented standalone GETs (`/user/logout`) become actions instead of list pages. `generateRoutes` follows the plan and includes action/chat routes.
- react: `ActionView`, `ChatView`, `ResultView`, `readStream`; `AGULRenderer` props `decisionProvider`, `cacheDecisions`, `onDecisions`; header shows layout source; menu opens the current page's group; schema `default`s prefill forms; lists refetch after an action.
- mcp: `includeOperationSummaries` and `decisions` inputs; output adds `pages`, `decisions`, `decisionInput`.
