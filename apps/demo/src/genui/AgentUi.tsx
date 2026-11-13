import { useMemo } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  ActionView,
  AgulRuntimeProvider,
  PluginProvider,
  agulHttp,
  choiceCardsPlugin,
  parseOpenAPISync,
  planUi,
  type AgulRuntime,
} from '@aikitstudio/agul-react';
import type { GenUiScenario } from './scenarios/index.js';
import { appStepPlugin, textareaPlugin } from './app-step-plugin.js';
import { createMockFetch, type SentCall } from './mock-fetch.js';
import { ResultReply } from './ResultReply.js';

const renderReply = (value: unknown) => <ResultReply value={value} />;

/** Components this host registers. The agent's message can only use these (plus AGUL's own fields). */
const HOST_COMPONENTS = [appStepPlugin, textareaPlugin, choiceCardsPlugin];

/** AGUL turns the agent's message (an OpenAPI action) into a page, then draws it with the host's components. */
export function AgentUi({ scenario, onSend }: { scenario: GenUiScenario; onSend: (call: SentCall) => void }) {
  const { page, runtime } = useMemo(() => {
    const api = parseOpenAPISync(structuredClone(scenario.spec));
    const plan = planUi(api);
    const runtime: AgulRuntime = {
      baseUrl: 'https://apps.example',
      schemas: api.schemas,
      http: agulHttp,
      routeBase: '',
      fetch: createMockFetch(scenario, onSend),
    };
    return { page: plan.pages[0], runtime };
  }, [scenario, onSend]);

  if (!page) return null;
  return (
    <MemoryRouter>
      <AgulRuntimeProvider value={runtime}>
        <PluginProvider plugins={HOST_COMPONENTS}>
          <ActionView key={scenario.id} page={page} appearance="chat" renderResult={renderReply} />
        </PluginProvider>
      </AgulRuntimeProvider>
    </MemoryRouter>
  );
}
