import { defineConfig } from 'vite';

/** Builds src/mock-sw.ts into one classic-script file next to the demo (`vite build -c vite.sw.config.ts`). */
export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: process.env.AGUL_SW_OUT_DIR ?? 'dist',
    lib: { entry: 'src/mock-sw.ts', formats: ['iife'], name: 'agulMockServiceWorker', fileName: () => 'mock-sw.js' },
  },
});
