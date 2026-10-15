import React from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  DatePicker,
  Button,
  Space,
  message,
  Spin,
  Alert,
  type FormItemProps,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useLocation, useParams } from 'react-router-dom';
import useSWR from 'swr';
import dayjs, { type Dayjs } from 'dayjs';
import {
  buildApiUrl,
  buildRouterPath,
  type Resource,
  type SchemaObject,
} from '@agul/core';
import { useAgulPlugins } from '../plugins/PluginContext.js';
import { readWizardConfig } from '../plugins/schema-extensions.js';
import { resolveFieldPlugin } from '../plugins/registry.js';
import type { AgulFieldPlugin } from '../plugins/types.js';
import { useAgulFetcher, useAgulNavigate, useAgulRuntime, useRevalidateList } from '../runtime.js';
import { FormWizardLayout } from './FormWizardLayout.js';
import { formatLabel, unwrapRecord } from './format.js';

type Row = Record<string, unknown>;
type NamePath = string[];

interface FormViewProps {
  resource: Resource;
  mode: 'create' | 'edit';
}

const SYSTEM_FIELDS = new Set(['id', '_id', 'createdAt', 'updatedAt', 'created_at', 'updated_at']);

export const FormView: React.FC<FormViewProps> = ({ resource, mode }) => {
  const isEdit = mode === 'edit';
  const operation = (isEdit ? resource.update : resource.create)!;
  const { baseUrl, http, schemas } = useAgulRuntime();
  const fetcher = useAgulFetcher();
  const navigate = useAgulNavigate();
  const revalidate = useRevalidateList(resource);
  const plugins = useAgulPlugins();
  const params = useParams();
  const location = useLocation();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = React.useState(false);

  const seedRecord = (location.state as { record?: Row } | null)?.record;
  const fetchUrl =
    isEdit && resource.detail ? buildApiUrl(baseUrl, resource.detail.apiEndpoint, params) : null;
  const { data, isLoading } = useSWR(fetchUrl, fetcher);
  const existing = (fetchUrl ? (unwrapRecord(data) as Row | undefined) : undefined) ?? seedRecord;

  const populated = React.useRef(false);
  React.useEffect(() => {
    if (existing && !populated.current) {
      populated.current = true;
      form.setFieldsValue(existing);
    }
  }, [existing, form]);

  const schema = operation.schema;
  const wizard = React.useMemo(() => (schema ? readWizardConfig(schema) : null), [schema]);

  const handleBack = () => {
    if (resource.paths.list) navigate(buildRouterPath(resource.paths.list, params));
    else navigate(-1);
  };

  const handleSubmit = async (values: Row) => {
    setSubmitting(true);
    const payload = isEdit ? { ...existing, ...values } : values;

    try {
      const url = buildApiUrl(baseUrl, operation.apiEndpoint, params);
      const response = await http.request({ url, method: operation.method, data: payload });
      message.success(isEdit ? 'Updated successfully' : 'Created successfully');
      await revalidate();

      if (resource.paths.list) {
        navigate(buildRouterPath(resource.paths.list, params));
        return;
      }

      const saved = unwrapRecord(response.data);
      const record = { ...payload, ...(saved && typeof saved === 'object' ? (saved as Row) : {}) };
      const detailPath = resource.paths.detail && buildRouterPath(resource.paths.detail, { ...params, ...record });
      if (detailPath && !detailPath.includes(':')) navigate(detailPath);
      else if (!isEdit) form.resetFields();
    } catch (err) {
      message.error(`${isEdit ? 'Update' : 'Create'} failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const renderFields = (visibleFields?: Set<string>) =>
    schema ? renderObjectFields(schema, [], { schemas, plugins, visibleFields, topLevel: true }) : [];

  if (isLoading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      data-testid="agul-form-view"
      title={
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack} />
          {operation.summary ?? `${isEdit ? 'Edit' : 'Create'} ${resource.label}`}
        </Space>
      }
    >
      {schema ? (
        <Form form={form} layout="vertical" preserve onFinish={handleSubmit} style={{ maxWidth: 800 }}>
          {wizard ? (
            <FormWizardLayout
              wizard={wizard}
              form={form}
              loading={submitting}
              isEdit={isEdit}
              onSubmit={() => form.submit()}
              onCancel={handleBack}
            >
              {(activeFields) => renderFields(activeFields)}
            </FormWizardLayout>
          ) : (
            <>
              {renderFields()}
              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={submitting}
                    data-testid="agul-form-submit"
                  >
                    {isEdit ? 'Update' : 'Create'}
                  </Button>
                  <Button onClick={handleBack}>Cancel</Button>
                </Space>
              </Form.Item>
            </>
          )}
        </Form>
      ) : (
        <Alert
          type="warning"
          showIcon
          message="No Schema Available"
          description="Cannot generate form without schema definition"
        />
      )}
    </Card>
  );
};

interface RenderOptions {
  schemas: Record<string, SchemaObject>;
  plugins: AgulFieldPlugin[];
  visibleFields?: Set<string>;
  topLevel: boolean;
}

function renderObjectFields(schema: SchemaObject, parentPath: NamePath, options: RenderOptions): React.ReactNode[] {
  const required = new Set(schema.required ?? []);

  return Object.entries(schema.properties ?? {}).flatMap<React.ReactNode>(([key, property]) => {
    if (property.readOnly || (options.topLevel && SYSTEM_FIELDS.has(key))) return [];

    const node = renderField([...parentPath, key], property, required.has(key), options);
    if (!node) return [];

    if (options.topLevel && options.visibleFields && !options.visibleFields.has(key)) {
      return [
        <div key={key} hidden>
          {node}
        </div>,
      ];
    }
    return [node];
  });
}

function renderField(
  namePath: NamePath,
  schema: SchemaObject,
  required: boolean,
  options: RenderOptions,
): React.ReactNode {
  const name = namePath[namePath.length - 1];
  const label = formatLabel(name);
  const key = namePath.join('.');

  if (options.topLevel) {
    const context = { name, schema, label, required, schemas: options.schemas };
    const plugin = resolveFieldPlugin(options.plugins, context);
    if (plugin) return <React.Fragment key={key}>{plugin.render(context)}</React.Fragment>;
  }

  if (schema.type === 'object' || schema.properties) {
    if (!schema.properties) return null;
    return (
      <fieldset key={key} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 16px', marginBottom: 24 }}>
        <legend style={{ width: 'auto', fontSize: 14, padding: '0 8px', margin: 0, border: 0 }}>{label}</legend>
        {renderObjectFields(schema, namePath, { ...options, topLevel: false, visibleFields: undefined })}
      </fieldset>
    );
  }

  if (schema.type === 'array' && schema.items && (schema.items.type === 'object' || schema.items.properties)) {
    return null;
  }

  const { rules: extraRules = [], ...behaviour } = fieldBehaviour(schema);
  const requiredRule = required && schema.type !== 'boolean' ? [{ required: true, message: `Please input ${label}` }] : [];

  return (
    <Form.Item
      key={key}
      name={namePath}
      label={namePath.length > 1 ? `${formatLabel(namePath[namePath.length - 2])} ${label.toLowerCase()}` : label}
      tooltip={schema.description}
      rules={[...requiredRule, ...extraRules]}
      {...behaviour}
    >
      {renderControl(schema, name, label)}
    </Form.Item>
  );
}

function fieldBehaviour(schema: SchemaObject): Partial<FormItemProps> {
  if (schema.type === 'boolean') {
    return { valuePropName: 'checked' };
  }
  if (schema.format === 'date' || schema.format === 'date-time') {
    return {
      getValueProps: (value: unknown) => ({ value: value ? dayjs(value as string) : undefined }),
      normalize: (value: Dayjs | null) =>
        value ? (schema.format === 'date' ? value.format('YYYY-MM-DD') : value.toISOString()) : undefined,
    };
  }
  if (schema.format === 'email') {
    return { rules: [{ type: 'email', message: 'Please enter a valid email' }] };
  }
  if (schema.format === 'uri' || schema.format === 'url') {
    return { rules: [{ type: 'url', message: 'Please enter a valid URL' }] };
  }
  return {};
}

function renderControl(schema: SchemaObject, name: string, label: string): React.ReactNode {
  const enumOptions = (values: unknown[]) => values.map((value) => ({ label: String(value), value }));

  switch (schema.type) {
    case 'integer':
    case 'number':
      return (
        <InputNumber
          style={{ width: '100%' }}
          placeholder={`Enter ${label}`}
          precision={schema.type === 'integer' ? 0 : undefined}
        />
      );
    case 'boolean':
      return <Switch />;
    case 'array':
      return schema.items?.enum ? (
        <Select mode="multiple" placeholder={`Select ${label}`} options={enumOptions(schema.items.enum)} />
      ) : (
        <Select mode="tags" placeholder={`Enter ${label}`} open={false} />
      );
  }

  if (schema.enum) {
    return <Select placeholder={`Select ${label}`} options={enumOptions(schema.enum)} />;
  }
  if (schema.format === 'date' || schema.format === 'date-time') {
    return <DatePicker style={{ width: '100%' }} showTime={schema.format === 'date-time'} />;
  }
  if (/description|comment|notes?|bio|body|content/i.test(name)) {
    return <Input.TextArea rows={4} placeholder={`Enter ${label}`} />;
  }
  return <Input placeholder={`Enter ${label}`} type={schema.format === 'password' ? 'password' : undefined} />;
}
