import { resolve } from 'node:path';
import { defineConfig, lazyPlugins } from 'vite-plus';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: lazyPlugins(() => [react()]),
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      // genui.html: generative UI demo (agent answers with a screen), next to the main demo
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        genui: resolve(import.meta.dirname, 'genui.html'),
      },
    },
  },
});
