import { Card, Col, Row, Statistic } from 'antd';
import { formatDisplayValue, type PresentField } from '@agul/core';
import { formatLabel } from '../format.js';

/** KPI cards for the numeric fields of one record. */
export function StatRow({ record, metrics }: { record: Record<string, unknown>; metrics: PresentField[] }) {
  if (metrics.length === 0) return null;
  const span = Math.max(6, Math.floor(24 / Math.min(metrics.length, 4)));
  return (
    <Row gutter={[16, 16]} data-testid="agul-stats" style={{ marginBottom: 16 }}>
      {metrics.map(({ key, display }) => (
        <Col key={key} xs={24} sm={12} lg={span}>
          <Card size="small" data-testid={`agul-stat-${key}`}>
            <Statistic title={formatLabel(key)} value={formatDisplayValue(record[key], display)} />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
