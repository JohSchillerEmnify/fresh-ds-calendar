import { errorFacts, logDevice } from '@/lib/deviceLog';
import { autoUpdate } from './update';

/**
 * Registers the service worker only in a secure context (http://cal.mordor.local runs without one).
 * A newly installed worker (the newest build) is handed to `autoUpdate` (`./update`), which activates it (SKIP_WAITING) and
 * reloads once the ui is safe; without a controlling worker the manual "Reload" snackbar applies instead.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    if (reg.waiting && navigator.serviceWorker.controller) autoUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) autoUpdate(w);
      });
    });
  } catch (e) {
    // no service worker: the app works without it
    logDevice('sw', { step: 'register', ...errorFacts(e) });
  }
}
