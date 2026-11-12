/** The live subscriber (ADR 0030): one `EventSource` while the app is visible that only asks for a sync (per nudge and per reconnect). */
import { appTimeout, listen, type Disposer } from './timers';

/** What the subscriber needs from the sync engine. */
export interface LiveHooks {
  /** A nudge arrived or the connection came back after a gap: sync now. */
  changed(): void;
  /** The connection is up or down (the safety-net poll slows down while it is up). */
  connected(up: boolean): void;
}

const STREAM = '/api/events/stream';
const REOPEN_FIRST_MS = 2_000;
const REOPEN_MAX_MS = 60_000;

/** Whether the person is still signed in (a 401 ends the retries; any other answer or a network error keeps them going). */
async function stillSignedIn(): Promise<boolean> {
  try {
    return (await fetch('/api/auth/me', { credentials: 'include' })).status !== 401;
  } catch {
    return true;
  }
}

let closeActive: (() => void) | null = null;

/** Lets go of the open stream (it reopens on the next visibility change); an update calls it so the old worker can hand over. */
export function closeLiveStream(): void {
  closeActive?.();
}

/** Opens the stream while the page is visible and closes it while hidden; returns the function that stops everything. */
export function startLiveSync(hooks: LiveHooks): Disposer {
  if (typeof EventSource === 'undefined' || typeof document === 'undefined') return () => undefined;
  let source: EventSource | null = null;
  let everOpened = false;
  let reopenTimer: Disposer | null = null;
  let failures = 0;

  /** The browser gave up (the proxy answered 502 while the server restarted): try again with growing, jittered waits. */
  const scheduleReopen = (): void => {
    reopenTimer?.();
    const base = Math.min(REOPEN_FIRST_MS * 2 ** failures, REOPEN_MAX_MS);
    failures++;
    reopenTimer = appTimeout(() => {
      reopenTimer = null;
      void stillSignedIn().then((ok) => { if (ok && !source && !document.hidden) open(); });
    }, base * (1 + Math.random() / 2));
  };

  const close = (): void => {
    reopenTimer?.();
    reopenTimer = null;
    failures = 0;
    source?.close();
    source = null;
    everOpened = false;
    hooks.connected(false);
  };

  const open = (): void => {
    if (source) return;
    const s = new EventSource(STREAM, { withCredentials: true });
    source = s;
    s.addEventListener('changed', () => hooks.changed());
    s.onopen = () => {
      failures = 0;
      hooks.connected(true);
      // the first open is covered by the sync that opened or showed the app; a later one closes a gap
      if (everOpened) hooks.changed();
      everOpened = true;
    };
    s.onerror = () => {
      hooks.connected(false);
      if (s.readyState === EventSource.CLOSED) {
        source = null;
        scheduleReopen();
      }
    };
  };

  closeActive = close;
  const onVisibility = (): void => (document.hidden ? close() : open());
  const stopListening = listen(document, 'visibilitychange', onVisibility);
  if (!document.hidden) open();
  return () => { stopListening(); close(); if (closeActive === close) closeActive = null; };
}
