import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    include: ['worker/**/*.test.ts'],
    environment: 'node',
  },
});
