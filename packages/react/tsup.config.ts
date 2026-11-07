import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'headless/index': 'src/headless/index.ts' },
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    'react-router-dom',
    'antd',
    '@ant-design/icons',
    'axios',
    'swr',
    'dayjs',
    'js-yaml',
    '@agul/core',
  ],
});
