/**
 * DetailView Component - Displays a single resource detail
 */

import React from 'react';
import { Card, Descriptions, Button, Space, message, Popconfirm, Spin, Alert } from 'antd';
import { EditOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import axios from 'axios';
import type { RouteConfig } from '../core/types';

interface DetailViewProps {
  route: RouteConfig;
  baseUrl: string;
  allRoutes: RouteConfig[];
}

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export const DetailView: React.FC<DetailViewProps> = ({ route, baseUrl, allRoutes }) => {
  const navigate = useNavigate();
  const params = useParams();

  // Build API URL with path parameters
  let apiUrl = `${baseUrl}${route.apiEndpoint}`;
  Object.entries(params).forEach(([key, value]) => {
    apiUrl = apiUrl.replace(`{${key}}`, value || '');
  });

  const { data, error, isLoading } = useSWR(apiUrl, fetcher);

  // Find related routes
  const editRoute = allRoutes.find(r =>
    r.component === 'edit' &&
    r.apiEndpoint === route.apiEndpoint
  );

  const deleteEndpoint = allRoutes.find(r =>
    r.method === 'delete' &&
    r.apiEndpoint === route.apiEndpoint
  );

  const listRoute = allRoutes.find(r =>
    r.component === 'list' &&
    route.apiEndpoint.startsWith(r.apiEndpoint)
  );

  const handleEdit = () => {
    if (!editRoute) return;

    let path = editRoute.path;
    Object.entries(params).forEach(([key, value]) => {
      path = path.replace(`:${key}`, value || '');
    });

    navigate(path);
  };

  const handleDelete = async () => {
    if (!deleteEndpoint) {
      message.error('Delete operation not available');
      return;
    }

    try {
      await axios.delete(apiUrl);
      message.success('Deleted successfully');

      // Navigate back to list
      if (listRoute) {
        navigate(listRoute.path);
      } else {
        navigate(-1);
      }
    } catch (err: any) {
      message.error(`Delete failed: ${err.message}`);
    }
  };

  const handleBack = () => {
    if (listRoute) {
      navigate(listRoute.path);
    } else {
      navigate(-1);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card>
        <Alert
          message="Error"
          description={`Failed to load data: ${error.message}`}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  // Get actual data object
  const detailData = data?.data || data;

  if (!detailData) {
    return (
      <Card>
        <Alert
          message="No Data"
          description="No data found for this resource"
          type="warning"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
          />
          {route.summary || 'Detail View'}
        </Space>
      }
      extra={
        <Space>
          {editRoute && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={handleEdit}
            >
              Edit
            </Button>
          )}
          {deleteEndpoint && (
            <Popconfirm
              title="Are you sure you want to delete this item?"
              onConfirm={handleDelete}
              okText="Yes"
              cancelText="No"
            >
              <Button
                danger
                icon={<DeleteOutlined />}
              >
                Delete
              </Button>
            </Popconfirm>
          )}
        </Space>
      }
    >
      <Descriptions bordered column={1}>
        {renderDescriptionItems(detailData)}
      </Descriptions>
    </Card>
  );
};

/**
 * Render description items from data object
 */
function renderDescriptionItems(data: any, prefix = ''): React.ReactNode[] {
  const items: React.ReactNode[] = [];

  Object.entries(data).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const label = formatLabel(key);

    if (value === null || value === undefined) {
      items.push(
        <Descriptions.Item key={fullKey} label={label}>
          <span style={{ color: '#999' }}>-</span>
        </Descriptions.Item>
      );
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Nested object - render as JSON for now
      items.push(
        <Descriptions.Item key={fullKey} label={label}>
          <pre style={{ margin: 0, fontSize: '12px' }}>
            {JSON.stringify(value, null, 2)}
          </pre>
        </Descriptions.Item>
      );
    } else if (Array.isArray(value)) {
      // Array - render as JSON
      items.push(
        <Descriptions.Item key={fullKey} label={label}>
          <pre style={{ margin: 0, fontSize: '12px' }}>
            {JSON.stringify(value, null, 2)}
          </pre>
        </Descriptions.Item>
      );
    } else if (typeof value === 'boolean') {
      items.push(
        <Descriptions.Item key={fullKey} label={label}>
          {value ? 'Yes' : 'No'}
        </Descriptions.Item>
      );
    } else if (typeof value === 'string' && isUrl(value)) {
      items.push(
        <Descriptions.Item key={fullKey} label={label}>
          <a href={value} target="_blank" rel="noopener noreferrer">
            {value}
          </a>
        </Descriptions.Item>
      );
    } else if (typeof value === 'string' && isImageUrl(value)) {
      items.push(
        <Descriptions.Item key={fullKey} label={label}>
          <img
            src={value}
            alt={key}
            style={{ maxWidth: '200px', maxHeight: '200px' }}
          />
        </Descriptions.Item>
      );
    } else {
      items.push(
        <Descriptions.Item key={fullKey} label={label}>
          {String(value)}
        </Descriptions.Item>
      );
    }
  });

  return items;
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}

function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function isImageUrl(str: string): boolean {
  return /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(str);
}
