import { Card, Col, Row, Statistic } from 'antd';
import { formatDisplayValue, type PresentField } from '@aikitstudio/agul-core';
import { formatLabel } from '../format.js';
import { useEnter } from '../../effects/MotionContext.js';

/** KPI cards for the numeric fields of one record. */
export function StatRow({ record, metrics }: { record: Record<string, unknown>; metrics: PresentField[] }) {
  const enter = useEnter('stats');
  if (metrics.length === 0) return null;
  const span = Math.max(6, Math.floor(24 / Math.min(metrics.length, 4)));
  return (
    <Row gutter={[16, 16]} data-testid="agul-stats" style={{ marginBottom: 16 }}>
      {metrics.map(({ key, display }, index) => (
        <Col key={key} xs={24} sm={12} lg={span} {...enter(index)}>
          <Card size="small" data-testid={`agul-stat-${key}`}>
            {/* antd groups plain numbers itself (12,450), which suits a KPI but not a table cell. */}
            <Statistic
              title={formatLabel(key)}
              value={display.kind === 'number' && typeof record[key] === 'number' ? record[key] : formatDisplayValue(record[key], display)}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
