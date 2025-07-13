import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const compat = new FlatCompat({
  recommendedConfig: js.configs.recommended,
});

export default [
  ...compat.config({
    extends: ['eslint:recommended'],
    env: {
      browser: true,
      node: true,
      es2021: true,
      jest: true,
    },
    parserOptions: {
      ecmaVersion: 12,
      sourceType: 'module',
    },
    rules: {
      'no-case-declarations': 'off',
    },
  }),
];
