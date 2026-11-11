import React from 'react';
import { Alert, Button, Card, Divider, Form, Input, InputNumber, Select, Space, Switch, Tag, Typography } from 'antd';
import { CaretRightOutlined, StopOutlined } from '@ant-design/icons';
import { useSWRConfig } from 'swr';
import { buildApiUrl, type OperationPage, type ParameterObject, type SchemaObject } from '@aikitstudio/agul-core';
import { useAgulPlugins } from '../plugins/PluginContext.js';
import { encodeBody } from '../http/encode.js';
import { readStream } from '../http/stream.js';
import { describeApiError, responseError } from '../http/errors.js';
import { useAgulRuntime } from '../runtime.js';
import { renderSchemaFields, schemaDefaults } from './FormView.js';
import { formatLabel } from './format.js';
import { ResultView } from './ResultView.js';

type Values = Record<string, unknown>;

const METHOD_COLORS: Record<string, string> = { get: 'blue', post: 'green', put: 'orange', patch: 'gold', delete: 'red' };

function splitParams(page: OperationPage, values: Values) {
  const pathParams: Record<string, string> = {};
  const query = new URLSearchParams();
  for (const param of page.parameters) {
    const value = (values.__params as Values | undefined)?.[param.name];
    if (value === undefined || value === null || value === '') continue;
    if (param.in === 'path') pathParams[param.name] = String(value);
    if (param.in === 'query') {
      for (const item of Array.isArray(value) ? value : [value]) query.append(param.name, String(item));
    }
  }
  return { pathParams, query: query.toString() };
}

function headerParams(page: OperationPage, values: Values): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const param of page.parameters) {
    const value = (values.__params as Values | undefined)?.[param.name];
    if (param.in === 'header' && value !== undefined && value !== '') headers[param.name] = String(value);
  }
  return headers;
}

function ParamField({ param }: { param: ParameterObject }) {
  const schema: SchemaObject = param.schema ?? (param as unknown as SchemaObject);
  const label = (
    <span>
      {formatLabel(param.name)} <Typography.Text type="secondary">({param.in})</Typography.Text>
    </span>
  );
  const enumValues = schema.enum ?? schema.items?.enum;
  const control = enumValues ? (
    <Select
      allowClear
      mode={schema.type === 'array' ? 'multiple' : undefined}
      options={enumValues.map((value) => ({ value, label: String(value) }))}
    />
  ) : schema.type === 'integer' || schema.type === 'number' ? (
    <InputNumber style={{ width: '100%' }} />
  ) : schema.type === 'boolean' ? (
    <Switch />
  ) : (
    <Input type={/password|secret|token/i.test(param.name) ? 'password' : undefined} />
  );

  return (
    <Form.Item
      name={['__params', param.name]}
      label={label}
      tooltip={param.description}
      initialValue={schema.default}
      valuePropName={schema.type === 'boolean' ? 'checked' : undefined}
      rules={[{ required: !!param.required, message: `Please input ${formatLabel(param.name)}` }]}
    >
      {control}
    </Form.Item>
  );
}

/** A form for any operation: parameters + request body in, result (or a live stream) out. */
export function ActionView({ page }: { page: OperationPage }) {
  const { baseUrl, schemas, fetch: agulFetch } = useAgulRuntime();
  const plugins = useAgulPlugins();
  const { mutate } = useSWRConfig();
  const [form] = Form.useForm<Values>();
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<{ status: number; value: unknown } | null>(null);
  const [streamed, setStreamed] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const visibleParams = page.parameters.filter((param) => param.in !== 'cookie');
  const hasBodyFields = Object.keys(page.body?.properties ?? {}).length > 0;

  const run = async (values: Values) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setResult(null);
    setStreamed(null);

    try {
      const { pathParams, query } = splitParams(page, values);
      const url = `${buildApiUrl(baseUrl, page.apiEndpoint, pathParams)}${query ? `?${query}` : ''}`;
      const { __params: _ignored, ...bodyValues } = values;
      const hasBody = page.method !== 'get' && page.method !== 'delete' && (hasBodyFields || page.body);
      const contentType = page.contentType ?? 'application/json';
      const encoded = hasBody ? encodeBody(bodyValues, contentType) : undefined;

      const headers: Record<string, string> = { ...headerParams(page, values) };
      if (encoded !== undefined && !contentType.startsWith('multipart/')) headers['Content-Type'] = contentType;
      if (page.stream === 'sse') headers.Accept = 'text/event-stream';

      const response = await agulFetch(url, {
        method: page.method.toUpperCase(),
        headers,
        body: encoded === undefined ? undefined : typeof encoded === 'string' || encoded instanceof FormData ? encoded : JSON.stringify(encoded),
        signal: controller.signal,
      });

      const responseType = response.headers.get('content-type') ?? '';
      const streaming = page.stream !== 'none' || /event-stream|ndjson/.test(responseType);
      if (!response.ok) {
        const failure = await responseError(response);
        if (failure.info.fieldErrors.length > 0) {
          form.setFields(failure.info.fieldErrors.map((field) => ({ name: field.name, errors: field.errors })));
        }
        throw failure;
      }
      if (page.method !== 'get') {
        // an action can change any resource: drop cached lists and records so they refetch
        void mutate(() => true);
      }

      if (streaming) {
        setStreamed('');
        const format = responseType.includes('event-stream') ? 'sse' : responseType.includes('ndjson') ? 'ndjson' : page.stream;
        await readStream(response, format === 'none' ? 'text' : format, {
          onText: (text) => setStreamed((current) => (current ?? '') + text),
        });
      } else {
        const text = await response.text();
        let value: unknown = text;
        try {
          value = text ? JSON.parse(text) : undefined;
        } catch {
          // plain-text response
        }
        setResult({ status: response.status, value });
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(describeApiError(err).message);
    } finally {
      if (abortRef.current === controller) setRunning(false);
    }
  };

  return (
    <Card
      data-testid="agul-action-view"
      title={
        <Space>
          <Tag color={METHOD_COLORS[page.method]}>{page.method.toUpperCase()}</Tag>
          {page.label}
        </Space>
      }
      extra={<Typography.Text type="secondary" code>{page.apiEndpoint}</Typography.Text>}
    >
      {page.description && <Typography.Paragraph type="secondary">{page.description}</Typography.Paragraph>}
      <Form form={form} layout="vertical" onFinish={run} initialValues={schemaDefaults(page.body)} style={{ maxWidth: 800 }}>
        {visibleParams.map((param) => (
          <ParamField key={`${param.in}:${param.name}`} param={param} />
        ))}
        {hasBodyFields && page.body && renderSchemaFields(page.body, { schemas, plugins })}
        <Space>
          <Button type="primary" htmlType="submit" icon={<CaretRightOutlined />} loading={running} data-testid="agul-action-run">
            {page.submitLabel ?? 'Run'}
          </Button>
          {running && (
            <Button icon={<StopOutlined />} onClick={() => abortRef.current?.abort()}>
              Stop
            </Button>
          )}
        </Space>
      </Form>

      {(result || streamed !== null || error) && <Divider />}
      {error && <Alert type="error" showIcon title="Request failed" description={error} />}
      {streamed !== null && (
        <Typography.Paragraph data-testid="agul-action-stream" style={{ whiteSpace: 'pre-wrap' }}>
          {streamed}
          {running && <span className="agul-caret">▍</span>}
        </Typography.Paragraph>
      )}
      {result && (
        <div data-testid="agul-action-result">
          <Typography.Text type="secondary">HTTP {result.status}</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <ResultView value={result.value} />
          </div>
        </div>
      )}
    </Card>
  );
}
