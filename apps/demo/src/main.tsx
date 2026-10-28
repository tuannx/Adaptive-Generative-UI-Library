import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import App from './App';
import './index.css';

/**
 * The static build (GitHub Pages) has no server for the sample APIs: a service worker answers /mock/* instead.
 * The first visit waits until it controls the page so the first API call already reaches it.
 */
async function startMockServiceWorker(): Promise<void> {
  if (import.meta.env.VITE_AGUL_MOCK_SW !== 'true' || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  await navigator.serviceWorker.register(`${base}mock-sw.js`, { scope: base });
  if (navigator.serviceWorker.controller) return;
  await new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    setTimeout(resolve, 3000);
  });
}

function render(): void {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AntdApp component={false}>
        <App />
      </AntdApp>
    </StrictMode>,
  );
}

startMockServiceWorker()
  .catch((error) => console.warn('Mock service worker unavailable:', error))
  .finally(render);
