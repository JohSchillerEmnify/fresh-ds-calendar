/** The device's position for the map picker's "Use my location": the Capacitor Geolocation plugin in the Android app, the browser's API elsewhere. */
import { isNativeApp } from '@/native/app';

/** Why no position came: the person (or the system) refused, or the device could not tell. */
export type PositionResult = { ok: true; lat: number; lon: number } | { ok: false; reason: 'denied' | 'unavailable' };

interface GeolocationPlugin {
  requestPermissions(): Promise<{ location: string }>;
  getCurrentPosition(o: { enableHighAccuracy: boolean; timeout: number }): Promise<{ coords: { latitude: number; longitude: number } }>;
}

/** How long the device may take to answer. */
const TIMEOUT_MS = 10_000;

function plugin(): GeolocationPlugin | undefined {
  return (window as unknown as { Capacitor?: { Plugins?: { Geolocation?: GeolocationPlugin } } }).Capacitor?.Plugins?.Geolocation;
}

/** A refusal reads as "denied" whatever the platform calls it (plugin errors carry text, browsers a code). */
const isDenied = (e: unknown): boolean => (e as { code?: number })?.code === 1 || /denied|permission/i.test(String((e as Error)?.message ?? e));

/** Asks the device where it is. The permission is requested here, on the call, never earlier; never throws. */
export async function currentPosition(): Promise<PositionResult> {
  try {
    const native = plugin();
    if (isNativeApp() && native) {
      // the plugin asks the system dialog on the first call only; a refusal stays refused until the system settings change
      const { location } = await native.requestPermissions();
      if (location !== 'granted' && location !== 'limited') return { ok: false, reason: 'denied' };
      const p = await native.getCurrentPosition({ enableHighAccuracy: false, timeout: TIMEOUT_MS });
      return { ok: true, lat: p.coords.latitude, lon: p.coords.longitude };
    }
    if (!navigator.geolocation) return { ok: false, reason: 'unavailable' };
    return await new Promise<PositionResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ ok: true, lat: p.coords.latitude, lon: p.coords.longitude }),
        (e) => resolve({ ok: false, reason: isDenied(e) ? 'denied' : 'unavailable' }),
        { timeout: TIMEOUT_MS, maximumAge: 60_000 },
      );
    });
  } catch (e) {
    return { ok: false, reason: isDenied(e) ? 'denied' : 'unavailable' };
  }
}
