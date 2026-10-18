import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Build version (X.Y.Z+<sha>); must equal the server's APP_VERSION (default '0.1.0') for /api/config comparison. */
const APP_VERSION = process.env.APP_VERSION ?? '0.1.0';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    // vue-i18n feature flags (docs "Optimization"): Composition API only, no plugin install, no devtools hooks
    __VUE_I18N_FULL_INSTALL__: false,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  plugins: [
    vue(),
    // <html data-app-version> carries the build version (e2e reads it after a reload).
    { name: 'app-version-attr', transformIndexHtml: (html: string) => html.replace('<html ', `<html data-app-version="${APP_VERSION}" `) },
    // Material Symbols as inline SVG components: `import IconAdd from '~icons/material-symbols/add'`.
    Icons({ compiler: 'vue3', scale: 1 }),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon-180.png', 'icons/favicon-32.png', 'icons/logo-small.svg'],
      manifest: {
        id: '/',
        name: "Fresh-D's Kalender",
        short_name: 'Fresh-D',
        description: 'Trag ein, trag aus, macht mir nix aus!',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1a73e8',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // The worker is `src/sw.ts` (precache, navigation fallback, /api NetworkOnly, update prompt, Web Push).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: {
    environment: 'jsdom',
    testTimeout: 30000,
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup/eager-scenes.ts'],
    // MCU 0.4.0 ships extensionless ESM imports that Node cannot resolve; let Vite transform it.
    server: { deps: { inline: ['@material/material-color-utilities'] } },
  },
});
