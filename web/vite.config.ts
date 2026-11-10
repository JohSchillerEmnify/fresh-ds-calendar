import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { appDefines } from './app-defines';
import { creditsPlugin } from './credits-plugin';

/** Build version (X.Y.Z+<sha>); must equal the server's APP_VERSION (default '0.1.0') for /api/config comparison. */
const APP_VERSION = process.env.APP_VERSION ?? '0.1.0';

export default defineConfig({
  define: appDefines(APP_VERSION),
  plugins: [
    vue(),
    // credits.json: attribution of what the bundle contains, shown in Settings > Account & app
    creditsPlugin(),
    // <html data-app-version> carries the build version (e2e reads it after a reload).
    { name: 'app-version-attr', transformIndexHtml: (html: string) => html.replace('<html ', `<html data-app-version="${APP_VERSION}" `) },
    // Material Symbols as inline SVG components: `import IconAdd from '~icons/material-symbols/add'`.
    Icons({ compiler: 'vue3', scale: 1 }),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // the notification badges and icons are precached: a push may arrive while the network is poor
      includeAssets: ['icons/apple-touch-icon-180.png', 'icons/favicon-32.png', 'icons/logo-small.svg', 'icons/badge-*-96.png', 'icons/notification-*-192.png'],
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
      // credits.json is not matched by the default patterns; the credits list must open offline
      injectManifest: { globPatterns: ['**/*.{js,css,html,json}'] },
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
    setupFiles: ['test/setup/eager-scenes.ts', 'test/setup/auto-unmount.ts'],
    // MCU 0.4.0 ships extensionless ESM imports that Node cannot resolve; let Vite transform it.
    server: { deps: { inline: ['@material/material-color-utilities'] } },
  },
});
