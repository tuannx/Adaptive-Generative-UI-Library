import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  external: ['@agul/core', '@modelcontextprotocol/sdk', 'zod'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
