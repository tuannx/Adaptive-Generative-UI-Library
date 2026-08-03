import { ColorPicker, Form } from 'antd';
import type { AgulFieldPlugin } from '@agul/react';

export const colorPickerPlugin: AgulFieldPlugin = {
  id: 'color-picker',
  widget: 'color-picker',
  render: ({ name, label, required }) => (
    <Form.Item
      key={name}
      name={name}
      label={label}
      rules={required ? [{ required: true, message: `Please pick ${label}` }] : []}
      getValueFromEvent={(color) => color.toHexString()}
    >
      <ColorPicker data-testid={`agul-plugin-color-picker-${name}`} showText />
    </Form.Item>
  ),
};
