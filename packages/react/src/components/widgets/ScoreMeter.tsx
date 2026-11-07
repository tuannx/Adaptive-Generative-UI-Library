import { Progress, Tag } from 'antd';
import { readScore, type AgulScoreBand, type SchemaObject } from '@ai-kit/agul-core';

const TAG_COLOR: Record<NonNullable<AgulScoreBand['tone']>, string> = {
  positive: 'success',
  neutral: 'processing',
  attention: 'warning',
};

interface ScoreMeterProps {
  schema: SchemaObject;
  /** Injected by `Form.Item`. */
  value?: unknown;
}

/** A score dial with the band it falls in (`x-agul-bands`). Display only. */
export function ScoreMeter({ schema, value }: ScoreMeterProps) {
  const score = readScore(schema, value);
  if (!score) return <span data-testid="agul-score-empty">-</span>;

  return (
    <div data-testid="agul-score" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Progress type="dashboard" percent={score.percent} format={() => score.value} size={96} />
      {score.band && <Tag color={score.band.tone ? TAG_COLOR[score.band.tone] : 'default'}>{score.band.label}</Tag>}
    </div>
  );
}
