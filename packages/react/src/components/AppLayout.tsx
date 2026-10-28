import React, { useState } from 'react';
import { Form, Input, Layout, Menu, Modal, Typography, theme } from 'antd';
import { ApiOutlined, SearchOutlined } from '@ant-design/icons';
import { matchPath, useLocation } from 'react-router-dom';
import type { MenuItem } from '@agul/core';
import { useAgulNavigate, useAgulRuntime } from '../runtime.js';
import { formatLabel } from './format.js';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const PARAMS_STORAGE_KEY = 'agul:path-params';
const MENU_SEARCH_THRESHOLD = 15;

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
  /** Rendered at the right of the header. */
  headerExtra?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, menu, apiTitle = 'API Explorer', apiVersion, headerExtra }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [pending, setPending] = useState<MenuItem | null>(null);
  const [menuFilter, setMenuFilter] = useState('');
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
  // small menus start fully open; large ones (hundreds of operations) only show the current group
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    items.length <= 15 ? menu.map((group) => group.key) : openGroup ? [openGroup] : menu.slice(0, 1).map((group) => group.key),
  );
  React.useEffect(() => {
    if (openGroup) setOpenKeys((keys) => (keys.includes(openGroup) ? keys : [...keys, openGroup]));
  }, [openGroup]);

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

  const query = menuFilter.trim().toLowerCase();
  const shownMenu = React.useMemo(
    () =>
      query
        ? menu
            .map((group) => ({
              ...group,
              children: group.label.toLowerCase().includes(query)
                ? group.children
                : group.children?.filter((item) => item.label.toLowerCase().includes(query) || item.key.toLowerCase().includes(query)),
            }))
            .filter((group) => group.children?.length)
        : menu,
    [menu, query],
  );

  const menuItems = shownMenu.map((group) => ({
    key: group.key,
    label: group.label,
    icon: <ApiOutlined />,
    children: group.children?.map((item) => ({
      key: item.key,
      label: item.params?.length ? <span title={`${item.label} — ${item.key}`}>{item.label} …</span> : <span title={item.label}>{item.label}</span>,
    })),
  }));

  return (
    <Layout style={{ minHeight: '100vh' }} data-testid="agul-layout">
      <Sider
        data-testid="agul-sidebar"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="md"
        onBreakpoint={setNarrow}
        collapsedWidth={narrow ? 0 : 80}
        width={250}
        style={narrow ? { position: 'fixed', zIndex: 1000, height: '100vh', left: 0, top: 0 } : undefined}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 24px' }}>
          <Title level={4} style={{ margin: 0, color: 'white' }}>
            {collapsed ? 'A' : 'AGUL'}
          </Title>
        </div>
        {items.length > MENU_SEARCH_THRESHOLD && !collapsed && (
          <div style={{ padding: '0 16px 8px' }}>
            <Input
              size="small"
              allowClear
              prefix={<SearchOutlined />}
              placeholder={`Find a page (${items.length})`}
              value={menuFilter}
              onChange={(event) => setMenuFilter(event.target.value)}
              data-testid="agul-menu-search"
            />
          </div>
        )}
        {query && shownMenu.length === 0 && (
          <div style={{ padding: '8px 24px', color: 'rgba(255,255,255,0.45)' }} data-testid="agul-menu-empty">
            No page matches “{menuFilter.trim()}”
          </div>
        )}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selected ? [selected.key] : []}
          openKeys={collapsed ? undefined : query ? shownMenu.map((group) => group.key) : openKeys}
          onOpenChange={setOpenKeys}
          items={menuItems}
          style={{ display: shownMenu.length > 0 ? undefined : 'none' }}
          onClick={({ key }) => {
            handleClick(key);
            if (narrow) setCollapsed(true);
          }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: narrow ? '0 12px 0 48px' : '0 24px',
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
          {apiVersion && <Text type="secondary">{/^\d/.test(apiVersion) ? `v${apiVersion}` : apiVersion}</Text>}
          {headerExtra && <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>{headerExtra}</div>}
        </Header>

        <Content
          style={{
            margin: narrow ? 8 : 24,
            padding: narrow ? 12 : 24,
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
