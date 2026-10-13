import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import { VitePWA } from 'vite-plugin-pwa';
import VueI18n from '@intlify/unplugin-vue-i18n/vite';

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
    // vue-i18n 11.4's runtime build still registers the message compiler unconditionally; drop that call so the compiler
    // tree-shakes away (the catalogues are precompiled below).
    ...(process.env.VITEST ? [] : [{
      name: 'vue-i18n-drop-compiler',
      enforce: 'pre' as const,
      transform: (code: string, id: string) => (/vue-i18n\/dist\/vue-i18n\.runtime\.mjs$/.test(id) ? code.replace('registerMessageCompiler(compile);', '') : null),
    }]),
    // Precompiles the catalogues (also the lazy chunks); vue-i18n is built runtime-only without the compiler (hook above)
    // (ARCHITECTURE "i18n"). Unit tests keep the raw strings and the full build, which the key checks and `t()` tests need.
    ...(process.env.VITEST ? [] : [VueI18n({ runtimeOnly: true, include: [fileURLToPath(new URL('./src/i18n/locales/*.ts', import.meta.url))] })]),
    // <html data-app-version> carries the build version (e2e reads it after a reload).
    { name: 'app-version-attr', transformIndexHtml: (html: string) => html.replace('<html ', `<html data-app-version="${APP_VERSION}" `) },
    // Material Symbols as inline SVG components: `import IconAdd from '~icons/material-symbols/add'`.
    Icons({ compiler: 'vue3', scale: 1 }),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon-180.png', 'icons/favicon-32.png'],
      manifest: {
        id: '/',
        name: 'Calendar',
        short_name: 'Calendar',
        description: 'Calendar with embeddable task lists',
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
      workbox: {
        clientsClaim: true, // first visit: the worker controls the page right after install (offline shell)
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // /api is never cached: no runtime caching rules at all.
        runtimeCaching: [{ urlPattern: /^\/api\//, handler: 'NetworkOnly' }],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: {
    environment: 'jsdom',
    testTimeout: 30000,
    include: ['test/**/*.test.ts'],
    // MCU 0.4.0 ships extensionless ESM imports that Node cannot resolve; let Vite transform it.
    server: { deps: { inline: ['@material/material-color-utilities'] } },
  },
});
