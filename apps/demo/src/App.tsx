/**
 * AGUL Demo App - showcases @agul/react library
 */

import { useState } from 'react';
import { Upload, Button, Input, Switch, Tooltip, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { AGULRenderer, parseSpecText } from '@agul/react';
import { demoFieldPlugins } from './plugins/index.js';
import './App.css';

const PROXY_PREFIX = import.meta.env.VITE_AGUL_PROXY;

function readQueryParam(name: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return new URLSearchParams(window.location.search).get(name) ?? undefined;
}

function rememberSpecUrl(url: string | undefined): void {
  const params = new URLSearchParams(window.location.search);
  if (url && !url.startsWith('/examples/')) params.set('spec', url);
  else params.delete('spec');
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

function App() {
  const [spec, setSpec] = useState<Record<string, unknown> | undefined>(undefined);
  const [specUrl, setSpecUrlState] = useState<string | undefined>(
    () => readQueryParam('spec') ?? '/examples/petstore.json',
  );
  const [token, setToken] = useState(() => readQueryParam('token') ?? '');
  const [useProxy, setUseProxy] = useState(() => !!PROXY_PREFIX && readQueryParam('proxy') !== '0');

  const setSpecUrl = (url: string | undefined) => {
    rememberSpecUrl(url);
    setSpecUrlState(url);
  };

  const handleUpload = async (file: UploadFile) => {
    try {
      const text = await file.originFileObj?.text();
      if (!text) throw new Error('Failed to read file');

      setSpec(await parseSpecText(text));
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
        <Input.Search
          placeholder="Paste OpenAPI spec URL (JSON or YAML)"
          enterButton="Load"
          allowClear
          data-testid="demo-spec-url"
          style={{ width: 380 }}
          onSearch={(value) => {
            const url = value.trim();
            if (!url) return;
            setSpec(undefined);
            setSpecUrl(url);
          }}
        />
        <Upload beforeUpload={handleUpload} accept=".json,.yaml,.yml" showUploadList={false}>
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
          data-testid="demo-load-plugins-spec"
          onClick={() => {
            setSpec(undefined);
            setSpecUrl('/examples/petstore-plugins.json');
          }}
        >
          Plugins + Wizard
        </Button>
        <Button
          onClick={() => {
            setSpec(undefined);
            setSpecUrl('/examples/jsonplaceholder.json');
          }}
        >
          JSONPlaceholder
        </Button>
        <Input.Password
          placeholder="Bearer token (mock)"
          value={token}
          data-testid="demo-auth-token"
          onChange={(event) => setToken(event.target.value)}
          style={{ width: 220 }}
        />
        {PROXY_PREFIX && (
          <Tooltip title="Send API calls through this site's /proxy/ route (for APIs without CORS). Only hosts allowed in the Worker's PROXY_ALLOWED_HOSTS are forwarded.">
            <span>
              <Switch
                checked={useProxy}
                onChange={setUseProxy}
                data-testid="demo-use-proxy"
                checkedChildren="Proxy"
                unCheckedChildren="Direct"
              />
            </span>
          </Tooltip>
        )}
      </div>

      <AGULRenderer
        spec={spec}
        specUrl={specUrl}
        token={token || undefined}
        proxyUrl={useProxy ? PROXY_PREFIX : undefined}
        plugins={demoFieldPlugins}
      />
    </div>
  );
}

export default App;
