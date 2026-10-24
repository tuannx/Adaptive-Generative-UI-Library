import React from 'react';
import { Alert, Avatar, Button, Card, Collapse, Empty, Form, Input, Space, Typography } from 'antd';
import { RobotOutlined, SendOutlined, StopOutlined, UserOutlined, ClearOutlined } from '@ant-design/icons';
import { buildApiUrl, type OperationPage, type SchemaObject } from '@agul/core';
import { useAgulPlugins } from '../plugins/PluginContext.js';
import { readPath, readStream, extractChunkText } from '../http/stream.js';
import { useAgulRuntime } from '../runtime.js';
import { renderSchemaFields, schemaDefaults } from './FormView.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

function settingsSchema(page: OperationPage): SchemaObject | undefined {
  const chat = page.chat!;
  const reserved = new Set([chat.messageField, chat.historyField, chat.sessionField].filter(Boolean));
  const entries = Object.entries(page.body?.properties ?? {}).filter(([key]) => !reserved.has(key));
  if (entries.length === 0) return undefined;
  return {
    type: 'object',
    properties: Object.fromEntries(entries),
    required: (page.body?.required ?? []).filter((key) => !reserved.has(key)),
  };
}

function replyText(payload: unknown, replyPath: string | undefined): string {
  if (typeof payload === 'string') return payload;
  if (replyPath) {
    const value = readPath(payload, replyPath.split('.'));
    if (typeof value === 'string') return value;
  }
  return extractChunkText(payload) ?? JSON.stringify(payload, null, 2);
}

/** Conversation UI over a message-in / reply-out endpoint; streams SSE / NDJSON / text replies as they arrive. */
export function ChatView({ page }: { page: OperationPage }) {
  const chat = page.chat!;
  const { baseUrl, schemas, fetch: agulFetch } = useAgulRuntime();
  const plugins = useAgulPlugins();
  const [settings] = Form.useForm();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sessionRef = React.useRef<string | undefined>(undefined);
  const abortRef = React.useRef<AbortController | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const extra = React.useMemo(() => settingsSchema(page), [page]);

  React.useEffect(() => () => abortRef.current?.abort(), []);
  React.useEffect(() => bottomRef.current?.scrollIntoView?.({ block: 'end' }), [messages]);

  const appendToLast = (text: string) =>
    setMessages((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      next[next.length - 1] = { ...last, content: last.content + text };
      return next;
    });

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    let extraValues: Record<string, unknown> = {};
    if (extra) {
      try {
        extraValues = await settings.validateFields();
      } catch {
        setError('Fill in the required settings first');
        return;
      }
    }

    const history = messages.filter((message) => !message.error).map(({ role, content }) => ({ role, content }));
    const body: Record<string, unknown> = { ...extraValues };
    if (chat.historyField && chat.historyField === chat.messageField) {
      // OpenAI-style: the whole conversation, new turn included, goes in one `messages` array
      body[chat.historyField] = [...history, { role: 'user', content: text }];
    } else {
      body[chat.messageField] = text;
      if (chat.historyField) body[chat.historyField] = history;
    }
    if (chat.sessionField && sessionRef.current && chat.sessionField in (page.body?.properties ?? {})) {
      body[chat.sessionField] = sessionRef.current;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setDraft('');
    setError(null);
    setSending(true);
    setMessages((current) => [...current, { role: 'user', content: text }, { role: 'assistant', content: '' }]);

    const rememberSession = (payload: unknown) => {
      if (!chat.sessionField || !payload || typeof payload !== 'object') return;
      const value = (payload as Record<string, unknown>)[chat.sessionField];
      if (typeof value === 'string' || typeof value === 'number') sessionRef.current = String(value);
    };

    try {
      const response = await agulFetch(buildApiUrl(baseUrl, page.apiEndpoint), {
        method: page.method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          Accept: page.stream === 'sse' ? 'text/event-stream' : 'application/json, text/plain, */*',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${(await response.text()).slice(0, 300)}`);

      const type = response.headers.get('content-type') ?? '';
      const format = type.includes('event-stream') ? 'sse' : type.includes('ndjson') ? 'ndjson' : type.startsWith('text/') ? 'text' : page.stream;
      if (format !== 'none') {
        await readStream(response, format, { onText: appendToLast, onChunk: rememberSession });
      } else {
        const payload = await response.json().catch(() => undefined);
        rememberSession(payload);
        appendToLast(replyText(payload, chat.replyPath));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const reason = err instanceof Error ? err.message : String(err);
      setMessages((current) => {
        const next = [...current];
        next[next.length - 1] = { role: 'assistant', content: reason, error: true };
        return next;
      });
    } finally {
      if (abortRef.current === controller) setSending(false);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    sessionRef.current = undefined;
    setMessages([]);
    setSending(false);
  };

  return (
    <Card
      data-testid="agul-chat-view"
      title={page.label}
      extra={
        <Button size="small" icon={<ClearOutlined />} onClick={reset} disabled={messages.length === 0}>
          New conversation
        </Button>
      }
      styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12 } }}
    >
      {extra && (
        <Collapse
          size="small"
          items={[
            {
              key: 'settings',
              label: 'Settings',
              forceRender: true,
              children: (
                <Form form={settings} layout="vertical" initialValues={schemaDefaults(extra)} data-testid="agul-chat-settings">
                  {renderSchemaFields(extra, { schemas, plugins })}
                </Form>
              ),
            },
          ]}
        />
      )}

      <div
        data-testid="agul-chat-messages"
        style={{ minHeight: 280, maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: 4 }}
      >
        {messages.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={page.summary ?? 'Start the conversation'} />
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              data-testid={`agul-chat-message-${message.role}`}
              style={{ display: 'flex', gap: 8, flexDirection: message.role === 'user' ? 'row-reverse' : 'row' }}
            >
              <Avatar size="small" icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />} />
              <div
                style={{
                  maxWidth: '75%',
                  padding: '8px 12px',
                  borderRadius: 12,
                  whiteSpace: 'pre-wrap',
                  background: message.error ? '#fff2f0' : message.role === 'user' ? '#e6f4ff' : '#f5f5f5',
                }}
              >
                {message.content || (sending && index === messages.length - 1 ? <Typography.Text type="secondary">…</Typography.Text> : null)}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && <Alert type="warning" showIcon message={error} closable onClose={() => setError(null)} />}

      <Space.Compact style={{ width: '100%' }}>
        <Input.TextArea
          value={draft}
          data-testid="agul-chat-input"
          placeholder="Type a message — Enter to send, Shift+Enter for a new line"
          autoSize={{ minRows: 1, maxRows: 6 }}
          onChange={(event) => setDraft(event.target.value)}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        {sending ? (
          <Button icon={<StopOutlined />} onClick={() => abortRef.current?.abort()} style={{ height: 'auto' }}>
            Stop
          </Button>
        ) : (
          <Button type="primary" icon={<SendOutlined />} onClick={() => void send()} data-testid="agul-chat-send" style={{ height: 'auto' }}>
            Send
          </Button>
        )}
      </Space.Compact>
    </Card>
  );
}
