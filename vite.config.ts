import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    singleQuote: true,
    printWidth: 120,
  },
  lint: {
    plugins: ['typescript', 'react', 'oxc', 'unicorn'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/only-export-components': ['warn', { allowConstantExport: true }],
    },
    ignorePatterns: ['**/dist/**', '**/node_modules/**'],
    options: { typeAware: true, typeCheck: true },
  },
});
