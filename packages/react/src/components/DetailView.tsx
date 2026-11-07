import React from 'react';
import { Card, Descriptions, Button, Space, Popconfirm, Skeleton, Alert, App } from 'antd';
import { EditOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import { buildApiUrl, buildPathParamsFromRecord, buildRouterPath, planRecord, type Resource } from '@aikitstudio/agul-core';
import { useAgulFetcher, useAgulNavigate, useAgulRuntime, useRevalidateList } from '../runtime.js';
import { describeApiError } from '../http/errors.js';
import { formatLabel, unwrapRecord } from './format.js';
import { renderValue } from './values.js';
import { StatRow } from './present/StatRow.js';

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
  const { message } = App.useApp();

  const apiUrl = buildApiUrl(baseUrl, detail.apiEndpoint, params);
  const { data, error, isLoading, mutate } = useSWR(apiUrl, fetcher);
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
      await revalidate(params);
      handleBack();
    } catch (err) {
      message.error(`Delete failed — ${describeApiError(err).message}`);
    }
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = <Skeleton active paragraph={{ rows: 6 }} />;
  } else if (error) {
    body = (
      <Alert
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
    );
  } else if (!record || typeof record !== 'object') {
    body = <Alert type="warning" showIcon title="No data found for this resource" />;
  } else {
    const properties = resource.recordSchema?.properties;
    const { metrics } = planRecord(record, resource.recordSchema);
    const inStats = new Set(metrics.map((field) => field.key));
    body = (
      <>
        <StatRow record={record} metrics={metrics} />
        <Descriptions
          bordered
          column={1}
          items={Object.entries(record)
            .filter(([key]) => !inStats.has(key))
            .map(([key, value]) => ({
              key,
              label: formatLabel(key),
              children: renderValue(value, key, properties?.[key]),
            }))}
        />
      </>
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
                title="Delete this item?"
                description="This can't be undone."
                onConfirm={handleDelete}
                okText="Yes"
                okButtonProps={{ danger: true }}
                cancelText="No"
              >
                <Button danger icon={<DeleteOutlined />} data-testid="agul-detail-delete">
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
