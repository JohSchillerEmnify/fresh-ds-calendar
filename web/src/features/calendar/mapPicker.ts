/** The map picker's logic apart from the map itself: looking up the address of the pin once the map has come to rest, and the shown numbers. */
import { reverseAddress } from './place';

/** The pause after the map stopped moving before the address is asked for (a drag is many moves; Photon is asked once). */
const REVERSE_DELAY_MS = 500;

/** Position as shown under the address: 4 decimals are about 10 m. */
export function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

/** What the picker hears from the resolver; only the newest request ever reports. */
export interface ResolverEvents {
  /** The pause is over and the request is on its way (or waiting): show "looking up". */
  onPending(): void;
  /** The readable address, or null when the service knows nothing there. */
  onAddress(address: string | null): void;
  /** The service could not be asked (no connection, refused). */
  onFail(): void;
}

/** Debounced reverse lookups for a moving pin. */
export interface Resolver {
  /** Asks for the address of a position after the pause; a newer call replaces an older one. */
  request(lat: number, lon: number): void;
  /** Forgets anything waiting or running. */
  cancel(): void;
}

/** Creates the resolver of one picker: lookups against `base` in `lang` report to `ev` after `delayMs` of rest (`fetchFn` for tests). */
export function createResolver(base: string, lang: string, ev: ResolverEvents, delayMs = REVERSE_DELAY_MS, fetchFn: typeof fetch = fetch): Resolver {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: AbortController | null = null;
  const cancel = () => { clearTimeout(timer); inflight?.abort(); inflight = null; };
  return {
    cancel,
    request(lat, lon) {
      cancel();
      ev.onPending();
      timer = setTimeout(async () => {
        const ctl = new AbortController();
        inflight = ctl;
        try {
          const address = await reverseAddress(base, lat, lon, lang, ctl.signal, fetchFn);
          if (inflight === ctl) ev.onAddress(address);
        } catch {
          if (inflight === ctl) ev.onFail();
        }
      }, delayMs);
    },
  };
}
