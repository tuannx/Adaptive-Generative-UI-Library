/**
 * Main App Component - AGUL MVP
 * OpenAPI to React UI Generator
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin, Alert, Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';

import { parseOpenAPI } from './core/parser';
import { generateRoutes, groupRoutesByTag, generateMenu } from './core/generator';
import type { ParsedAPI, RouteConfig } from './core/types';

import { AppLayout } from './components/AppLayout';
import { ListView } from './components/ListView';
import { DetailView } from './components/DetailView';
import { FormView } from './components/FormView';

import './App.css';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parsedAPI, setParsedAPI] = useState<ParsedAPI | null>(null);
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [menu, setMenu] = useState<any[]>([]);

  // Load OpenAPI spec on mount
  useEffect(() => {
    loadDefaultSpec();
  }, []);

  const loadDefaultSpec = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load the example Petstore spec
      const response = await fetch('/examples/petstore.json');
      const spec = await response.json();

      await processSpec(spec);
    } catch (err: any) {
      setError(`Failed to load OpenAPI spec: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processSpec = async (spec: any) => {
    try {
      // Parse OpenAPI spec
      const parsed = await parseOpenAPI(spec);
      setParsedAPI(parsed);

      // Generate routes
      const generatedRoutes = generateRoutes(parsed);
      setRoutes(generatedRoutes);

      // Generate menu
      const grouped = groupRoutesByTag(generatedRoutes);
      const generatedMenu = generateMenu(grouped);
      setMenu(generatedMenu);

      console.log('Parsed API:', parsed);
      console.log('Generated Routes:', generatedRoutes);
      console.log('Menu:', generatedMenu);
    } catch (err: any) {
      throw new Error(`Failed to process spec: ${err.message}`);
    }
  };

  const handleUpload = async (file: UploadFile) => {
    setLoading(true);
    setError(null);

    try {
      const text = await file.originFileObj?.text();
      if (!text) {
        throw new Error('Failed to read file');
      }

      const spec = JSON.parse(text);
      await processSpec(spec);

      message.success('OpenAPI spec loaded successfully');
    } catch (err: any) {
      setError(`Failed to load spec: ${err.message}`);
      message.error(`Failed to load spec: ${err.message}`);
    } finally {
      setLoading(false);
    }

    return false; // Prevent auto upload
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <Spin size="large" />
        <div>Loading OpenAPI specification...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        padding: '20px'
      }}>
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ maxWidth: '600px' }}
        />
      </div>
    );
  }

  if (!parsedAPI || routes.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        padding: '20px',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <Alert
          message="No Routes Found"
          description="No API endpoints found in the OpenAPI specification"
          type="warning"
          showIcon
          style={{ maxWidth: '600px' }}
        />
        <Upload
          beforeUpload={handleUpload}
          accept=".json"
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>
            Upload OpenAPI Spec
          </Button>
        </Upload>
      </div>
    );
  }

  // Get first list route for default redirect
  const firstListRoute = routes.find(r => r.component === 'list');
  const defaultPath = firstListRoute?.path || '/';

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <BrowserRouter>
        <AppLayout
          menu={menu}
          apiTitle={parsedAPI.basePath}
          apiVersion="1.0"
        >
          <Routes>
            {/* Default redirect */}
            <Route path="/" element={<Navigate to={defaultPath} replace />} />

            {/* Generated routes */}
            {routes.map(route => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  route.component === 'list' ? (
                    <ListView
                      route={route}
                      baseUrl={parsedAPI.baseUrl}
                      allRoutes={routes}
                    />
                  ) : route.component === 'detail' ? (
                    <DetailView
                      route={route}
                      baseUrl={parsedAPI.baseUrl}
                      allRoutes={routes}
                    />
                  ) : (
                    <FormView
                      route={route}
                      baseUrl={parsedAPI.baseUrl}
                      allRoutes={routes}
                      schemas={parsedAPI.schemas}
                    />
                  )
                }
              />
            ))}

            {/* 404 */}
            <Route
              path="*"
              element={
                <Alert
                  message="404 Not Found"
                  description="The page you are looking for does not exist"
                  type="warning"
                  showIcon
                />
              }
            />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
