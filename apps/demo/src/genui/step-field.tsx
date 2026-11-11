import { Form, Input, Segmented, Select, Switch } from 'antd';
import type { SchemaObject } from '@aikitstudio/agul-react';

/** One editable field inside an app step: enum, multi-enum, boolean, text or long text. */
export function StepField({ path, schema, disabled }: { path: (string | number)[]; schema: SchemaObject; disabled: boolean }) {
  const label = schema.title ?? String(path[path.length - 1]);
  const options = (values: unknown[]) => values.map((value) => ({ label: String(value), value: String(value) }));

  if (schema.type === 'boolean') {
    return (
      <Form.Item name={path} label={label} valuePropName="checked">
        <Switch disabled={disabled} />
      </Form.Item>
    );
  }
  if (schema.type === 'array' && schema.items?.enum) {
    return (
      <Form.Item name={path} label={label}>
        <Select mode="multiple" disabled={disabled} options={options(schema.items.enum)} />
      </Form.Item>
    );
  }
  if (schema.enum) {
    // few short options read faster as a segmented control than as a dropdown
    const short = schema.enum.length <= 3 && schema.enum.every((value) => String(value).length <= 20);
    return (
      <Form.Item name={path} label={label}>
        {short ? <Segmented disabled={disabled} options={options(schema.enum)} /> : <Select disabled={disabled} options={options(schema.enum)} />}
      </Form.Item>
    );
  }
  const long = (schema as Record<string, unknown>)['x-agul-widget'] === 'textarea';
  return (
    <Form.Item name={path} label={label}>
      {long ? <Input.TextArea disabled={disabled} autoSize={{ minRows: 2, maxRows: 5 }} /> : <Input disabled={disabled} />}
    </Form.Item>
  );
}
