import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
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
