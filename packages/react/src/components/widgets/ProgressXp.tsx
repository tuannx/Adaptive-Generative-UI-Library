import { Progress, Typography } from 'antd';
import { readXp, type SchemaObject } from '@agul/core';

interface ProgressXpProps {
  schema: SchemaObject;
  /** Injected by `Form.Item`: progress 0 to 100. */
  value?: unknown;
}

/** A progress bar with the level reached and the next one (`x-agul-levels`). Display only. */
export function ProgressXp({ schema, value }: ProgressXpProps) {
  const xp = readXp(schema, value);
  if (!xp) return null;

  return (
    <div data-testid="agul-xp">
      <Progress percent={xp.percent} status={xp.percent >= 100 ? 'success' : 'active'} />
      {(xp.level || xp.next) && (
        <Typography.Text type="secondary">
          {xp.level?.label}
          {xp.next && ` → ${xp.next.label} (${xp.next.at}%)`}
        </Typography.Text>
      )}
    </div>
  );
}
