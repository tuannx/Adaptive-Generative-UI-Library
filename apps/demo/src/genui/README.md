# Generative UI demo: an agent that answers with a screen

`genui.html` shows one request answered two ways: as text, and as one AGUL view.

- **Sick day** (`scenarios/sick-day.ts`): "I'm sick today". Six apps in one view (video visit, meetings,
  team chat, out-of-office, school pickup, soup). Switch steps off, edit the rest, one **Confirm and send**.
- **Dinner** (`scenarios/dinner.ts`): "Move dinner with Priya to Friday". Free times, open tables and ride
  prices side by side as choice cards.

How it works:

1. The agent's message is a small OpenAPI document: one `x-agul-view: action` operation whose request body
   holds the agent's proposal as `default` values, and `x-agul-submit` names the button.
2. AGUL plans it (`planUi`) and draws it with `ActionView`.
3. Fields marked `x-agul-widget: app-step` are drawn by a component the host registers (`app-step-plugin.tsx`).
   The agent can only place components the host registered; everything else falls back to AGUL's own fields.
4. Nothing is sent until the user confirms. The confirm call goes to a mock (`mock-fetch.ts`).

Everything is mocked: no LLM is called and no app is contacted.

```bash
npm run build && npm run dev -w @aikitstudio/agul-demo   # then open /genui.html
node scripts/build-genui-preview.mjs                      # one self-contained HTML file
```
