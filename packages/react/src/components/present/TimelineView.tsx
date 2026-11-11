import { Space, Tag, Timeline, Typography } from 'antd';
import { formatDisplayValue, resolveDisplay, statusTone, type PresentPlan } from '@aikitstudio/agul-core';
import { toneColor } from './tone.js';
import { useEnterStyle } from '../../effects/MotionContext.js';

type Row = Record<string, unknown>;

const TIMELINE_COLOR: Record<string, string> = { success: 'green', error: 'red', warning: 'orange', default: 'gray' };

interface TimelineViewProps {
  rows: Row[];
  plan: PresentPlan;
  onOpen?: (row: Row) => void;
}

/** Dated rows as a vertical timeline, newest first. */
export function TimelineView({ rows, plan, onOpen }: TimelineViewProps) {
  const enter = useEnterStyle('timeline');
  const dateKey = plan.date;
  const dateHint = dateKey
    ? plan.dateDisplay ?? resolveDisplay(dateKey, undefined, rows.find((row) => row[dateKey])?.[dateKey])
    : undefined;
  // Newest first; rows without a readable date go last instead of breaking the order.
  const time = (row: Row): number => {
    const parsed = Date.parse(String(row[dateKey ?? ''] ?? ''));
    return Number.isNaN(parsed) ? -Infinity : parsed;
  };
  const sorted = dateKey ? [...rows].sort((a, b) => (time(a) === time(b) ? 0 : time(b) > time(a) ? 1 : -1)) : rows;

  return (
    <Timeline
      data-testid="agul-timeline"
      items={sorted.map((row, index) => {
        const status = plan.status ? row[plan.status] : undefined;
        const preset = toneColor(statusTone(status));
        return {
          color: status !== undefined ? TIMELINE_COLOR[preset] : 'blue',
          content: (
            <Space orientation="vertical" size={2} style={enter(index)}>
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
