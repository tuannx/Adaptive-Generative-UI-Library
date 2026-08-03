/**
 * ListView Component - Displays list of resources in a table
 */

import React from 'react';
import { Table, Button, Space, message, Popconfirm, Card } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import axios from 'axios';
import type { RouteConfig } from '@agul/core';
import { routesShareResource, buildRouterPath, buildPathParamsFromRecord, buildApiUrl } from '@agul/core';

interface ListViewProps {
  route: RouteConfig;
  baseUrl: string;
  allRoutes: RouteConfig[];
}

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export const ListView: React.FC<ListViewProps> = ({ route, baseUrl, allRoutes }) => {
  const navigate = useNavigate();
  const apiUrl = `${baseUrl}${route.apiEndpoint}`;

  const { data, error, isLoading } = useSWR(apiUrl, fetcher);

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

      await axios.delete(deleteUrl);
      message.success('Deleted successfully');

      // Refresh data
      mutate(apiUrl);
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

  // Generate table columns from schema or data
  const columns = React.useMemo(() => {
    if (!data) return [];

    // Get array data
    const arrayData = Array.isArray(data) ? data :
                      data.data ? data.data :
                      data.items ? data.items :
                      [data];

    if (arrayData.length === 0) return [];

    // Get keys from first item — skip nested/heavy fields for table width
    const firstItem = arrayData[0];
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

    // Add actions column
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
  }, [data, detailRoute, editRoute, deleteEndpoint]);

  // Extract array data
  const tableData = React.useMemo(() => {
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
      <Table
        data-testid="agul-list-table"
        columns={columns}
        dataSource={tableData}
        loading={isLoading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} items`
        }}
        scroll={{ x: 960 }}
        tableLayout="fixed"
      />
    </Card>
  );
};

// Helper functions
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
