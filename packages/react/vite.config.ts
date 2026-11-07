import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    environment: 'node',
  },
  pack: {
    entry: { index: 'src/index.ts', 'headless/index': 'src/headless/index.ts' },
    format: ['esm'],
    fixedExtension: false,
    dts: false,
    sourcemap: true,
    clean: true,
    target: false,
    deps: {
      neverBundle: [
        'react',
        'react-dom',
        'react-router-dom',
        'antd',
        '@ant-design/icons',
        'axios',
        'swr',
        'dayjs',
        'js-yaml',
        '@ai-kit/agul-core',
      ],
    },
  },
});
