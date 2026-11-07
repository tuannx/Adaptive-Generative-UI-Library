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
  Alert,
    Skeleton,
  type FormItemProps,
  App,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useLocation, useParams } from 'react-router-dom';
import useSWR from 'swr';
import dayjs, { type Dayjs } from 'dayjs';
import {
  buildApiUrl,
  buildRouterPath,
  type Resource,
  type SchemaObject,
} from '@aikitstudio/agul-core';
import { useAgulPlugins } from '../plugins/PluginContext.js';
import { readWizardConfig } from '../plugins/schema-extensions.js';
import { resolveFieldPlugin } from '../plugins/registry.js';
import type { AgulFieldPlugin } from '../plugins/types.js';
import { useAgulFetcher, useAgulNavigate, useAgulRuntime, useRevalidateList } from '../runtime.js';
import { FormWizardLayout } from './FormWizardLayout.js';
import { encodeBody } from '../http/encode.js';
import { describeApiError } from '../http/errors.js';
import { formatLabel, unwrapRecord } from './format.js';

type Row = Record<string, unknown>;
type NamePath = (string | number)[];

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
  const { message, modal } = App.useApp();
  const [submitting, setSubmitting] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  useLeaveGuard(dirty);

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

  const leave = () => {
    if (resource.paths.list) navigate(buildRouterPath(resource.paths.list, params));
    else navigate(-1);
  };

  const handleBack = () => {
    if (!dirty) return leave();
    modal.confirm({
      title: 'Discard your changes?',
      content: "What you typed in this form hasn't been saved.",
      okText: 'Discard',
      okButtonProps: { danger: true },
      cancelText: 'Keep editing',
      onOk: () => {
        setDirty(false);
        leave();
      },
    });
  };

  const handleSubmit = async (values: Row) => {
    setSubmitting(true);
    const payload = isEdit ? { ...existing, ...values } : values;

    try {
      const url = buildApiUrl(baseUrl, operation.apiEndpoint, params);
      const response = await http.request({
        url,
        method: operation.method,
        data: encodeBody(payload, operation.contentType),
        headers: operation.contentType && !operation.contentType.startsWith('multipart/')
          ? { 'Content-Type': operation.contentType }
          : undefined,
      });
      message.success(isEdit ? 'Updated successfully' : 'Created successfully');
      setDirty(false);
      await revalidate(params);

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
      const info = describeApiError(err);
      if (info.fieldErrors.length > 0) {
        form.setFields(info.fieldErrors.map((field) => ({ name: field.name, errors: field.errors })));
        form.scrollToField(info.fieldErrors[0].name);
      }
      message.error(`${isEdit ? 'Update' : 'Create'} failed — ${info.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const renderFields = (visibleFields?: Set<string>) =>
    schema ? renderObjectFields(schema, [], { schemas, plugins, visibleFields, topLevel: true }) : [];

  if (isLoading && !existing) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
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
        <Form
          form={form}
          layout="vertical"
          preserve
          onFinish={handleSubmit}
          onValuesChange={() => setDirty(true)}
          scrollToFirstError
          initialValues={isEdit ? undefined : schemaDefaults(schema)}
          style={{ maxWidth: 800 }}
        >
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
          title="No Schema Available"
          description="Cannot generate form without schema definition"
        />
      )}
    </Card>
  );
};

/** Asks before closing or reloading the tab while a form has unsaved changes. */
function useLeaveGuard(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}

/** `default` values of an object schema's properties (nested objects included), as form initial values. */
export function schemaDefaults(schema: SchemaObject | undefined): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, property] of Object.entries(schema?.properties ?? {})) {
    if (property.default !== undefined) values[key] = property.default;
    else if (property.properties) {
      const nested = schemaDefaults(property);
      if (Object.keys(nested).length > 0) values[key] = nested;
    }
  }
  return values;
}

/** Form fields for an object schema (nested objects as fieldsets, field plugins applied at the top level). */
export function renderSchemaFields(
  schema: SchemaObject,
  options: { schemas: Record<string, SchemaObject>; plugins: AgulFieldPlugin[] },
): React.ReactNode[] {
  return renderObjectFields(schema, [], { ...options, topLevel: true });
}

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
  const name = String(namePath[namePath.length - 1]);
  const label = formatLabel(name);
  const key = namePath.join('.');
  const parent = namePath[namePath.length - 2];

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
    const itemSchema = schema.items;
    if (!itemSchema.properties) return null;
    const itemLabel = label.replace(/s$/i, '') || label;
    return (
      <Form.List key={key} name={namePath}>
        {(fields, { add, remove }) => (
          <fieldset
            data-testid={`agul-form-list-${key}`}
            style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 16px', marginBottom: 24 }}
          >
            <legend style={{ width: 'auto', fontSize: 14, padding: '0 8px', margin: 0, border: 0 }}>
              {label} {fields.length > 0 && <span style={{ color: '#999' }}>({fields.length})</span>}
            </legend>
            {fields.map((field, index) => (
              <div key={field.key} style={{ borderBottom: '1px dashed #f0f0f0', marginBottom: 12, paddingBottom: 4 }}>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#666' }}>
                    {itemLabel} #{index + 1}
                  </span>
                  <Button type="text" danger size="small" icon={<MinusCircleOutlined />} onClick={() => remove(field.name)}>
                    Remove
                  </Button>
                </Space>
                {renderObjectFields(itemSchema, [field.name], { ...options, topLevel: false, visibleFields: undefined })}
              </div>
            ))}
            <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add(schemaDefaults(itemSchema))} style={{ marginBottom: 12 }}>
              Add {itemLabel.toLowerCase()}
            </Button>
          </fieldset>
        )}
      </Form.List>
    );
  }

  const { rules: extraRules = [], ...behaviour } = fieldBehaviour(schema);
  const requiredRule = required && schema.type !== 'boolean' ? [{ required: true, message: `Please input ${label}` }] : [];

  return (
    <Form.Item
      key={key}
      name={namePath}
      label={typeof parent === 'string' ? `${formatLabel(parent)} ${label.toLowerCase()}` : label}
      tooltip={schema.description}
      rules={[...requiredRule, ...constraintRules(schema, label), ...extraRules]}
      {...behaviour}
    >
      {renderControl(schema, name, label)}
    </Form.Item>
  );
}

/** Validation rules from JSON Schema constraints (`minLength`, `pattern`, `minimum`, ...). */
function constraintRules(schema: SchemaObject, label: string): NonNullable<FormItemProps['rules']> {
  const rules: NonNullable<FormItemProps['rules']> = [];
  if (schema.type === 'string' || (!schema.type && (schema.minLength !== undefined || schema.maxLength !== undefined))) {
    if (schema.minLength !== undefined) rules.push({ min: schema.minLength, message: `${label} needs at least ${schema.minLength} characters` });
    if (schema.maxLength !== undefined) rules.push({ max: schema.maxLength, message: `${label} can have at most ${schema.maxLength} characters` });
  }
  if (schema.pattern) {
    try {
      rules.push({ pattern: new RegExp(schema.pattern), message: `${label} has the wrong format` });
    } catch {
      // a pattern JavaScript can't compile is left to the server
    }
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    if (schema.minimum !== undefined) rules.push({ type: 'number', min: schema.minimum, message: `${label} must be at least ${schema.minimum}` });
    if (schema.maximum !== undefined) rules.push({ type: 'number', max: schema.maximum, message: `${label} must be at most ${schema.maximum}` });
  }
  if (schema.type === 'array') {
    if (schema.minItems !== undefined) rules.push({ type: 'array', min: schema.minItems, message: `Pick at least ${schema.minItems}` });
    if (schema.maxItems !== undefined) rules.push({ type: 'array', max: schema.maxItems, message: `Pick at most ${schema.maxItems}` });
  }
  return rules;
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
          min={schema.minimum}
          max={schema.maximum}
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
  if (schema.format === 'password' || schema.writeOnly) return <Input.Password placeholder={`Enter ${label}`} autoComplete="new-password" />;
  return <Input placeholder={`Enter ${label}`} maxLength={schema.maxLength} showCount={!!schema.maxLength && schema.maxLength <= 500} />;
}
