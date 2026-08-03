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
    r.apiEndpoint.startsWith(route.apiEndpoint) &&
    r.apiEndpoint !== route.apiEndpoint
  );

  const createRoute = allRoutes.find(r =>
    r.component === 'create' &&
    r.apiEndpoint === route.apiEndpoint
  );

  const editRoute = allRoutes.find(r =>
    r.component === 'edit' &&
    r.apiEndpoint.startsWith(route.apiEndpoint)
  );

  const deleteEndpoint = allRoutes.find(r =>
    r.method === 'delete' &&
    r.apiEndpoint.startsWith(route.apiEndpoint) &&
    r.apiEndpoint !== route.apiEndpoint
  );

  const handleDelete = async (record: any) => {
    if (!deleteEndpoint) {
      message.error('Delete operation not available');
      return;
    }

    try {
      // Extract ID field
      const idField = getIdField(record);
      const id = record[idField];

      if (!id) {
        message.error('Cannot determine record ID');
        return;
      }

      // Build delete URL
      const deleteUrl = `${baseUrl}${deleteEndpoint.apiEndpoint.replace(`{${idField}}`, id)}`;

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

    const idField = getIdField(record);
    const id = record[idField];

    if (id) {
      const path = detailRoute.path.replace(`:${idField}`, id);
      navigate(path);
    }
  };

  const handleEdit = (record: any) => {
    if (!editRoute) return;

    const idField = getIdField(record);
    const id = record[idField];

    if (id) {
      const path = editRoute.path.replace(`:${idField}`, id);
      navigate(path);
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

    // Get keys from first item
    const firstItem = arrayData[0];
    const keys = Object.keys(firstItem);

    const cols: any[] = keys.slice(0, 8).map(key => ({
      title: formatColumnName(key),
      dataIndex: key,
      key,
      ellipsis: true,
      render: (value: any) => formatValue(value)
    }));

    // Add actions column
    cols.push({
      title: 'Actions',
      key: 'actions',
      dataIndex: 'actions',
      fixed: 'right' as const,
      width: 180,
      render: (_: any, record: any) => (
        <Space size="small">
          {detailRoute && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
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
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
};

// Helper functions
function getIdField(record: any): string {
  const commonIdFields = ['id', '_id', 'uuid', 'ID', 'Id'];

  for (const field of commonIdFields) {
    if (field in record) {
      return field;
    }
  }

  // Use first field as fallback
  return Object.keys(record)[0];
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
