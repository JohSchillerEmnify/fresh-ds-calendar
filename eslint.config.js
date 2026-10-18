// Code-smell gate (`pnpm lint`, also part of `pnpm verify`). Tuned to pass on the existing code:
// the duplication/identical-code rules are errors; noisy rules are warn/off and can be tightened later.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**', '**/dist/**', '**/.features-gen/**', '**/coverage/**',
      'android/**', '**/.jscpd-report/**', '**/test-results/**', '**/playwright-report/**',
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
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-useless-assignment': 'warn',
      'no-regex-spaces': 'warn',
      'no-control-regex': 'warn',
      'vue/multi-word-component-names': 'off', // m3 primitives (Button, Chip, ...) are deliberately single-word
      'no-undef': 'off', // TypeScript already checks undefined identifiers (tsc runs in verify)
    },
  },
);
