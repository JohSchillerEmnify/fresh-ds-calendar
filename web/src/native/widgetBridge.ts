/**
 * Hands the Android widget its snapshot (ARCHITECTURE "Android app and widget"). Loaded lazily and only inside the
 * Capacitor app (`window.Capacitor`), so the PWA in a browser never runs, or even downloads, any of it.
 *
 * The native plugin `WidgetBridge` stores the snapshot in SharedPreferences and asks the widget to refresh. The plugin
 * is reached through `window.Capacitor.Plugins`, which Capacitor fills for every native plugin, so no `@capacitor/core`
 * dependency is needed in the web bundle.
 */
import { api } from '@/api/client';
import { addDays, toIsoDate, WEEK_OPTS } from '@/lib/dates';
import { language } from '@/i18n/language';
import { useClockStore } from '@/stores/clock';
import { buildWidgetSnapshot, type WidgetTheme } from './widgetSnapshot';
import type { CalendarItem } from '@/api/types';
import { startOfWeek } from 'date-fns';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { WidgetBridge?: { setSnapshot(o: { json: string }): Promise<unknown> } };
}

/** The week is re-read from the server at most this often; every sync still refreshes theme, language and the clock. */
const ITEMS_MAX_AGE_MS = 10 * 60_000;

let cached: { weekStart: string; at: number; items: CalendarItem[] } | null = null;
let running: Promise<void> | null = null;

export { isNativeApp } from './app';

/** Reads the widget's colour roles from the generated theme on `<html>`. */
export function readTheme(root: HTMLElement = document.documentElement): WidgetTheme {
  const style = getComputedStyle(root);
  const c = (role: string, fallback: string) => style.getPropertyValue(`--md-sys-color-${role}`).trim() || fallback;
  return {
    primary: c('primary', '#495f8b'),
    onPrimary: c('on-primary', '#f9f8ff'),
    primaryContainer: c('primary-container', '#b0c7f9'),
    onPrimaryContainer: c('on-primary-container', '#29406a'),
    surface: c('surface', '#faf9fe'),
    surfaceContainer: c('surface-container', '#ededf6'),
    onSurface: c('on-surface', '#2f323a'),
    onSurfaceVariant: c('on-surface-variant', '#5c5f68'),
    outlineVariant: c('outline-variant', '#afb1bc'),
  };
}

async function push(): Promise<void> {
  const plugin = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor?.Plugins?.WidgetBridge;
  if (!plugin) return;
  const today = useClockStore().today;
  const monday = startOfWeek(new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10))), WEEK_OPTS);
  const weekStart = toIsoDate(monday);
  if (!cached || cached.weekStart !== weekStart || Date.now() - cached.at > ITEMS_MAX_AGE_MS) {
    const res = await api.items(weekStart, toIsoDate(addDays(monday, 7)));
    cached = { weekStart, at: Date.now(), items: res.items };
  }
  const snapshot = buildWidgetSnapshot({
    items: cached.items, today, theme: readTheme(), dark: document.documentElement.getAttribute('data-theme') === 'dark',
    language: language.value, now: new Date(),
  });
  await plugin.setSnapshot({ json: JSON.stringify(snapshot) });
}

/** Called when a sync has finished and when the app starts: writes a fresh snapshot (coalesced; failures are ignored). */
export function onSynced(): Promise<void> {
  running ??= push().catch(() => undefined).finally(() => { running = null; });
  return running;
}
