import React from 'react';
import { Table, Button, Space, Popconfirm, Card, Input, Select, Alert, Empty, Tooltip, Pagination, Segmented, type TableColumnsType, App } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
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
  planRows,
  resolveRecordIdField,
  withFallbackPagination,
  type ListQueryParamBinding,
  type ListQueryState,
  type Resource,
} from '@aikitstudio/agul-core';
import { useAgulNavigate, useAgulRuntime, useRevalidateList } from '../runtime.js';
import { describeApiError } from '../http/errors.js';
import { formatLabel, unwrapList } from './format.js';
import { renderValue } from './values.js';
import { CardGrid } from './present/CardGrid.js';
import { TimelineView } from './present/TimelineView.js';

type Row = Record<string, unknown>;
type ListMode = 'table' | 'cards' | 'timeline';

interface ListViewProps {
  resource: Resource;
}

interface ListPage {
  rows: Row[];
  total?: number;
}

const MAX_COLUMNS = 6;
const SEARCH_DEBOUNCE_MS = 300;

/** List state per list (resource + path params), kept for the session so "back" returns to the same page. */
const rememberedState = new Map<string, ListQueryState>();

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

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export const ListView: React.FC<ListViewProps> = ({ resource }) => {
  const list = resource.list!;
  const { baseUrl, http } = useAgulRuntime();
  const navigate = useAgulNavigate();
  const revalidate = useRevalidateList(resource);
  const routeParams = useParams();
  const { message } = App.useApp();

  const queryBindings = React.useMemo(
    () => withFallbackPagination(parseListQueryBindings(list.parameters)),
    [list.parameters],
  );
  const hasServerPagination = queryBindings.some((b) => b.role === 'page' || b.role === 'offset');
  const searchBinding = queryBindings.find((b) => b.role === 'search');
  const filterBindings = queryBindings.filter((b) => b.role === 'filter');

  const stateKey = `${resource.key}|${JSON.stringify(routeParams)}`;
  const [queryState, setQueryState] = React.useState<ListQueryState>(
    () => rememberedState.get(stateKey) ?? getDefaultListQueryState(queryBindings),
  );
  React.useEffect(() => {
    rememberedState.set(stateKey, queryState);
  }, [stateKey, queryState]);
  const [selectedKeys, setSelectedKeys] = React.useState<React.Key[]>([]);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  // typing in server-side search or text filters waits for a pause before querying
  const requestState = useDebounced(queryState, SEARCH_DEBOUNCE_MS);
  const effectiveState =
    requestState.page === queryState.page && requestState.pageSize === queryState.pageSize ? requestState : queryState;

  const listUrl = buildListApiUrl(baseUrl, list.apiEndpoint, queryBindings, effectiveState, routeParams);
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    listUrl,
    (url: string) => http.get(url).then((res) => toListPage(res.data, res.headers['x-total-count'], list.rowsPath)),
    { keepPreviousData: true },
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
            Object.values(row).some((value) => value !== null && typeof value !== 'object' && String(value).toLowerCase().includes(query)),
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
      : rows.filter((row) =>
          Object.values(row).some(
            (value) => value !== null && typeof value !== 'object' && String(value).toLowerCase().includes(queryState.search.trim().toLowerCase()),
          ),
        ).length;

  const deleteRecord = React.useCallback(
    async (record: Row) => {
      const remove = resource.remove!;
      const pathParams = { ...routeParams, ...buildPathParamsFromRecord(remove.apiEndpoint, record) };
      await http.delete(buildApiUrl(baseUrl, remove.apiEndpoint, pathParams));
    },
    [resource.remove, routeParams, http, baseUrl],
  );

  const handleDelete = React.useCallback(
    async (record: Row) => {
      try {
        await deleteRecord(record);
        message.success('Deleted');
        setSelectedKeys((keys) => keys.filter((key) => key !== record.key));
        await revalidate(routeParams);
      } catch (err) {
        message.error(`Delete failed — ${describeApiError(err).message}`);
      }
    },
    [deleteRecord, revalidate, routeParams, message],
  );

  const handleBulkDelete = async () => {
    const targets = rows.filter((row) => selectedKeys.includes(row.key as string));
    setBulkDeleting(true);
    const failures: string[] = [];
    for (const record of targets) {
      try {
        await deleteRecord(record);
      } catch (err) {
        failures.push(`${String(record.key)}: ${describeApiError(err).message}`);
      }
    }
    setBulkDeleting(false);
    setSelectedKeys([]);
    await revalidate(routeParams);
    if (failures.length === 0) message.success(`Deleted ${targets.length} item${targets.length === 1 ? '' : 's'}`);
    else message.error(`${failures.length} of ${targets.length} deletes failed — ${failures[0]}`);
  };

  const goToRecord = React.useCallback(
    (path: string | undefined, record: Row) => {
      if (!path) return;
      const target = buildRouterPath(path, { ...routeParams, ...record });
      if (!target.includes(':')) navigate(target, { state: { record } });
    },
    [routeParams, navigate],
  );

  const columns = React.useMemo<TableColumnsType<Row>>(() => {
    const properties = resource.recordSchema?.properties;
    const sample = rows[0];
    const keys = properties
      ? Object.keys(properties).filter((key) => isPrimitiveSchema(properties[key]))
      : Object.keys(sample ?? {}).filter((key) => key !== 'key' && (sample[key] === null || typeof sample[key] !== 'object'));

    const dataColumns: TableColumnsType<Row> = keys.slice(0, MAX_COLUMNS).map((key) => ({
      title: formatLabel(key),
      dataIndex: key,
      key,
      ellipsis: true,
      sorter: (a: Row, b: Row) => compareValues(a[key], b[key]),
      render: (value: unknown) => renderValue(value, key, properties?.[key], { compact: true }),
    }));

    const { paths, remove } = resource;
    if (!paths.detail && !paths.edit && !remove) return dataColumns;

    return [
      ...dataColumns,
      {
        title: 'Actions',
        key: 'actions',
        fixed: 'right',
        width: 220,
        render: (_: unknown, record: Row) => (
          <Space size="small" onClick={(event) => event.stopPropagation()}>
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
                title="Delete this item?"
                description="This can't be undone."
                onConfirm={() => handleDelete(record)}
                okText="Yes"
                okButtonProps={{ danger: true }}
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
  }, [resource, rows, goToRecord, handleDelete]);

  // Cards / timeline are offered when the rows suit them; the table stays the default unless the
  // schema pins a view with `x-agul-present`.
  const rowPlan = React.useMemo(() => planRows(rows, resource.recordSchema), [rows, resource.recordSchema]);
  const offeredMode = rowPlan.kind === 'cards' || rowPlan.kind === 'timeline' ? rowPlan.kind : undefined;
  const [chosenMode, setChosenMode] = React.useState<ListMode | undefined>(undefined);
  const pinnedMode = resource.recordSchema?.['x-agul-present'] === offeredMode ? offeredMode : undefined;
  const mode: ListMode = offeredMode ? chosenMode ?? pinnedMode ?? 'table' : 'table';
  const openDetail = resource.paths.detail ? (record: Row) => goToRecord(resource.paths.detail, record) : undefined;

  const pagination = {
    current: queryState.page,
    pageSize: queryState.pageSize,
    total,
    showSizeChanger: true,
    showTotal: (count: number) => `Total ${count} items`,
    onChange: (page: number, pageSize?: number) =>
      setQueryState((current) => ({ ...current, page, pageSize: pageSize ?? current.pageSize })),
  };

  const updateQueryState = (patch: Partial<ListQueryState>) => {
    setQueryState((current) => ({ ...current, page: 1, ...patch }));
  };

  const createButton = resource.paths.create && (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(buildRouterPath(resource.paths.create!, routeParams))}>
      Create New
    </Button>
  );
  const filtered = !!queryState.search.trim() || Object.values(queryState.filters).some(Boolean);

  return (
    <Card data-testid="agul-list-view" title={resource.label} extra={createButton}>
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
            onChange={(value) => updateQueryState({ filters: { ...queryState.filters, [binding.name]: value } })}
          />
        ))}
        <Tooltip title="Refresh">
          <Button icon={<ReloadOutlined spin={isValidating && !isLoading} />} onClick={() => mutate()} data-testid="agul-list-refresh" />
        </Tooltip>
        {offeredMode && (
          <Segmented<ListMode>
            data-testid="agul-list-mode"
            value={mode}
            onChange={setChosenMode}
            options={[
              { label: 'Table', value: 'table' },
              { label: offeredMode === 'cards' ? 'Cards' : 'Timeline', value: offeredMode },
            ]}
          />
        )}
        {resource.remove && selectedKeys.length > 0 && (
          <Popconfirm
            title={`Delete ${selectedKeys.length} selected item${selectedKeys.length === 1 ? '' : 's'}?`}
            description="This can't be undone."
            onConfirm={handleBulkDelete}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} loading={bulkDeleting} data-testid="agul-list-bulk-delete">
              Delete selected ({selectedKeys.length})
            </Button>
          </Popconfirm>
        )}
      </Space>
      {error && (
        <Alert
          style={{ marginBottom: 16 }}
          type="error"
          showIcon
          title="Failed to load data"
          description={describeApiError(error).message}
          action={
            <Button size="small" onClick={() => mutate()}>
              Retry
            </Button>
          }
        />
      )}
      {(!error || data) && mode !== 'table' && (
        <>
          {mode === 'cards' ? (
            <CardGrid rows={visibleRows} plan={rowPlan} onOpen={openDetail} rowKey={(row) => String(row.key)} />
          ) : (
            <TimelineView rows={visibleRows} plan={rowPlan} onOpen={openDetail} />
          )}
          <Pagination style={{ marginTop: 16, textAlign: 'right' }} {...pagination} />
        </>
      )}
      {(!error || data) && mode === 'table' && (
        <Table
          data-testid="agul-list-table"
          columns={columns}
          dataSource={visibleRows}
          loading={isLoading}
          rowSelection={
            resource.remove ? { selectedRowKeys: selectedKeys, onChange: setSelectedKeys, preserveSelectedRowKeys: false } : undefined
          }
          onRow={(record) =>
            resource.paths.detail
              ? { onDoubleClick: () => goToRecord(resource.paths.detail, record), style: { cursor: 'pointer' } }
              : {}
          }
          locale={{
            emptyText: isLoading ? (
              <div style={{ height: 120 }} />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={filtered ? 'Nothing matches the search or filters' : `No ${resource.label.toLowerCase()} yet`}
              >
                {filtered ? (
                  <Button onClick={() => updateQueryState({ search: '', filters: {} })}>Clear filters</Button>
                ) : (
                  resource.paths.create && (
                    <Button icon={<PlusOutlined />} onClick={() => navigate(buildRouterPath(resource.paths.create!, routeParams))}>
                      Add the first one
                    </Button>
                  )
                )}
              </Empty>
            ),
          }}
          pagination={pagination}
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
  const options = binding.schema?.enum ?? (binding.schema?.type === 'boolean' ? ['true', 'false'] : undefined);

  if (options?.length) {
    return (
      <Select
        allowClear
        value={value || undefined}
        placeholder={label}
        data-testid={`agul-list-filter-${binding.name}`}
        style={{ minWidth: 160 }}
        options={options.map((option) => ({ value: String(option), label: String(option) }))}
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
