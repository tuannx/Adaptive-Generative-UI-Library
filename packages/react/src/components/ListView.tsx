import React from 'react';
import { Table, Button, Space, message, Popconfirm, Card, Input, Select, Alert, type TableColumnsType } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import {
  buildApiUrl,
  buildListApiUrl,
  buildPathParamsFromRecord,
  buildRouterPath,
  getDefaultListQueryState,
  isPrimitiveSchema,
  parseListQueryBindings,
  resolveRecordIdField,
  withFallbackPagination,
  type ListQueryParamBinding,
  type ListQueryState,
  type Resource,
} from '@agul/core';
import { useAgulNavigate, useAgulRuntime, useRevalidateList } from '../runtime.js';
import { formatCellValue, formatLabel, unwrapList } from './format.js';

type Row = Record<string, unknown>;

interface ListViewProps {
  resource: Resource;
}

interface ListPage {
  rows: Row[];
  total?: number;
}

const MAX_COLUMNS = 6;

function toListPage(body: unknown, totalHeader: unknown, rowsPath: string[] = []): ListPage {
  const located = rowsPath.reduce<unknown>(
    (node, key) => (node && typeof node === 'object' ? (node as Row)[key] : undefined),
    body,
  );
  const rows = Array.isArray(located) ? located : unwrapList(body);
  const envelope = body && typeof body === 'object' ? (body as Row) : {};
  const total = Number(totalHeader ?? envelope.total ?? envelope.totalCount ?? envelope.count);
  return {
    rows: rows.filter((row): row is Row => !!row && typeof row === 'object'),
    total: Number.isFinite(total) ? total : undefined,
  };
}

export const ListView: React.FC<ListViewProps> = ({ resource }) => {
  const list = resource.list!;
  const { baseUrl, http } = useAgulRuntime();
  const navigate = useAgulNavigate();
  const revalidate = useRevalidateList(resource);
  const routeParams = useParams();

  const queryBindings = React.useMemo(
    () => withFallbackPagination(parseListQueryBindings(list.parameters)),
    [list.parameters],
  );
  const hasServerPagination = queryBindings.some((b) => b.role === 'page' || b.role === 'offset');
  const searchBinding = queryBindings.find((b) => b.role === 'search');
  const filterBindings = queryBindings.filter((b) => b.role === 'filter');

  const [queryState, setQueryState] = React.useState<ListQueryState>(() =>
    getDefaultListQueryState(queryBindings),
  );

  const listUrl = buildListApiUrl(baseUrl, list.apiEndpoint, queryBindings, queryState, routeParams);
  const { data, error, isLoading } = useSWR(listUrl, (url: string) =>
    http.get(url).then((res) => toListPage(res.data, res.headers['x-total-count'], list.rowsPath)),
  );

  const rows = React.useMemo(
    () =>
      (data?.rows ?? []).map((row, index): Row => {
        const idField = resolveRecordIdField(row, resource.idParam ?? 'id');
        return { ...row, key: String(row[idField] ?? index) };
      }),
    [data, resource.idParam],
  );

  const visibleRows = React.useMemo(() => {
    const query = queryState.search.trim().toLowerCase();
    const searched =
      searchBinding || !query
        ? rows
        : rows.filter((row) =>
            Object.values(row).some((value) => String(value).toLowerCase().includes(query)),
          );
    if (hasServerPagination) return searched;
    const start = (queryState.page - 1) * queryState.pageSize;
    return searched.slice(start, start + queryState.pageSize);
  }, [rows, queryState, searchBinding, hasServerPagination]);

  const total = hasServerPagination
    ? data?.total ??
      (queryState.page - 1) * queryState.pageSize +
        rows.length +
        (rows.length === queryState.pageSize ? 1 : 0)
    : searchBinding || !queryState.search.trim()
      ? rows.length
      : visibleRows.length;

  const handleDelete = async (record: Row) => {
    const remove = resource.remove!;
    const pathParams = { ...routeParams, ...buildPathParamsFromRecord(remove.apiEndpoint, record) };
    try {
      await http.delete(buildApiUrl(baseUrl, remove.apiEndpoint, pathParams));
      message.success('Deleted successfully');
      await revalidate(routeParams);
    } catch (err) {
      message.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const goToRecord = (path: string | undefined, record: Row) => {
    if (!path) return;
    const target = buildRouterPath(path, { ...routeParams, ...record });
    if (!target.includes(':')) navigate(target, { state: { record } });
  };

  const columns = React.useMemo<TableColumnsType<Row>>(() => {
    const properties = resource.recordSchema?.properties;
    const keys = properties
      ? Object.keys(properties).filter((key) => isPrimitiveSchema(properties[key]))
      : Object.keys(rows[0] ?? {}).filter((key) => key !== 'key' && typeof rows[0][key] !== 'object');

    const dataColumns: TableColumnsType<Row> = keys.slice(0, MAX_COLUMNS).map((key) => ({
      title: formatLabel(key),
      dataIndex: key,
      key,
      ellipsis: true,
      render: (value: unknown) => formatCellValue(value),
    }));

    const { paths, remove } = resource;
    if (!paths.detail && !paths.edit && !remove) return dataColumns;

    return [
      ...dataColumns,
      {
        title: 'Actions',
        key: 'actions',
        width: 220,
        render: (_: unknown, record: Row) => (
          <Space size="small">
            {paths.detail && (
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                data-testid={`agul-action-view-${record.key}`}
                onClick={() => goToRecord(paths.detail, record)}
              >
                View
              </Button>
            )}
            {paths.edit && (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                data-testid={`agul-action-edit-${record.key}`}
                onClick={() => goToRecord(paths.edit, record)}
              >
                Edit
              </Button>
            )}
            {remove && (
              <Popconfirm
                title="Are you sure you want to delete this item?"
                onConfirm={() => handleDelete(record)}
                okText="Yes"
                cancelText="No"
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  data-testid={`agul-action-delete-${record.key}`}
                >
                  Delete
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ];
  }, [resource, rows, routeParams, baseUrl, http, navigate, revalidate]);

  const updateQueryState = (patch: Partial<ListQueryState>) => {
    setQueryState((current) => ({ ...current, page: 1, ...patch }));
  };

  return (
    <Card
      data-testid="agul-list-view"
      title={resource.label}
      extra={
        resource.paths.create && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate(buildRouterPath(resource.paths.create!, routeParams))}
          >
            Create New
          </Button>
        )
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search"
          value={queryState.search}
          data-testid="agul-list-search"
          onChange={(event) => updateQueryState({ search: event.target.value })}
          style={{ width: 240 }}
        />
        {filterBindings.map((binding) => (
          <FilterControl
            key={binding.name}
            binding={binding}
            value={queryState.filters[binding.name]}
            onChange={(value) =>
              updateQueryState({ filters: { ...queryState.filters, [binding.name]: value } })
            }
          />
        ))}
      </Space>
      {error ? (
        <Alert
          type="error"
          showIcon
          message="Failed to load data"
          description={error instanceof Error ? error.message : String(error)}
        />
      ) : (
        <Table
          data-testid="agul-list-table"
          columns={columns}
          dataSource={visibleRows}
          loading={isLoading}
          pagination={{
            current: queryState.page,
            pageSize: queryState.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (count) => `Total ${count} items`,
            onChange: (page, pageSize) =>
              setQueryState((current) => ({ ...current, page, pageSize: pageSize ?? current.pageSize })),
          }}
          scroll={{ x: 'max-content' }}
        />
      )}
    </Card>
  );
};

function FilterControl({
  binding,
  value,
  onChange,
}: {
  binding: ListQueryParamBinding;
  value?: string;
  onChange: (value: string) => void;
}) {
  const label = formatLabel(binding.name);

  if (binding.schema?.enum?.length) {
    return (
      <Select
        allowClear
        value={value}
        placeholder={label}
        data-testid={`agul-list-filter-${binding.name}`}
        style={{ minWidth: 160 }}
        options={binding.schema.enum.map((option) => ({ value: String(option), label: String(option) }))}
        onChange={(next) => onChange(next ?? '')}
      />
    );
  }

  return (
    <Input
      allowClear
      value={value}
      placeholder={label}
      data-testid={`agul-list-filter-${binding.name}`}
      style={{ width: 180 }}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
