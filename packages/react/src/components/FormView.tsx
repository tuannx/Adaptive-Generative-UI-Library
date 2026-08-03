/**
 * FormView Component - Form for creating/editing resources
 */

import React, { useEffect } from 'react';
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
  Alert
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import { agulHttp, agulFetcher } from '../http/client.js';
import type { RouteConfig, SchemaObject } from '@agul/core';
import { routesShareResource } from '@agul/core';
import { useAgulPlugins } from '../plugins/PluginContext.js';
import { readWizardConfig } from '../plugins/schema-extensions.js';
import { resolveFieldPlugin } from '../plugins/registry.js';
import type { AgulFieldPlugin } from '../plugins/types.js';
import { FormWizardLayout } from './FormWizardLayout.js';

interface FormViewProps {
  route: RouteConfig;
  baseUrl: string;
  allRoutes: RouteConfig[];
  schemas: Record<string, SchemaObject>;
}

const fetcher = agulFetcher;

export const FormView: React.FC<FormViewProps> = ({ route, baseUrl, allRoutes, schemas }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const plugins = useAgulPlugins();

  const isEdit = route.component === 'edit';
  const seedRecord = (location.state as { record?: Record<string, unknown> } | null)?.record;

  // For edit mode, fetch existing data when route has path params
  const detailRoute = isEdit ? allRoutes.find(r =>
    r.component === 'detail' &&
    routesShareResource(r.apiEndpoint, route.apiEndpoint)
  ) : null;

  let fetchUrl: string | null = null;
  if (isEdit && detailRoute && Object.keys(params).length > 0) {
    fetchUrl = `${baseUrl}${detailRoute.apiEndpoint}`;
    Object.entries(params).forEach(([key, value]) => {
      fetchUrl = fetchUrl!.replace(`{${key}}`, value || '');
    });
  }

  const { data: existingData, isLoading: loadingData } = useSWR(
    fetchUrl,
    fetchUrl ? fetcher : null
  );

  // Populate form with existing data
  useEffect(() => {
    if (existingData) {
      const data = existingData.data || existingData;
      form.setFieldsValue(data);
    }
  }, [existingData, form]);

  useEffect(() => {
    if (seedRecord) {
      form.setFieldsValue(seedRecord);
    }
  }, [seedRecord, form]);

  const listRoute = allRoutes.find(r =>
    r.component === 'list' &&
    routesShareResource(route.apiEndpoint, r.apiEndpoint)
  );

  const handleSubmit = async (values: any) => {
    setLoading(true);

    const payload = isEdit && seedRecord ? { ...seedRecord, ...values } : values;

    try {
      // Build API URL
      let apiUrl = `${baseUrl}${route.apiEndpoint}`;
      Object.entries(params).forEach(([key, value]) => {
        apiUrl = apiUrl.replace(`{${key}}`, value || '');
      });

      // Send request
      if (isEdit) {
        await agulHttp.put(apiUrl, payload);
        message.success('Updated successfully');
      } else {
        await agulHttp.post(apiUrl, payload);
        message.success('Created successfully');
      }

      // Navigate back to list
      if (listRoute) {
        const listPrefix = `${baseUrl}${listRoute.apiEndpoint}`;
        await mutate((key) => typeof key === 'string' && key.startsWith(listPrefix));
        navigate(listRoute.path);
      } else {
        navigate(-1);
      }
    } catch (err: any) {
      message.error(`${isEdit ? 'Update' : 'Create'} failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (listRoute) {
      navigate(listRoute.path);
    } else {
      navigate(-1);
    }
  };

  // Generate form fields from schema
  const resolvedSchema = React.useMemo(
    () => resolveSchema(route.schema, schemas),
    [route.schema, schemas],
  );
  const wizardConfig = React.useMemo(
    () => (resolvedSchema ? readWizardConfig(resolvedSchema) : null),
    [resolvedSchema],
  );

  const renderFields = (fieldFilter?: Set<string>) => {
    if (!resolvedSchema) return [];

    return generateFormFields(resolvedSchema, schemas, plugins, fieldFilter);
  };

  const submitForm = () => {
    form.submit();
  };

  if (loadingData) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px' }}>
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
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
          />
          {isEdit ? 'Edit' : 'Create New'} {route.summary || ''}
        </Space>
      }
    >
      {resolvedSchema && Object.keys(resolvedSchema.properties ?? {}).length > 0 ? (
        <Form
          form={form}
          layout="vertical"
          preserve
          onFinish={handleSubmit}
          style={{ maxWidth: '800px' }}
        >
          {wizardConfig ? (
            <FormWizardLayout
              wizard={wizardConfig}
              form={form}
              loading={loading}
              isEdit={isEdit}
              onSubmit={submitForm}
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
                    loading={loading}
                    data-testid="agul-form-submit"
                  >
                    {isEdit ? 'Update' : 'Create'}
                  </Button>
                  <Button onClick={handleBack}>
                    Cancel
                  </Button>
                </Space>
              </Form.Item>
            </>
          )}
        </Form>
      ) : (
        <Alert
          message="No Schema Available"
          description="Cannot generate form without schema definition"
          type="warning"
          showIcon
        />
      )}
    </Card>
  );
};

function resolveSchema(
  schema: SchemaObject | undefined,
  schemas: Record<string, SchemaObject>,
): SchemaObject | null {
  if (!schema) return null;

  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    if (refName && schemas[refName]) {
      return schemas[refName];
    }
  }

  return schema;
}

/**
 * Generate form fields from schema
 */
function generateFormFields(
  schema: SchemaObject,
  schemas: Record<string, SchemaObject>,
  plugins: AgulFieldPlugin[],
  visibleFields?: Set<string>,
): React.ReactNode[] {
  const fields: React.ReactNode[] = [];

  if (!schema.properties) {
    return fields;
  }

  const required = schema.required || [];

  Object.entries(schema.properties).forEach(([key, prop]) => {
    const isRequired = required.includes(key);
    const label = formatLabel(key);

    if (key === 'id' || key === '_id' || key === 'createdAt' || key === 'updatedAt') {
      return;
    }

    const fieldNode = generateField(key, prop, label, isRequired, schemas, plugins);
    if (!fieldNode) {
      return;
    }

    if (visibleFields && !visibleFields.has(key)) {
      fields.push(
        <div key={key} hidden>
          {fieldNode}
        </div>,
      );
      return;
    }

    fields.push(fieldNode);
  });

  return fields;
}

/**
 * Generate a single form field based on type
 */
function generateField(
  name: string,
  schema: SchemaObject,
  label: string,
  required: boolean,
  schemas: Record<string, SchemaObject>,
  plugins: AgulFieldPlugin[],
): React.ReactNode {
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    if (refName && schemas[refName]) {
      schema = schemas[refName];
    }
  }

  const plugin = resolveFieldPlugin(plugins, {
    name,
    schema,
    label,
    required,
    schemas,
  });

  if (plugin) {
    return <React.Fragment key={name}>{plugin.render({ name, schema, label, required, schemas })}</React.Fragment>;
  }

  const rules = [
    { required, message: `Please input ${label}` }
  ];

  const type = schema.type || 'string';
  const format = schema.format;

  switch (type) {
    case 'integer':
    case 'number':
      return (
        <Form.Item
          key={name}
          name={name}
          label={label}
          rules={rules}
          tooltip={schema.description}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder={`Enter ${label}`}
          />
        </Form.Item>
      );

    case 'boolean':
      return (
        <Form.Item
          key={name}
          name={name}
          label={label}
          valuePropName="checked"
          tooltip={schema.description}
        >
          <Switch />
        </Form.Item>
      );

    case 'array':
      if (schema.items?.enum) {
        return (
          <Form.Item
            key={name}
            name={name}
            label={label}
            rules={rules}
            tooltip={schema.description}
          >
            <Select
              mode="multiple"
              placeholder={`Select ${label}`}
              options={schema.items.enum.map(v => ({ label: v, value: v }))}
            />
          </Form.Item>
        );
      }
      return (
        <Form.Item
          key={name}
          name={name}
          label={label}
          rules={rules}
          tooltip={schema.description}
        >
          <Select
            mode="tags"
            placeholder={`Enter ${label}`}
          />
        </Form.Item>
      );

    case 'string':
      // Handle enum
      if (schema.enum) {
        return (
          <Form.Item
            key={name}
            name={name}
            label={label}
            rules={rules}
            tooltip={schema.description}
          >
            <Select
              placeholder={`Select ${label}`}
              options={schema.enum.map(v => ({ label: v, value: v }))}
            />
          </Form.Item>
        );
      }

      // Handle format
      if (format === 'date' || format === 'date-time') {
        return (
          <Form.Item
            key={name}
            name={name}
            label={label}
            rules={rules}
            tooltip={schema.description}
          >
            <DatePicker
              style={{ width: '100%' }}
              showTime={format === 'date-time'}
            />
          </Form.Item>
        );
      }

      if (format === 'email') {
        return (
          <Form.Item
            key={name}
            name={name}
            label={label}
            rules={[
              ...rules,
              { type: 'email', message: 'Please enter a valid email' }
            ]}
            tooltip={schema.description}
          >
            <Input placeholder={`Enter ${label}`} />
          </Form.Item>
        );
      }

      if (format === 'uri' || format === 'url') {
        return (
          <Form.Item
            key={name}
            name={name}
            label={label}
            rules={[
              ...rules,
              { type: 'url', message: 'Please enter a valid URL' }
            ]}
            tooltip={schema.description}
          >
            <Input placeholder={`Enter ${label}`} />
          </Form.Item>
        );
      }

      // Text area for long strings
      if (schema.description?.toLowerCase().includes('description') ||
          name.toLowerCase().includes('description') ||
          name.toLowerCase().includes('comment')) {
        return (
          <Form.Item
            key={name}
            name={name}
            label={label}
            rules={rules}
            tooltip={schema.description}
          >
            <Input.TextArea
              rows={4}
              placeholder={`Enter ${label}`}
            />
          </Form.Item>
        );
      }

      // Default to input
      return (
        <Form.Item
          key={name}
          name={name}
          label={label}
          rules={rules}
          tooltip={schema.description}
        >
          <Input placeholder={`Enter ${label}`} />
        </Form.Item>
      );

    default:
      return (
        <Form.Item
          key={name}
          name={name}
          label={label}
          rules={rules}
          tooltip={schema.description}
        >
          <Input placeholder={`Enter ${label}`} />
        </Form.Item>
      );
  }
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}
