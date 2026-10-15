import React, { useState } from 'react';
import { Layout, Menu, Typography, theme } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import type { MenuItem } from '@agul/core';
import { useAgulNavigate, useAgulRuntime } from '../runtime.js';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

interface AppLayoutProps {
  children: React.ReactNode;
  menu: MenuItem[];
  apiTitle?: string;
  apiVersion?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, menu, apiTitle = 'API Explorer', apiVersion }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useAgulNavigate();
  const { routeBase } = useAgulRuntime();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const currentPath = location.pathname.slice(routeBase.length) || '/';
  const selectedKey =
    menu
      .flatMap((group) => group.children ?? [])
      .map((item) => item.key)
      .filter((key) => currentPath === key || currentPath.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] ?? currentPath;
  const openGroup = menu.find((group) => group.children?.some((item) => item.key === selectedKey))?.key;

  const menuItems = menu.map((group) => ({
    key: group.key,
    label: group.label,
    icon: <ApiOutlined />,
    children: group.children?.map((item) => ({ key: item.key, label: item.label })),
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
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openGroup ? [openGroup] : menu.map((group) => group.key)}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
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
    </Layout>
  );
};
