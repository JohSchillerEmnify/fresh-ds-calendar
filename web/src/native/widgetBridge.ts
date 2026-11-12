/**
 * Hands the Android widget its snapshot (feature phone-widget). Loaded lazily and only inside the
 * Capacitor app (`window.Capacitor`), so the PWA in a browser never runs, or even downloads, any of it.
 *
 * The native plugin `WidgetBridge` stores the snapshot in SharedPreferences and asks the widget to refresh. The plugin
 * is reached through `window.Capacitor.Plugins`, which Capacitor fills for every native plugin, so no `@capacitor/core`
 * dependency is needed in the web bundle.
 */
import { api } from '@/api/client';
import { addDays, toIsoDate, WEEK_OPTS } from '@/lib/dates';
import { language } from '@/i18n/language';
import { useCalendarsStore } from '@/stores/calendars';
import { covers, itemsIn } from '@/lib/deviceData';
import { useClockStore } from '@/stores/clock';
import { useDeviceStore } from '@/stores/device';
import { timelineDays } from '@calendar/shared/prefs';
import { usePrefsStore } from '@/stores/prefs';
import { buildWidgetSnapshot, type WidgetTheme } from './widgetSnapshot';
import type { CalendarItem } from '@/api/types';
import { startOfWeek } from 'date-fns';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { WidgetBridge?: { setSnapshot(o: { json: string }): Promise<unknown> } };
}

/** Without the device store the week is re-read from the server at most this often; every sync still refreshes theme, language and the clock. */
const ITEMS_MAX_AGE_MS = 10 * 60_000;

let cached: { weekStart: string; to: string; at: number; items: CalendarItem[] } | null = null;
let running: Promise<void> | null = null;
/** The last snapshot handed over, without its `generatedAt` stamp: an unchanged snapshot is not pushed again (the launcher cross-fades every redraw, which flashes). */
let lastPushed: string | null = null;

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
  const todayDate = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  const weekStart = toIsoDate(startOfWeek(todayDate, WEEK_OPTS));
  // the list widget reads 14 days from today, which reaches past the week
  const weekEnd = toIsoDate(addDays(todayDate, 14));
  const device = useDeviceStore();
  if (device.ready && covers(device.data!, weekStart, weekEnd)) {
    // the week is read from the device store: always current, no request
    cached = { weekStart, to: weekEnd, at: Date.now(), items: itemsIn(device.data!, weekStart, weekEnd) };
  } else if (!cached || cached.to !== weekEnd || Date.now() - cached.at > ITEMS_MAX_AGE_MS) {
    const res = await api.items(weekStart, weekEnd);
    cached = { weekStart, to: weekEnd, at: Date.now(), items: res.items };
  }
  // the hidden calendars come from the server; without them the widget would show calendars the person switched off
  const calendars = useCalendarsStore();
  if (!calendars.list.length) await calendars.load();
  const snapshot = buildWidgetSnapshot({
    items: cached.items, today, theme: readTheme(), dark: document.documentElement.getAttribute('data-theme') === 'dark',
    language: language.value, now: new Date(), hiddenCalendars: useCalendarsStore().hidden, minEventMinutes: usePrefsStore().minEventMinutes, weekSideBySide: usePrefsStore().weekSideBySide,
    categoriesOn: usePrefsStore().taskCategories, androidWidgetStyle: usePrefsStore().androidWidgetStyle, timelineDays: timelineDays(usePrefsStore()),
  });
  const content = JSON.stringify({ ...snapshot, generatedAt: '' });
  if (content === lastPushed) return;
  await plugin.setSnapshot({ json: JSON.stringify(snapshot) });
  lastPushed = content;
}

/** Called when a sync has finished and when the app starts: writes a fresh snapshot (coalesced; failures are ignored). */
export function onSynced(): Promise<void> {
  running ??= push().catch(() => undefined).finally(() => { running = null; });
  return running;
}
