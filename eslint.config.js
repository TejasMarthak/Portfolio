import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/package-lock.json']
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['server/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node
    }
  }
];
