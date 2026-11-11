import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { GenUiDemo } from './GenUiDemo.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AntdApp component={false}>
      <GenUiDemo />
    </AntdApp>
  </StrictMode>,
);
