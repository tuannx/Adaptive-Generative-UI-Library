import React, { useState } from 'react';
import { Form, Input, Layout, Menu, Modal, Typography, theme } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { matchPath, useLocation } from 'react-router-dom';
import type { MenuItem } from '@agul/core';
import { useAgulNavigate, useAgulRuntime } from '../runtime.js';
import { formatLabel } from './format.js';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const PARAMS_STORAGE_KEY = 'agul:path-params';

function readStoredParams(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PARAMS_STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function storeParams(values: Record<string, string>): void {
  try {
    localStorage.setItem(PARAMS_STORAGE_KEY, JSON.stringify({ ...readStoredParams(), ...values }));
  } catch {
    // storage unavailable (private mode); values are simply not remembered
  }
}

interface AppLayoutProps {
  children: React.ReactNode;
  menu: MenuItem[];
  apiTitle?: string;
  apiVersion?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, menu, apiTitle = 'API Explorer', apiVersion }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [pending, setPending] = useState<MenuItem | null>(null);
  const [paramForm] = Form.useForm<Record<string, string>>();
  const navigate = useAgulNavigate();
  const { routeBase } = useAgulRuntime();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const items = React.useMemo(() => menu.flatMap((group) => group.children ?? []), [menu]);
  const currentPath = location.pathname.slice(routeBase.length) || '/';
  const selected = items
    .filter((item) => matchPath({ path: item.key, end: false }, currentPath))
    .sort((a, b) => b.key.length - a.key.length)[0];
  const openGroup = menu.find((group) => group.children?.includes(selected!))?.key;

  const handleClick = (key: string) => {
    const item = items.find((candidate) => candidate.key === key);
    if (!item?.params?.length) {
      navigate(key);
      return;
    }
    setPending(item);
  };

  const submitParams = (values: Record<string, string>) => {
    if (!pending) return;
    storeParams(values);
    const path = pending.key.replace(/:([^/]+)/g, (_, param: string) => encodeURIComponent(values[param].trim()));
    setPending(null);
    navigate(path);
  };

  const menuItems = menu.map((group) => ({
    key: group.key,
    label: group.label,
    icon: <ApiOutlined />,
    children: group.children?.map((item) => ({
      key: item.key,
      label: item.params?.length ? <span title={item.key}>{item.label} …</span> : item.label,
    })),
  }));

  return (
    <Layout style={{ minHeight: '100vh' }} data-testid="agul-layout">
      <Sider
        data-testid="agul-sidebar"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        width={250}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 24px' }}>
          <Title level={4} style={{ margin: 0, color: 'white' }}>
            {collapsed ? 'A' : 'AGUL'}
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selected ? [selected.key] : []}
          defaultOpenKeys={openGroup ? [openGroup] : menu.slice(0, 1).map((group) => group.key)}
          items={menuItems}
          onClick={({ key }) => handleClick(key)}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            {apiTitle}
          </Title>
          {apiVersion && <Text type="secondary">v{apiVersion}</Text>}
        </Header>

        <Content
          style={{
            margin: 24,
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {children}
        </Content>
      </Layout>

      <Modal
        open={!!pending}
        title={pending?.label}
        okText="Open"
        onOk={() => paramForm.submit()}
        onCancel={() => setPending(null)}
        destroyOnHidden
        data-testid="agul-path-params"
      >
        <Text type="secondary">{pending?.key}</Text>
        <Form
          form={paramForm}
          layout="vertical"
          onFinish={submitParams}
          initialValues={pending ? readStoredParams() : undefined}
          style={{ marginTop: 16 }}
        >
          {pending?.params?.map((param) => (
            <Form.Item
              key={param}
              name={param}
              label={formatLabel(param)}
              rules={[{ required: true, whitespace: true, message: `Please input ${formatLabel(param)}` }]}
            >
              <Input autoFocus={param === pending.params![0]} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </Layout>
  );
};
