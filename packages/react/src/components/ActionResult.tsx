import type { ReactNode } from 'react';
import { Alert, Divider, Typography } from 'antd';
import { ResultView } from './ResultView.js';

/**
 * How an action page looks. `tool` (default): an API console, with the method, path and HTTP status.
 * `chat`: a card inside a conversation; no transport details, and the form locks once it is done.
 */
export type ActionAppearance = 'tool' | 'chat';

export interface ActionOutcome {
  status: number;
  value: unknown;
}

interface ActionResultProps {
  appearance: ActionAppearance;
  running: boolean;
  streamed: string | null;
  error: string | null;
  result: ActionOutcome | null;
  renderResult?: (value: unknown) => ReactNode;
}

/** What came back from an action: a live stream, an error, or the result. */
export function ActionResult({ appearance, running, streamed, error, result, renderResult }: ActionResultProps) {
  if (!result && streamed === null && !error) return null;
  const chat = appearance === 'chat';
  return (
    <>
      {!chat && <Divider />}
      {error && (
        <Alert type="error" showIcon title={chat ? 'Something went wrong' : 'Request failed'} description={error} style={chat ? { marginTop: 16 } : undefined} />
      )}
      {streamed !== null && (
        <Typography.Paragraph data-testid="agul-action-stream" style={{ whiteSpace: 'pre-wrap', marginTop: chat ? 16 : undefined }}>
          {streamed}
          {running && <span className="agul-caret">▍</span>}
        </Typography.Paragraph>
      )}
      {result && (
        <div data-testid="agul-action-result" style={chat ? { marginTop: 16 } : undefined}>
          {!chat && <Typography.Text type="secondary">HTTP {result.status}</Typography.Text>}
          <div style={chat ? undefined : { marginTop: 8 }}>{renderResult ? renderResult(result.value) : <ResultView value={result.value} />}</div>
        </div>
      )}
    </>
  );
}
