/**
 * The live subscriber (ADR 0030): one `EventSource` to `/api/events/stream` while the app is visible. It never reads
 * the nudge's content; it only asks for a sync. `EventSource` reconnects by itself, and every reconnect syncs once.
 */
import { listen, type Disposer } from './timers';

/** What the subscriber needs from the sync engine. */
export interface LiveHooks {
  /** A nudge arrived or the connection came back after a gap: sync now. */
  changed(): void;
  /** The connection is up or down (the safety-net poll slows down while it is up). */
  connected(up: boolean): void;
}

const STREAM = '/api/events/stream';

/** Opens the stream while the page is visible and closes it while hidden; returns the function that stops everything. */
export function startLiveSync(hooks: LiveHooks): Disposer {
  if (typeof EventSource === 'undefined' || typeof document === 'undefined') return () => undefined;
  let source: EventSource | null = null;
  let everOpened = false;

  const close = (): void => {
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
      hooks.connected(true);
      // the first open is covered by the sync that opened or showed the app; a later one closes a gap
      if (everOpened) hooks.changed();
      everOpened = true;
    };
    s.onerror = () => {
      hooks.connected(false);
      // a refusal (signed out, too many streams) ends the source for good: leave it to the safety net
      if (s.readyState === EventSource.CLOSED) { source = null; everOpened = false; }
    };
  };

  const onVisibility = (): void => (document.hidden ? close() : open());
  const stopListening = listen(document, 'visibilitychange', onVisibility);
  if (!document.hidden) open();
  return () => { stopListening(); close(); };
}
