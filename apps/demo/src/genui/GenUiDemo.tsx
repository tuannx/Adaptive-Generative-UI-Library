import { useCallback, useState } from 'react';
import { Alert, Collapse, ConfigProvider, Segmented, Typography } from 'antd';
import { scenarios } from './scenarios/index.js';
import { AgentUi } from './AgentUi.js';
import { TextAnswer } from './TextAnswer.js';
import { JsonBlock } from './JsonBlock.js';
import type { SentCall } from './mock-fetch.js';
import './genui.css';

/** The same request answered in text and as an AGUL view, with the agent's message underneath. */
export function GenUiDemo() {
  const [scenarioId, setScenarioId] = useState(scenarios[0]!.id);
  const [sent, setSent] = useState<SentCall | null>(null);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0]!;
  const onSend = useCallback((call: SentCall) => setSent(call), []);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#4f46e5', borderRadius: 10 } }}>
      <main className="genui">
        <header className="genui-header">
          <Typography.Title level={2}>Agents that answer with a screen</Typography.Title>
          <Typography.Paragraph type="secondary">
            The agent describes what to show. AGUL draws it with the components your app registers.
          </Typography.Paragraph>
          <Segmented
            data-testid="genui-scenarios"
            value={scenarioId}
            onChange={(value) => {
              setScenarioId(String(value));
              setSent(null);
            }}
            options={scenarios.map((item) => ({ value: item.id, label: item.prompt }))}
          />
        </header>

        <div className="genui-user" data-testid="genui-prompt">{scenario.prompt}</div>

        <section className="genui-columns">
          <TextAnswer text={scenario.textAnswer} />
          <div className="genui-panel" data-testid="genui-agul-answer">
            <Typography.Text strong className="genui-panel__label">Agent + AGUL</Typography.Text>
            <AgentUi scenario={scenario} onSend={onSend} />
          </div>
        </section>

        <Alert
          className="genui-note"
          type="info"
          showIcon
          title="Demo only: every app here is mocked and nothing leaves this page. No LLM is called; the agent's message is fixed."
        />

        <Collapse
          className="genui-details"
          items={[
            { key: 'spec', label: 'What the agent sent (OpenAPI + x-agul-* hints)', children: <JsonBlock value={scenario.spec} /> },
            {
              key: 'sent',
              label: 'What would go out on confirm',
              children: sent ? <JsonBlock value={sent} /> : <Typography.Text type="secondary">Nothing yet. Press the confirm button.</Typography.Text>,
            },
          ]}
        />
      </main>
    </ConfigProvider>
  );
}
