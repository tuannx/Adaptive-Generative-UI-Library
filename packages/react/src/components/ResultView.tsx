import { Descriptions, Table, Typography } from 'antd';
import { planRecord, planRows } from '@aikitstudio/agul-core';
import { formatCellValue, formatLabel, unwrapList } from './format.js';
import { renderValue } from './values.js';
import { CardGrid } from './present/CardGrid.js';
import { StatRow } from './present/StatRow.js';
import { TimelineView } from './present/TimelineView.js';

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Objects and arrays of objects stay compact JSON in a table cell; arrays of primitives become tags. */
function isNested(cell: unknown): boolean {
  if (cell === null || typeof cell !== 'object') return false;
  return !Array.isArray(cell) || cell.some((item) => item !== null && typeof item === 'object');
}

function RowsView({ rows }: { rows: Row[] }) {
  const plan = planRows(rows);
  if (plan.kind === 'cards') return <CardGrid rows={rows} plan={plan} />;
  if (plan.kind === 'timeline') return <TimelineView rows={rows} plan={plan} />;

  const keys = [...new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row)))].slice(0, 8);
  return (
    <Table<Row>
      data-testid="agul-result-table"
      size="small"
      rowKey={(_, index) => String(index)}
      dataSource={rows}
      pagination={rows.length > 10 ? { pageSize: 10 } : false}
      scroll={{ x: 'max-content' }}
      columns={keys.map((key) => ({
        key,
        dataIndex: key,
        title: formatLabel(key),
        render: (cell: unknown) => (isNested(cell) ? formatCellValue(cell) : renderValue(cell, key)),
      }))}
    />
  );
}

function RecordView({ record }: { record: Row }) {
  const plan = planRecord(record);
  const shown = new Set(plan.metrics.map((field) => field.key));
  const rest = Object.entries(record).filter(([key]) => !shown.has(key));
  return (
    <>
      <StatRow record={record} metrics={plan.metrics} />
      {rest.length > 0 && (
        <Descriptions
          data-testid="agul-result-record"
          bordered
          column={1}
          size="small"
          items={rest.map(([key, field]) => ({
            key,
            label: formatLabel(key),
            children:
              Array.isArray(field) && field.length > 0 && field.every(isRow) ? <ResultView value={field} /> : renderValue(field, key),
          }))}
        />
      )}
    </>
  );
}

/**
 * Renders an arbitrary API result: rows as cards, a timeline or a table; a record as KPI stats
 * plus key/values; text as paragraphs.
 */
export function ResultView({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') {
    return <Typography.Text type="secondary">No content</Typography.Text>;
  }

  if (typeof value === 'string') {
    return (
      <Typography.Paragraph data-testid="agul-result-text" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
        {value}
      </Typography.Paragraph>
    );
  }

  const enveloped = isRow(value) ? unwrapList(value) : undefined;
  const rows = Array.isArray(value) ? value : enveloped && enveloped[0] !== value ? enveloped : undefined;
  if (rows && rows.length > 0 && rows.every(isRow)) return <RowsView rows={rows as Row[]} />;
  if (isRow(value)) return <RecordView record={value} />;
  return <>{renderValue(value, 'value')}</>;
}
