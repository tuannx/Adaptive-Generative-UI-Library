import React from 'react';
import { Card, Descriptions, Button, Space, message, Popconfirm, Spin, Alert, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { buildApiUrl, buildPathParamsFromRecord, buildRouterPath, type Resource } from '@agul/core';
import { useAgulFetcher, useAgulNavigate, useAgulRuntime, useRevalidateList } from '../runtime.js';
import { formatLabel, isHttpUrl, isImageUrl, unwrapRecord } from './format.js';

interface DetailViewProps {
  resource: Resource;
}

export const DetailView: React.FC<DetailViewProps> = ({ resource }) => {
  const detail = resource.detail!;
  const { baseUrl, http } = useAgulRuntime();
  const fetcher = useAgulFetcher();
  const navigate = useAgulNavigate();
  const revalidate = useRevalidateList(resource);
  const params = useParams();

  const apiUrl = buildApiUrl(baseUrl, detail.apiEndpoint, params);
  const { data, error, isLoading } = useSWR(apiUrl, fetcher);
  const record = unwrapRecord(data) as Record<string, unknown> | undefined;

  const handleBack = () => {
    if (resource.paths.list) navigate(buildRouterPath(resource.paths.list, params));
    else navigate(-1);
  };

  const handleDelete = async () => {
    const remove = resource.remove!;
    try {
      const pathParams = { ...buildPathParamsFromRecord(remove.apiEndpoint, record ?? {}), ...params };
      await http.delete(buildApiUrl(baseUrl, remove.apiEndpoint, pathParams));
      message.success('Deleted successfully');
      await revalidate();
      handleBack();
    } catch (err) {
      message.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  } else if (error) {
    body = (
      <Alert
        type="error"
        showIcon
        message="Failed to load data"
        description={error instanceof Error ? error.message : String(error)}
      />
    );
  } else if (!record || typeof record !== 'object') {
    body = <Alert type="warning" showIcon message="No data found for this resource" />;
  } else {
    body = (
      <Descriptions bordered column={1}>
        {Object.entries(record).map(([key, value]) => (
          <Descriptions.Item key={key} label={formatLabel(key)}>
            {renderValue(value, key)}
          </Descriptions.Item>
        ))}
      </Descriptions>
    );
  }

  return (
    <Card
      data-testid="agul-detail-view"
      title={
        <Space>
          {(resource.paths.list || resource.idParam) && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
              data-testid="agul-detail-back"
            />
          )}
          {detail.summary ?? resource.label}
        </Space>
      }
      extra={
        record && (
          <Space>
            {resource.paths.edit && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(buildRouterPath(resource.paths.edit!, params), { state: { record } })}
              >
                Edit
              </Button>
            )}
            {resource.remove && (
              <Popconfirm
                title="Are you sure you want to delete this item?"
                onConfirm={handleDelete}
                okText="Yes"
                cancelText="No"
              >
                <Button danger icon={<DeleteOutlined />}>
                  Delete
                </Button>
              </Popconfirm>
            )}
          </Space>
        )
      }
    >
      {body}
    </Card>
  );
};

function renderValue(value: unknown, key: string): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#999' }}>-</span>;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'string') {
    if (isImageUrl(value)) {
      return <img src={value} alt={key} style={{ maxWidth: 200, maxHeight: 200 }} />;
    }
    if (isHttpUrl(value)) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer">
          {value}
        </a>
      );
    }
    return value;
  }
  if (Array.isArray(value) && value.every((item) => typeof item !== 'object' || item === null)) {
    return value.map((item, index) => <Tag key={index}>{String(item)}</Tag>);
  }
  if (typeof value === 'object') {
    return <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(value, null, 2)}</pre>;
  }
  return String(value);
}
