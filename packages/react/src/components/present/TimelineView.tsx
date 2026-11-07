import { Space, Tag, Timeline, Typography } from 'antd';
import { formatDisplayValue, resolveDisplay, statusTone, type PresentPlan } from '@agul/core';
import { toneColor } from './tone.js';

type Row = Record<string, unknown>;

const TIMELINE_COLOR: Record<string, string> = { success: 'green', error: 'red', warning: 'orange', default: 'gray' };

interface TimelineViewProps {
  rows: Row[];
  plan: PresentPlan;
  onOpen?: (row: Row) => void;
}

/** Dated rows as a vertical timeline, newest first. */
export function TimelineView({ rows, plan, onOpen }: TimelineViewProps) {
  const dateKey = plan.date;
  const dateHint = dateKey ? resolveDisplay(dateKey, undefined, rows.find((row) => row[dateKey])?.[dateKey]) : undefined;
  const sorted = dateKey
    ? [...rows].sort((a, b) => Date.parse(String(b[dateKey] ?? '')) - Date.parse(String(a[dateKey] ?? '')))
    : rows;

  return (
    <Timeline
      data-testid="agul-timeline"
      items={sorted.map((row) => {
        const status = plan.status ? row[plan.status] : undefined;
        const preset = toneColor(statusTone(status));
        return {
          color: status !== undefined ? TIMELINE_COLOR[preset] : 'blue',
          content: (
            <Space orientation="vertical" size={2}>
              {dateKey && dateHint && (
                <Typography.Text type="secondary">{formatDisplayValue(row[dateKey], dateHint)}</Typography.Text>
              )}
              <Space wrap>
                {onOpen ? (
                  <Typography.Link onClick={() => onOpen(row)}>{String(plan.title ? row[plan.title] ?? '-' : '-')}</Typography.Link>
                ) : (
                  <Typography.Text strong>{String(plan.title ? row[plan.title] ?? '-' : '-')}</Typography.Text>
                )}
                {status !== undefined && status !== null && status !== '' && <Tag color={preset}>{String(status)}</Tag>}
              </Space>
              {plan.subtitle && row[plan.subtitle] ? (
                <Typography.Text type="secondary">{String(row[plan.subtitle])}</Typography.Text>
              ) : null}
            </Space>
          ),
        };
      })}
    />
  );
}
