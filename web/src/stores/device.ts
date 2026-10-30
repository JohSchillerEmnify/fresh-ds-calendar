import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { addDays } from 'date-fns';
import type { StoredTheme } from '@/api/client';
import type { AppConfig, Calendar, CalendarItem, LocalDate, Prefs, Settings, TaskTemplate } from '@/api/types';
import { useTemplatesStore } from '@/features/tasklists/templatesStore';
import { parseIsoDate, toIsoDate } from '@/lib/dates';
import { itemSegments } from '@/lib/items';
import { lastKnownDb, lastKnownPerson, setLastKnownPerson, wipeLastKnown } from '@/lib/lastKnownDb';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { useAuthStore } from './auth';
import { useCalendarsStore } from './calendars';
import { useClockStore } from './clock';
import { useItemsStore } from './items';
import { usePrefsStore } from './prefs';
import { useSettingsStore } from './settings';
import { useSyncStore } from './sync';
import { useThemeStore } from './theme';

/** Days kept on either side of today (owner, 2026-10-23: "about the last 4 weeks around today"). */
export const KEEP_DAYS = 28;
const SAVE_DEBOUNCE_MS = 300;
const RESTORE_TIMEOUT_MS = 1000;

/** One range the app showed, with its items as the server last answered (and local changes since). */
export interface SavedRange { from: LocalDate; to: LocalDate; items: CalendarItem[] }

/** What the device keeps of one person (ADR 0023). `savedAt` is the app-clock time of the last successful update. */
export interface LastKnownSnapshot {
  v: 1;
  person: string;
  savedAt: number;
  config: AppConfig;
  settings: Settings | null;
  prefs: Partial<Prefs>;
  calendars: Calendar[];
  themes: StoredTheme[];
  ranges: SavedRange[];
  /** The task list templates; absent in snapshots written before they were kept. */
  templates?: TaskTemplate[];
}

const touches = (it: CalendarItem, from: LocalDate, to: LocalDate) => itemSegments(it).some((s) => s.date >= from && s.date < to);

/**
 * Adds `next` to the saved ranges: it replaces a range with the same bounds, and takes out of the others every item it
 * holds or whose days it covers (that item moved, changed or was deleted), so an older range never brings it back.
 */
export function mergeRange(ranges: SavedRange[], next: SavedRange): SavedRange[] {
  const ids = new Set(next.items.map((i) => i.id));
  const rest = ranges
    .filter((r) => r.from !== next.from || r.to !== next.to)
    .map((r) => ({ ...r, items: r.items.filter((it) => !ids.has(it.id) && !touches(it, next.from, next.to)) }));
  return [...rest, next];
}

/** Keeps only the ranges, and their items, that lie within `KEEP_DAYS` of `today`. */
export function pruneRanges(ranges: SavedRange[], today: LocalDate): SavedRange[] {
  const day = parseIsoDate(today)!;
  const from = toIsoDate(addDays(day, -KEEP_DAYS));
  const to = toIsoDate(addDays(day, KEEP_DAYS));
  return ranges
    .filter((r) => r.from < to && r.to > from)
    .map((r) => ({ ...r, items: r.items.filter((it) => touches(it, from, to)) }));
}

/** Marks `<html data-last-known>` (`saving` / `saved`) so a test can wait for the write. */
const mark = (state: 'saving' | 'saved') => { if (typeof document !== 'undefined') document.documentElement.dataset.lastKnown = state; };

/**
 * The last known state (feature last-known-state, ADR 0023): restores the snapshot of the person last signed in on this
 * device before the first route, and saves what the app shows after every fresh answer. `restored` is true while the
 * shown calendar is that snapshot and no fresh answer has come yet (the "Last updated" note shows meanwhile).
 */
export const useLastKnownStore = defineStore('lastKnown', () => {
  const restored = ref(false);
  /** App-clock time of the last successful update of the shown data (the snapshot's while restored). */
  const savedAt = ref<number | null>(null);
  /** The person the data on screen belongs to: `-` while sign-in is off. */
  let person: string | null = null;
  /** Ranges as last stored, merged with the fresh ones on every save. */
  let saved: SavedRange[] = [];
  let base: LastKnownSnapshot | null = null;
  /** `from_to` of every range that was the visible one in this session (prefetched neighbours were not seen). */
  const seen = new Set<string>();
  let pending: Disposer | null = null;
  let stops: Array<() => void> = [];

  /** Applies the stored snapshot when one exists for the person last signed in here; the sign-in page wipes it instead. */
  async function restore(path: string): Promise<boolean> {
    if (path === '/signin') {
      await Promise.race([wipeLastKnown(), new Promise((resolve) => { setTimeout(resolve, RESTORE_TIMEOUT_MS); })]);
      return false;
    }
    const who = lastKnownPerson();
    const db = lastKnownDb();
    if (who === null || !db) return false;
    let snap: LastKnownSnapshot | undefined;
    // a hanging IndexedDB (some private modes) must not keep the app from starting: then nothing is restored
    const late = new Promise<undefined>((resolve) => { setTimeout(() => resolve(undefined), RESTORE_TIMEOUT_MS); });
    try { snap = await Promise.race([db.get<LastKnownSnapshot>(who), late]); } catch { return false; }
    if (!snap || snap.v !== 1 || snap.person !== who) return false;
    const clock = useClockStore();
    clock.restore(snap.config);
    if (snap.settings) useSettingsStore().restore(snap.settings);
    usePrefsStore().restore(snap.prefs);
    useCalendarsStore().restore(snap.calendars);
    useThemeStore().restore(snap.themes);
    if (snap.templates) useTemplatesStore().restore(snap.templates);
    saved = pruneRanges(snap.ranges, clock.today);
    useItemsStore().restore(saved.flatMap((r) => r.items));
    base = snap;
    person = who;
    savedAt.value = snap.savedAt;
    restored.value = true;
    return true;
  }

  /** The person of the session as the server says, `null` while unknown or signed out. */
  function sessionPerson(): string | null {
    const auth = useAuthStore();
    if (auth.status === 'off') return '-';
    return auth.status === 'in' && auth.email ? auth.email.toLowerCase() : null;
  }

  async function save(): Promise<void> {
    pending = null;
    const who = sessionPerson();
    const db = lastKnownDb();
    const clock = useClockStore();
    const config = clock.loaded ? (clock.config as AppConfig) : base?.config;
    if (!who || !db || !config || savedAt.value === null || restored.value) return;
    const items = useItemsStore();
    for (const [key, r] of Object.entries(items.ranges)) {
      if (!seen.has(key)) continue;
      saved = mergeRange(saved, { from: r.from, to: r.to, items: r.ids.map((id) => items.byId[id]).filter((i): i is CalendarItem => !!i) });
    }
    saved = pruneRanges(saved, clock.today);
    const settings = useSettingsStore();
    const templates = useTemplatesStore();
    const snap: LastKnownSnapshot = {
      v: 1, person: who, savedAt: savedAt.value, config,
      settings: settings.loaded ? settings.settings : base?.settings ?? null,
      prefs: usePrefsStore().current(),
      calendars: useCalendarsStore().list,
      themes: useThemeStore().themes,
      ranges: saved,
      // the shown list: a template waiting for its undo time is left out (its delete is sent on leaving, and a save
      // still waiting is written then too, see flushSave); an undo shows it again and saves it back
      templates: templates.loaded ? templates.list : base?.templates,
    };
    try {
      // plain data only: reactive proxies cannot be cloned into IndexedDB
      await db.setOnly(who, JSON.parse(JSON.stringify(snap)));
      setLastKnownPerson(who);
      base = snap;
      mark('saved');
    } catch { /* storage full or blocked: the app works as before, without a last known state */ }
  }

  function scheduleSave(): void {
    if (savedAt.value === null || restored.value) return;
    pending?.();
    mark('saving');
    pending = appTimeout(() => { void save(); }, SAVE_DEBOUNCE_MS);
  }

  /** Writes a save still waiting for its debounce now: the page is going away (a template deleted just before stays gone). */
  function flushSave(): void {
    if (!pending) return;
    pending();
    pending = null;
    void save();
  }

  /** Starts following the stores: a fresh answer ends the restored state, every change after one is saved (debounced). */
  function install(): () => void {
    stop();
    const items = useItemsStore();
    const sync = useSyncStore();
    const clock = useClockStore();
    const auth = useAuthStore();
    stops.push(
      // the visible range (and today, fetched with it) counts as seen
      watch(() => items.visible, (v) => {
        if (!v) return;
        seen.add(`${v.from}_${v.to}`);
        if (v.withToday) seen.add(`${clock.today}_${toIsoDate(addDays(clock.todayDate, 1))}`);
      }, { immediate: true }),
      watch(() => sync.lastSync, (at) => {
        if (!at) return;
        restored.value = false;
        savedAt.value = clock.nowMs();
        scheduleSave();
      }),
      // a session of another person: what was shown is not theirs
      watch(() => [auth.status, auth.email] as const, () => {
        const who = sessionPerson();
        if (!who) return;
        if (person !== null && who !== person) {
          // nothing of the other person may stay on screen or be saved as this one's: wipe and start clean
          stop();
          savedAt.value = null;
          restored.value = false;
          items.dropRestored();
          void wipeLastKnown().then(() => window.location.reload());
          return;
        }
        person = who;
        // the person is known only now: a fresh answer that came first is saved now
        scheduleSave();
      }, { immediate: true }),
      listen(window, 'pagehide', flushSave),
      listen(document, 'visibilitychange', () => { if (document.hidden) flushSave(); }),
      watch(() => [items.byId, items.ranges, useSettingsStore().settings, usePrefsStore().current(), useCalendarsStore().list, useThemeStore().themes, useTemplatesStore().list], scheduleSave),
    );
    return stop;
  }

  function stop(): void {
    pending?.();
    pending = null;
    stops.forEach((s) => s());
    stops = [];
  }

  return { restored, savedAt, restore, install, stop };
});
