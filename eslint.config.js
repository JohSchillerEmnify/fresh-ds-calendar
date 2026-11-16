// Code-smell gate (`pnpm lint`, also part of `pnpm verify`). Tuned to pass on the existing code:
// the duplication/identical-code rules are errors; noisy rules are warn/off and can be tightened later.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import sonarjs from 'eslint-plugin-sonarjs';
import { GATE_ALLOWLIST } from './eslint.allowlist.mjs';
import commentStyle from './scripts/quality/comment-style.mjs';

const KIT_ELEMENTS = [
  { element: 'button', message: 'no raw buttons outside m3: use Button, IconButton, Chip or Pressable from web/src/components/m3' },
  { element: ['input', 'textarea', 'select'], message: 'no raw form fields outside m3: use TextField, Select, Checkbox, Radio, Switch or Slider from web/src/components/m3' },
];
const KIT_SYNTAX = [
  { kind: 'role', selector: 'VAttribute[directive=false][key.name="role"][value.value=/^(button|checkbox|dialog|option)$/]', message: 'no hand-made role outside m3: use Pressable, IconButton, Checkbox, AdaptiveSheet or Menu from web/src/components/m3' },
  { kind: 'click', selector: 'VStartTag[parent.name=/^(div|span|li|header)$/] > VAttribute[directive=true][key.name.name="on"][key.argument.name="click"]', message: 'no click on a plain element outside m3: use Pressable or a kit control from web/src/components/m3' },
];

// a severity alone would inherit the earlier options, so an empty list switches the rule off
const syntaxRules = (list) => (list.length ? ['error', ...list.map(({ selector, message }) => ({ selector, message }))] : 'off');

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
    // The one action vocabulary (ADR 0032): raw controls, hand-made roles and clickable plain elements belong only inside the m3 components
    files: ['web/src/**/*.vue'],
    ignores: ['web/src/components/m3/**'],
    rules: { 'vue/no-restricted-html-elements': ['error', ...KIT_ELEMENTS], 'vue/no-restricted-syntax': syntaxRules(KIT_SYNTAX) },
  },
  // the ratchet: each allowlisted file is released from exactly the checks it still needs
  ...GATE_ALLOWLIST.map(({ file, allow }) => ({
    files: [file],
    rules: {
      'vue/no-restricted-html-elements': ['error', ...(allow.includes('field') ? [KIT_ELEMENTS[0]] : KIT_ELEMENTS)],
      'vue/no-restricted-syntax': syntaxRules(KIT_SYNTAX.filter((r) => !allow.includes(r.kind))),
    },
  })),
  {
    // Edit permission has one source: server/src/services/ownership.ts. The web app reads `writable` / `readOnly` from the API.
    files: ['web/src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: 'Identifier[name=/^(accessRole|dataOwner)$/]', message: 'Do not decide edit rights in the web app: read `writable` (calendar) or `readOnly` (event) from the API; the one rule is server/src/services/ownership.ts.' },
        { selector: 'Literal[value=/^(accessRole|dataOwner)$/]', message: 'Do not decide edit rights in the web app: read `writable` (calendar) or `readOnly` (event) from the API; the one rule is server/src/services/ownership.ts.' },
      ],
    },
  },
  {
    // Settings have one mechanism (stores/prefs.ts + shared/prefs.js, ADR 0035): UI code keeps no setting in browser storage.
    files: ['web/src/components/**/*.{ts,vue}', 'web/src/views/**/*.{ts,vue}', 'web/src/features/**/*.{ts,vue}'],
    rules: {
      'no-restricted-globals': ['error',
        ...['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({ name, message: 'Settings go through the prefs store (web/src/stores/prefs.ts, shared/prefs.js); offline data through the device copy (stores/device.ts). Per-device UI state: a store in web/src/stores, or the allow-list in eslint.config.js.' })),
      ],
      'no-restricted-properties': ['error',
        ...['window', 'globalThis'].flatMap((object) => ['localStorage', 'sessionStorage', 'indexedDB'].map((property) => ({ object, property, message: 'Settings go through the prefs store (web/src/stores/prefs.ts, shared/prefs.js), not browser storage.' }))),
      ],
    },
  },
  {
    // Allow-list for the rule above: per-device UI state (collapse, last view, once-per-session flags), never a setting.
    files: [
      'web/src/components/settings/themeLivePreviewSample.ts', // collapsed state of the live-preview panel
      'web/src/features/calendar/transitionWarning.ts', // which reminders this device already showed
      'web/src/features/tasklists/section.ts', // which list section this device shows
      'web/src/features/tasklists/collapse.ts', // collapsed task list cards on this device
      'web/src/features/tasklists/canvasStore.ts', // last canvas view on this device
      'web/src/features/bedtime/bedtimeReminder.ts', // last night a reminder was shown on this device
      'web/src/features/motivation/session.ts', // once-per-session animation flags
      'web/src/features/labs/htime/htime.ts', // labs zoom level on this device (session)
      'web/src/features/labs/zoom/zoom.ts', // labs zoom level on this device (session)
    ],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    // Device-first (ADR 0023/0025): UI code reads through stores and the device copy, not the API client.
    // `warn` on purpose: today's importers are the allow-list, held per file by the `lint` ratchet (TODO: move each into a store).
    files: ['web/src/components/**/*.{ts,vue}', 'web/src/views/**/*.{ts,vue}', 'web/src/features/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['warn', {
        paths: [{ name: '@/api/client', importNames: ['api'], message: 'Do not call the API from UI code: read through a store (web/src/stores, device copy) and write through the outbox (ADR 0023/0025). ApiError and types are fine.' }],
      }],
    },
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
