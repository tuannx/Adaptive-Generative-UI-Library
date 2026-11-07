import { Form, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { AgulFieldPlugin } from '@ai-kit/agul-react';

function toUploadFileList(value: unknown): UploadFile[] {
  const urls = Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  return urls.map((url, index) => ({
    uid: `${index}`,
    name: `image-${index + 1}`,
    status: 'done',
    url,
  }));
}

function fromUploadFileList(fileList: UploadFile[]): string[] {
  return fileList
    .map((file) => file.url ?? file.thumbUrl)
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
}

function ImageUploadInput({
  value,
  onChange,
  testId,
}: {
  value?: string[];
  onChange?: (value: string[]) => void;
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <Upload
        listType="picture-card"
        fileList={toUploadFileList(value)}
        beforeUpload={(file) => {
          const uploadFile = file as UploadFile;
          uploadFile.url = URL.createObjectURL(file);
          uploadFile.status = 'done';
          return false;
        }}
        onChange={({ fileList }) => onChange?.(fromUploadFileList(fileList))}
      >
        <button type="button" style={{ border: 0, background: 'none' }}>
          <PlusOutlined />
          <div style={{ marginTop: 8 }}>Upload</div>
        </button>
      </Upload>
    </div>
  );
}

export const imageUploadPlugin: AgulFieldPlugin = {
  id: 'image-upload',
  widget: 'image-upload',
  render: ({ name, label, required }) => (
    <Form.Item
      key={name}
      name={name}
      label={label}
      rules={required ? [{ required: true, message: `Please upload ${label}` }] : []}
    >
      <ImageUploadInput testId={`agul-plugin-image-upload-${name}`} />
    </Form.Item>
  ),
};
