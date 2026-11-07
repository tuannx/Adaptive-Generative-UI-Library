
import { Descriptions, Table, Typography } from 'antd';
import { formatCellValue, formatLabel, unwrapList } from './format.js';
import { renderValue } from './values.js';

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Renders an arbitrary API result: rows as a table, a record as key/values, text as paragraphs. */
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
  if (rows && rows.length > 0 && rows.every(isRow)) {
    const keys = [...new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row)))].slice(0, 8);
    return (
      <Table<Row>
        data-testid="agul-result-table"
        size="small"
        rowKey={(_, index) => String(index)}
        dataSource={rows as Row[]}
        pagination={rows.length > 10 ? { pageSize: 10 } : false}
        scroll={{ x: 'max-content' }}
        columns={keys.map((key) => ({
          key,
          dataIndex: key,
          title: formatLabel(key),
          render: (cell: unknown) => (typeof cell === 'object' && cell !== null ? formatCellValue(cell) : renderValue(cell, key)),
        }))}
      />
    );
  }

  if (isRow(value)) {
    return (
      <Descriptions
        data-testid="agul-result-record"
        bordered
        column={1}
        size="small"
        items={Object.entries(value).map(([key, field]) => ({
          key,
          label: formatLabel(key),
          children:
            Array.isArray(field) && field.every(isRow) && field.length > 0 ? <ResultView value={field} /> : renderValue(field, key),
        }))}
      />
    );
  }

  return <>{renderValue(value, 'value')}</>;
}
