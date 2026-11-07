import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  pack: {
    entry: ['src/index.ts'],
    format: ['esm'],
    fixedExtension: false,
    dts: false,
    sourcemap: true,
    clean: true,
    target: false,
  },
});
