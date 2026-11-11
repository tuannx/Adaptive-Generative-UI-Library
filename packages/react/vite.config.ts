import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    environment: 'node',
  },
  pack: {
    entry: {
      index: 'src/index.ts',
      'headless/index': 'src/headless/index.ts',
      'effects/motion/index': 'src/effects/motion/index.ts',
      'effects/auto-animate/index': 'src/effects/auto-animate/index.ts',
    },
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
        '@aikitstudio/agul-core',
        'motion',
        'motion/mini',
        '@formkit/auto-animate',
      ],
    },
  },
});
