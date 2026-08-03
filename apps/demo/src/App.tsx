/**
 * AGUL Demo App - showcases @agul/react library
 */

import { useState } from 'react';
import { Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { AGULRenderer } from '@agul/react';
import './App.css';

function App() {
  const [spec, setSpec] = useState<Record<string, unknown> | undefined>(undefined);
  const [specUrl, setSpecUrl] = useState<string | undefined>('/examples/petstore.json');

  const handleUpload = async (file: UploadFile) => {
    try {
      const text = await file.originFileObj?.text();
      if (!text) throw new Error('Failed to read file');

      setSpec(JSON.parse(text));
      setSpecUrl(undefined);
      message.success('OpenAPI spec loaded');
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Upload failed');
    }
    return false;
  };

  return (
    <div>
      <div className="demo-toolbar" data-testid="demo-toolbar">
        <Upload beforeUpload={handleUpload} accept=".json" showUploadList={false}>
          <Button icon={<UploadOutlined />}>Upload OpenAPI Spec</Button>
        </Upload>
        <Button
          onClick={() => {
            setSpec(undefined);
            setSpecUrl('/examples/petstore.json');
          }}
        >
          Reset to Petstore
        </Button>
        <Button
          onClick={() => {
            setSpec(undefined);
            setSpecUrl('/examples/jsonplaceholder.json');
          }}
        >
          JSONPlaceholder
        </Button>
      </div>

      <AGULRenderer spec={spec} specUrl={specUrl} />
    </div>
  );
}

export default App;
