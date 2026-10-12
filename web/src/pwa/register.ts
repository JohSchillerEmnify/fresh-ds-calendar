import { offerUpdate, setWaitingWorker } from './update';

/**
 * Registers the service worker only in a secure context (http://cal.mordor.local runs without one).
 * A waiting worker is offered through the shared update notice (`./update`); the page never reloads under the user.
 * The worker (vite-plugin-pwa, registerType 'prompt') activates on the SKIP_WAITING message sent by "Reload".
 */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const offer = (w: ServiceWorker) => {
    setWaitingWorker(w);
    offerUpdate();
  };
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
  } catch {
    // no service worker: the app works without it
  }
}
