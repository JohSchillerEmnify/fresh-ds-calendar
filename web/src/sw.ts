/**
 * The service worker (vite-plugin-pwa `injectManifest`). It does what the generated worker did: precaches the build, serves
 * `/index.html` for client routes (not for `/api/`, the APK and the privacy page), never caches `/api/`, claims open pages
 * at once, and waits for the `SKIP_WAITING` message of "Reload" before it takes over (registerType 'prompt'). On top it
 * shows Web Push reminders (`push`) and focuses or opens the app when one is tapped (`notificationclick`), and keeps the
 * map pictures an event's map has shown for offline use (`pwa/tileCache.ts`, feature event-location).
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { notificationLook } from './pwa/notificationLook';
import { isTileRequest, serveTile, TILE_CACHE } from './pwa/tileCache';

/** The parts of the worker scope this file uses (the project compiles with the DOM lib, not the WebWorker one). */
interface WorkerScope {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
  registration: { showNotification(title: string, o: { body: string; tag: string; badge: string; icon: string; data: { key: string } }): Promise<void> };
  clients: {
    claim(): Promise<void>;
    matchAll(o: { type: 'window'; includeUncontrolled: boolean }): Promise<Array<{ focus(): Promise<unknown> }>>;
    openWindow(url: string): Promise<unknown>;
  };
  skipWaiting(): Promise<void>;
  addEventListener(type: string, listener: (e: any) => void): void;
}
const sw = self as unknown as WorkerScope;

// the injection point must stay literally `self.__WB_MANIFEST` (the plugin searches the built worker for it)
precacheAndRoute((self as unknown as WorkerScope).__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/app\.apk$/, /^\/app\.json$/, /^\/privacy\.html$/] }));
// map pictures (the tile server, or the TEST_MODE stand-in under /api): network first, the shown ones kept for offline
registerRoute(({ request, url }) => isTileRequest(request.destination, url, self.location.origin), async ({ request, event }) =>
  serveTile(request, await caches.open(TILE_CACHE), (r) => fetch(r), Date.now(), (p) => (event as unknown as { waitUntil(p: Promise<unknown>): void }).waitUntil(p)));
// /api is never cached
registerRoute(({ url }) => /^\/api\//.test(url.pathname), new NetworkOnly());

// first visit: the worker controls the page right after install (offline shell)
sw.addEventListener('activate', (e: { waitUntil(p: Promise<unknown>): void }) => e.waitUntil(sw.clients.claim()));
sw.addEventListener('message', (e: { data?: { type?: string } }) => {
  if (e.data?.type === 'SKIP_WAITING') void sw.skipWaiting();
});

/**
 * A reminder arrives: `{ title, body, key, kind }`, shown with `tag: key` so a re-send replaces it instead of doubling, and
 * with the badge and icon of its kind.
 */
sw.addEventListener('push', (e: { data?: { json(): { title?: string; body?: string; key?: string; kind?: string } } | null; waitUntil(p: Promise<unknown>): void }) => {
  let m: { title?: string; body?: string; key?: string; kind?: string } = {};
  try { m = e.data?.json() ?? {}; } catch { /* an unreadable payload still shows a notification, as browsers require */ }
  e.waitUntil(sw.registration.showNotification(m.title ?? 'Calendar', { body: m.body ?? '', tag: m.key ?? 'reminder', ...notificationLook(m.kind), data: { key: m.key ?? '' } }));
});

/** Tapping a reminder closes it and brings the app forward (a window that is open, else a new one). */
sw.addEventListener('notificationclick', (e: { notification: { close(): void }; waitUntil(p: Promise<unknown>): void }) => {
  e.notification.close();
  e.waitUntil(sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => (all[0] ? all[0].focus() : sw.clients.openWindow('/'))));
});
