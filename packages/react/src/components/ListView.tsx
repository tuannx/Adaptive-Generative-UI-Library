/**
 * ListView Component - Displays list of resources in a table
 */

import React from 'react';
import { Table, Button, Space, message, Popconfirm, Card, Input, Select } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import { agulHttp, agulFetcher } from '../http/client.js';
import type { RouteConfig, ListQueryParamBinding } from '@agul/core';
import {
  routesShareResource,
  buildRouterPath,
  buildPathParamsFromRecord,
  buildApiUrl,
  parseListQueryBindings,
  withFallbackPagination,
  getDefaultListQueryState,
  buildListApiUrl,
  type ListQueryState,
} from '@agul/core';

interface ListViewProps {
  route: RouteConfig;
  baseUrl: string;
  allRoutes: RouteConfig[];
}

const fetcher = agulFetcher;

export const ListView: React.FC<ListViewProps> = ({ route, baseUrl, allRoutes }) => {
  const navigate = useNavigate();

  const queryBindings = React.useMemo(
    () => withFallbackPagination(parseListQueryBindings(route.parameters)),
    [route.parameters],
  );

  const hasServerPagination = queryBindings.some(
    (binding) => binding.role === 'page' || binding.role === 'limit' || binding.role === 'offset',
  );
  const searchBinding = queryBindings.find((binding) => binding.role === 'search');
  const filterBindings = queryBindings.filter((binding) => binding.role === 'filter');

  const [queryState, setQueryState] = React.useState<ListQueryState>(() =>
    getDefaultListQueryState(queryBindings),
  );

  const listUrl = buildListApiUrl(baseUrl, route.apiEndpoint, queryBindings, queryState);
  const { data, error, isLoading } = useSWR(listUrl, fetcher);

  // Find related routes for this resource
  const detailRoute = allRoutes.find(r =>
    r.component === 'detail' &&
    routesShareResource(r.apiEndpoint, route.apiEndpoint)
  );

  const createRoute = allRoutes.find(r =>
    r.component === 'create' &&
    routesShareResource(r.apiEndpoint, route.apiEndpoint) &&
    !r.path.includes(':')
  ) ?? allRoutes.find(r =>
    r.component === 'create' &&
    routesShareResource(r.apiEndpoint, route.apiEndpoint)
  );

  const editRoute = allRoutes.find(r =>
    r.component === 'edit' &&
    routesShareResource(r.apiEndpoint, route.apiEndpoint)
  );

  const deleteEndpoint = allRoutes.find(r =>
    r.method === 'delete' &&
    routesShareResource(r.apiEndpoint, route.apiEndpoint)
  );

  const handleDelete = async (record: any) => {
    if (!deleteEndpoint) {
      message.error('Delete operation not available');
      return;
    }

    try {
      const pathParams = buildPathParamsFromRecord(deleteEndpoint.apiEndpoint, record);

      if (Object.keys(pathParams).length === 0) {
        message.error('Cannot determine record ID');
        return;
      }

      const deleteUrl = buildApiUrl(baseUrl, deleteEndpoint.apiEndpoint, pathParams);

      await agulHttp.delete(deleteUrl);
      message.success('Deleted successfully');

      mutate(listUrl);
    } catch (err: any) {
      message.error(`Delete failed: ${err.message}`);
    }
  };

  const handleView = (record: any) => {
    if (!detailRoute) return;

    const path = buildRouterPath(detailRoute.path, record);
    if (!path.includes(':')) {
      navigate(path);
    }
  };

  const handleEdit = (record: any) => {
    if (!editRoute) return;

    const path = buildRouterPath(editRoute.path, record);
    if (!path.includes(':')) {
      navigate(path, { state: { record } });
    }
  };

  const handleCreate = () => {
    if (createRoute) {
      navigate(createRoute.path);
    }
  };

  const rawTableData = React.useMemo(() => {
    if (!data) return [];

    const arrayData = Array.isArray(data) ? data :
                      data.data ? data.data :
                      data.items ? data.items :
                      [data];

    return arrayData.map((item: any, index: number) => ({
      ...item,
      key: item.id || item._id || item.uuid || index
    }));
  }, [data]);

  const filteredTableData = React.useMemo(() => {
    if (searchBinding || !queryState.search.trim()) {
      return rawTableData;
    }

    const query = queryState.search.trim().toLowerCase();
    return rawTableData.filter((row: Record<string, unknown>) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [rawTableData, queryState.search, searchBinding]);

  const tableData = React.useMemo(() => {
    if (hasServerPagination) {
      return filteredTableData;
    }

    const start = (queryState.page - 1) * queryState.pageSize;
    return filteredTableData.slice(start, start + queryState.pageSize);
  }, [filteredTableData, hasServerPagination, queryState.page, queryState.pageSize]);

  const paginationTotal = hasServerPagination
    ? queryState.page * queryState.pageSize +
      (filteredTableData.length === queryState.pageSize ? queryState.pageSize : 0)
    : filteredTableData.length;

  // Generate table columns from schema or data
  const columns = React.useMemo(() => {
    if (rawTableData.length === 0) return [];

    const firstItem = rawTableData[0];
    const skipKeys = new Set(['photoUrls', 'tags', 'category']);
    const keys = Object.keys(firstItem).filter((k) => !skipKeys.has(k));

    const cols: any[] = keys.slice(0, 6).map(key => ({
      title: formatColumnName(key),
      dataIndex: key,
      key,
      width: 140,
      ellipsis: true,
      render: (value: any) => formatValue(value)
    }));

    cols.push({
      title: 'Actions',
      key: 'actions',
      dataIndex: 'actions',
      width: 220,
      render: (_: any, record: any) => (
        <Space size="small">
          {detailRoute && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              data-testid={`agul-action-view-${record.id ?? record.key}`}
              onClick={() => handleView(record)}
            >
              View
            </Button>
          )}
          {editRoute && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              data-testid={`agul-action-edit-${record.id ?? record.key}`}
              onClick={() => handleEdit(record)}
            >
              Edit
            </Button>
          )}
          {deleteEndpoint && (
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
                data-testid={`agul-action-delete-${record.id ?? record.key}`}
              >
                Delete
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    });

    return cols;
  }, [rawTableData, detailRoute, editRoute, deleteEndpoint]);

  const updateQueryState = (patch: Partial<ListQueryState>) => {
    setQueryState((current) => ({ ...current, page: 1, ...patch }));
  };

  if (error) {
    return (
      <Card>
        <div style={{ padding: '20px', color: 'red' }}>
          Error loading data: {error.message}
        </div>
      </Card>
    );
  }

  return (
    <Card
      data-testid="agul-list-view"
      title={route.summary || formatPathName(route.path)}
      extra={
        createRoute && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
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
              updateQueryState({
                filters: { ...queryState.filters, [binding.name]: value },
              })
            }
          />
        ))}
      </Space>
      <Table
        data-testid="agul-list-table"
        columns={columns}
        dataSource={tableData}
        loading={isLoading}
        pagination={{
          current: queryState.page,
          pageSize: queryState.pageSize,
          total: paginationTotal,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} items`,
          onChange: (page, pageSize) => {
            setQueryState((current) => ({
              ...current,
              page,
              pageSize: pageSize ?? current.pageSize,
            }));
          },
        }}
        scroll={{ x: 960 }}
        tableLayout="fixed"
      />
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
  const label = formatColumnName(binding.name);

  if (binding.schema?.enum?.length) {
    return (
      <Select
        value={value}
        placeholder={label}
        data-testid={`agul-list-filter-${binding.name}`}
        style={{ minWidth: 160 }}
        options={binding.schema.enum.map((option) => ({
          value: String(option),
          label: String(option),
        }))}
        onChange={onChange}
      />
    );
  }

  return (
    <Input
      value={value}
      placeholder={label}
      data-testid={`agul-list-filter-${binding.name}`}
      style={{ width: 180 }}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function formatColumnName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

function formatPathName(path: string): string {
  return path
    .replace(/^\//, '')
    .replace(/\/:.+$/, '')
    .split(/[-_\/]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
