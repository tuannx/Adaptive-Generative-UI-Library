import { Card, Form, Space, Switch, Typography } from 'antd';
import type { AgulFieldRenderContext, SchemaObject } from '@aikitstudio/agul-react';
import { StepField } from './step-field.js';

interface AppInfo {
  name: string;
  icon: string;
}

function readApp(schema: SchemaObject): AppInfo {
  const raw = (schema as Record<string, unknown>)['x-agul-app'];
  const app = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { name: typeof app.name === 'string' ? app.name : 'App', icon: typeof app.icon === 'string' ? app.icon : '•' };
}

/** A card per app: its name, an on/off switch and the fields the agent filled in. */
export function AppStep({ context }: { context: AgulFieldRenderContext }) {
  const { name, schema } = context;
  const app = readApp(schema);
  const form = Form.useFormInstance();
  const included = Form.useWatch([name, 'include'], form) !== false;
  const fields = Object.entries(schema.properties ?? {}).filter(([key]) => key !== 'include');

  return (
    <Card
      size="small"
      className={`genui-step${included ? '' : ' genui-step--off'}`}
      data-testid={`genui-step-${name}`}
      title={
        <Space size={8}>
          <span className="genui-step__icon" aria-hidden>{app.icon}</span>
          <span>{schema.title ?? context.label}</span>
          <Typography.Text type="secondary" className="genui-step__app">{app.name}</Typography.Text>
        </Space>
      }
      extra={
        <Form.Item name={[name, 'include']} valuePropName="checked" noStyle>
          <Switch size="small" aria-label={`Include: ${schema.title ?? context.label}`} />
        </Form.Item>
      }
    >
      {fields.map(([key, field]) => (
        <StepField key={key} path={[name, key]} schema={field} disabled={!included} />
      ))}
    </Card>
  );
}
