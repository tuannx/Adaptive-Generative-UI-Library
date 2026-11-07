import { Card, Col, Row, Space, Tag, Typography } from 'antd';
import { formatDisplayValue, statusTone, type PresentPlan } from '@aikitstudio/agul-core';
import { formatLabel } from '../format.js';
import { toneColor } from './tone.js';

type Row = Record<string, unknown>;

interface CardGridProps {
  rows: Row[];
  plan: PresentPlan;
  /** Opens a row (e.g. the detail page). Cards are not clickable without it. */
  onOpen?: (row: Row) => void;
  rowKey?: (row: Row, index: number) => string;
}

/** Rows as a responsive grid of cards: image on top, title, status, a few short fields. */
export function CardGrid({ rows, plan, onOpen, rowKey = (_, index) => String(index) }: CardGridProps) {
  return (
    <Row gutter={[16, 16]} data-testid="agul-card-grid">
      {rows.map((row, index) => {
        const image = plan.image ? row[plan.image] : undefined;
        const title = plan.title ? row[plan.title] : undefined;
        const status = plan.status ? row[plan.status] : undefined;
        return (
          <Col key={rowKey(row, index)} xs={24} sm={12} lg={8} xl={6}>
            <Card
              hoverable={!!onOpen}
              onClick={onOpen ? () => onOpen(row) : undefined}
              data-testid="agul-card"
              cover={
                typeof image === 'string' && image ? (
                  <img src={image} alt={String(title ?? '')} loading="lazy" style={{ aspectRatio: '4 / 3', objectFit: 'cover' }} />
                ) : undefined
              }
            >
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Space wrap>
                  <Typography.Text strong>{String(title ?? '-')}</Typography.Text>
                  {status !== undefined && status !== null && status !== '' && (
                    <Tag color={toneColor(statusTone(status))}>{String(status)}</Tag>
                  )}
                </Space>
                {plan.subtitle && row[plan.subtitle] ? (
                  <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                    {String(row[plan.subtitle])}
                  </Typography.Paragraph>
                ) : null}
                {plan.extra.map(({ key, display }) => (
                  <Typography.Text key={key} type="secondary">
                    {formatLabel(key)}: <Typography.Text>{formatDisplayValue(row[key], display)}</Typography.Text>
                  </Typography.Text>
                ))}
              </Space>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
