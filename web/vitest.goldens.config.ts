/**
 * Component goldens (`pnpm goldens`, `pnpm goldens:update`): Vitest browser mode against a Playwright browser server in
 * the pinned Playwright image (scripts/goldens.sh), so every machine renders the same pixels. Requests from the page
 * to localhost are tunnelled back to this machine, where Vitest serves the components.
 */
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { appDefines } from './app-defines';

export default defineConfig({
  define: appDefines('0.1.0'),
  plugins: [vue(), Icons({ compiler: 'vue3', scale: 1 })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // pre-bundled up front: a dependency first seen mid-run makes Vite reload the page ("failed to find the runner")
  optimizeDeps: { include: ['pinia', 'vue', 'vue-i18n', '@vueuse/core', 'date-fns', 'vitest-browser-vue'] },
  test: {
    include: ['goldens/**/*.golden.ts'],
    // actual and diff images of a mismatch
    attachmentsDir: 'test-results/goldens',
    testTimeout: 60_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        connectOptions: { wsEndpoint: process.env.GOLDENS_WS || 'ws://127.0.0.1:3123/', exposeNetwork: '<loopback>' },
      }),
      instances: [{ browser: 'chromium' }],
      expect: {
        toMatchScreenshot: {
          // pixel-identical: the refactor these guard must not move a single pixel
          comparatorName: 'pixelmatch',
          comparatorOptions: { threshold: 0, includeAA: true, allowedMismatchedPixels: 0 },
          // one set of baselines for every host: the browser always runs on Linux in the image
          resolveScreenshotPath: ({ arg, ext, root, testFileDirectory, testFileName }) =>
            join(root, testFileDirectory, '__screenshots__', testFileName, `${arg}${ext}`),
        },
      },
    },
  },
});
