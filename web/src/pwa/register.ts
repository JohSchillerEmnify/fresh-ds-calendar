import { useUiStore } from '@/stores/ui';

/**
 * Registers the service worker only in a secure context (http://cal.mordor.local runs without one).
 * A new version is shown as an update prompt (snackbar "Reload"); the page never reloads under the user.
 * The worker (vite-plugin-pwa, registerType 'prompt') activates on the SKIP_WAITING message.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  let reloading = false;
  const offer = (w: ServiceWorker) => {
    useUiStore().notify('A new version is available', {
      duration: 0, testid: 'update-prompt',
      action: { label: 'Reload', run: () => { reloading = true; w.postMessage({ type: 'SKIP_WAITING' }); } },
    });
  };
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
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
