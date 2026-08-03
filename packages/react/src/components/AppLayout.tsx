/**
 * AppLayout Component - Main layout with navigation
 */

import React, { useState } from 'react';
import { Layout, Menu, Typography, Button, Space, theme } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ApiOutlined,
  GithubOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import type { MenuItem } from '@agul/core';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

interface AppLayoutProps {
  children: React.ReactNode;
  menu: MenuItem[];
  apiTitle?: string;
  apiVersion?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  menu,
  apiTitle = 'API Explorer',
  apiVersion
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleMenuClick = (e: { key: string }) => {
    navigate(e.key);
  };

  // Convert menu items to Ant Design format
  const menuItems = menu.map(item => ({
    key: item.key,
    label: item.label,
    icon: <ApiOutlined />,
    children: item.children?.map(child => ({
      key: child.key,
      label: child.label
    }))
  }));

  return (
    <Layout style={{ minHeight: '100vh' }} data-testid="agul-layout">
      <Sider
        data-testid="agul-sidebar"
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
        width={250}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '0 16px'
          }}
        >
          {!collapsed && (
            <Space direction="vertical" size={0}>
              <Title level={4} style={{ margin: 0, color: 'white' }}>
                AGUL
              </Title>
              <Text type="secondary" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>
                API UI Generator
              </Text>
            </Space>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 250, transition: 'all 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '16px',
                width: 64,
                height: 64,
              }}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {apiTitle}
              </Title>
              {apiVersion && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Version {apiVersion}
                </Text>
              )}
            </div>
          </Space>

          <Space>
            <Button
              type="text"
              icon={<GithubOutlined />}
              href="https://github.com/tuannx/Adaptive-Generative-UI-Library"
              target="_blank"
            >
              GitHub
            </Button>
          </Space>
        </Header>

        <Content
          style={{
            margin: '24px',
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
