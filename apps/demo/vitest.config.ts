import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    include: ['worker/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
