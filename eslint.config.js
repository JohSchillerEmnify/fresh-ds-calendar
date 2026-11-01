// Code-smell gate (`pnpm lint`, also part of `pnpm verify`). Tuned to pass on the existing code:
// the duplication/identical-code rules are errors; noisy rules are warn/off and can be tightened later.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import sonarjs from 'eslint-plugin-sonarjs';
import commentStyle from './scripts/quality/comment-style.mjs';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**', '**/dist/**', '**/.features-gen/**', '**/coverage/**',
      'android/**', '**/.jscpd-report/**', '**/test-results*/**', '**/playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { sonarjs },
    rules: {
      // High-value, low-noise gate (errors).
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
      'vue/no-duplicate-attributes': 'error',
      'vue/no-dupe-keys': 'error',

      // Tighten later: these flag a lot of pre-existing code.
      'sonarjs/cognitive-complexity': 'warn',
      'sonarjs/no-duplicate-string': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // a leading _ marks an argument kept on purpose (step functions must match their pattern's arity)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-useless-assignment': 'warn',
      'no-regex-spaces': 'warn',
      'no-control-regex': 'warn',
      'vue/multi-word-component-names': 'off', // m3 primitives (Button, Chip, ...) are deliberately single-word
      'no-undef': 'off', // TypeScript already checks undefined identifiers (tsc runs in verify)
    },
  },
  {
    // The one action vocabulary (ADR 0032): a raw <button> belongs only inside the m3 components; elsewhere use Button, IconButton, Chip, Pressable, ...
    files: ['web/src/**/*.vue'],
    ignores: ['web/src/components/m3/**'],
    rules: { 'vue/no-restricted-html-elements': ['error', { element: 'button', message: 'no raw buttons outside m3: use Button, IconButton, Chip or Pressable from web/src/components/m3' }] },
  },
  {
    // Size and comment gates for source code only; today's offenders are ratcheted by `pnpm quality` (scripts/quality.mjs).
    files: ['web/src/**/*.{ts,vue}', 'server/src/**/*.ts', 'shared/**/*.{js,ts}'],
    plugins: { local: { rules: { 'comment-style': commentStyle } } },
    rules: {
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      'local/comment-style': 'warn',
    },
  },
);
