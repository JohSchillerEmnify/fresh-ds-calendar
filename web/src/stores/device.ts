import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import { api } from '@/api/client';
import type { AppConfig, CalendarItem } from '@/api/types';
import { useTemplatesStore } from '@/features/tasklists/templatesStore';
import { useCanvasStore } from '@/features/tasklists/canvasStore';
import { useMotivationStore } from '@/features/motivation/store';
import {
  applyChanges, dropItem, emptyData, isQuiet, putItem, type ChangeSet, type DeviceData, type DeviceFileName,
} from '@/lib/deviceData';
import { deviceDb, devicePerson, onDeviceWipe, setDevicePerson, wipeDevice } from '@/lib/deviceDb';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { useAuthStore } from './auth';
import { useCalendarsStore } from './calendars';
import { useClockStore } from './clock';
import { useItemsStore } from './items';
import { usePrefsStore } from './prefs';
import { useSettingsStore } from './settings';
import { useThemeStore } from './theme';

const SAVE_DEBOUNCE_MS = 50;
const RESTORE_TIMEOUT_MS = 1000;
/** The records the data is stored in: the bulky lists apart from the rest, so a small change does not rewrite them. */
const RECORDS = ['meta', 'events', 'lists'] as const;

/** Marks `<html data-device-store>` (`saving` / `synced`) and when it last synced, so a test can wait for the write. */
function mark(state: 'saving' | 'synced', at?: number | null): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.deviceStore = state;
  if (at != null) document.documentElement.dataset.deviceSyncedAt = String(at);
}

/**
 * The device store (ADR 0025): everything of one signed-in person, kept in IndexedDB and in memory. It is restored
 * before the first route, then brought up to date by `sync` (one `GET /api/changes` per call) and handed to the stores
 * the views read from. `fresh` is true once a complete sync succeeded since the app opened; `failed` while the last
 * sync did not; together they drive the "Last updated" note.
 */
export const useDeviceStore = defineStore('device', () => {
  const data = shallowRef<DeviceData | null>(null);
  /** A complete sync succeeded since this page opened. */
  const fresh = ref(false);
  /** The last sync failed (or was incomplete). */
  const failed = ref(false);
  /** App-clock time of the last complete sync (the stored one until a fresh one comes), `null` before the first. */
  const syncedAt = computed(() => data.value?.syncedAt ?? null);
  /** The note "Last updated" shows: what is on screen has not been confirmed by the server since the app opened, or the last sync failed. */
  const noteShown = computed(() => syncedAt.value !== null && (!fresh.value || failed.value));
  /** The device holds a first full sync, so reads come from it. */
  const ready = computed(() => data.value?.cursor != null);

  /** The person the data on screen belongs to: `-` while sign-in is off. */
  let person: string | null = null;
  /** The records as last written, to write only those that changed. */
  const written: Record<string, unknown> = {};
  let pending: Disposer | null = null;
  let stops: Array<() => void> = [];
  /** Counts wipes: an answer that was on its way when the data was wiped belongs to the wiped person and is dropped. */
  let epoch = 0;
  onDeviceWipe(() => {
    epoch++;
    pending?.();
    pending = null;
    data.value = null;
    for (const k of Object.keys(written)) delete written[k];
  });

  /** The person of the session as the server says, `null` while unknown or signed out. */
  function sessionPerson(): string | null {
    const auth = useAuthStore();
    if (auth.status === 'off') return '-';
    return auth.status === 'in' && auth.email ? auth.email.toLowerCase() : null;
  }

  const file = <T>(name: DeviceFileName): T | undefined => data.value?.files[name] as T | undefined;

  /** A per-person file from the device store; the server answers only before the device has had its first sync. */
  async function read<T>(name: DeviceFileName, fetchIt: () => Promise<T>): Promise<T> {
    return file<T>(name) ?? fetchIt();
  }

  /** Hands every kind of data to the store the views read it from. */
  function hydrate(): void {
    const d = data.value;
    if (!d) return;
    if (d.config) useClockStore().restore(d.config);
    useCalendarsStore().fromDevice(d.calendars);
    const settings = file<never>('settings');
    if (settings) useSettingsStore().fromDevice(settings);
    const prefs = file<never>('prefs');
    if (prefs) usePrefsStore().fromDevice(prefs);
    useThemeStore().fromDevice(file('theme'), file<{ themes: never[] }>('themes')?.themes);
    const templates = file<{ templates: never[] }>('templates');
    if (templates) useTemplatesStore().fromDevice(templates.templates);
    const canvas = file<{ areas: never[] }>('canvas');
    if (canvas) useCanvasStore().fromDevice(canvas.areas);
    const motivation = file<never>('motivation');
    if (motivation) useMotivationStore().fromDevice(motivation);
    useItemsStore().refreshFromDevice();
  }

  /** Restores the data of the person last signed in here before the first route; the sign-in page wipes it instead. */
  async function restore(path: string): Promise<boolean> {
    if (path === '/signin') {
      await Promise.race([wipeDevice(), new Promise((resolve) => { setTimeout(resolve, RESTORE_TIMEOUT_MS); })]);
      return false;
    }
    const who = devicePerson();
    const db = deviceDb();
    if (who === null || !db) return false;
    // a hanging IndexedDB (some private modes) must not keep the app from starting: then nothing is restored
    const late = new Promise<undefined>((resolve) => { setTimeout(() => resolve(undefined), RESTORE_TIMEOUT_MS); });
    type Meta = Omit<DeviceData, 'events' | 'taskLists'>;
    let meta: Meta | undefined, events: DeviceData['events'] | undefined, lists: DeviceData['taskLists'] | undefined;
    try {
      meta = await Promise.race([db.get<Meta>('meta'), late]);
      if (!meta || meta.v !== 2 || meta.person !== who || meta.cursor == null) return false;
      [events, lists] = await Promise.all([db.get<DeviceData['events']>('events'), db.get<DeviceData['taskLists']>('lists')]);
    } catch { return false; }
    data.value = { ...meta, events: events ?? [], taskLists: lists ?? [] };
    person = who;
    hydrate();
    return true;
  }

  /** Writes the records that changed; plain data only, since reactive proxies cannot be cloned into IndexedDB. */
  async function save(): Promise<void> {
    pending = null;
    const who = sessionPerson();
    const db = deviceDb();
    const d = data.value;
    if (!who || !db || !d || d.cursor == null) return;
    const { events, taskLists, ...rest } = d;
    const next: Record<string, unknown> = { meta: { ...rest, person: who }, events, lists: taskLists };
    const entries: Record<string, unknown> = {};
    for (const k of RECORDS) if (k === 'meta' || written[k] !== next[k]) entries[k] = JSON.parse(JSON.stringify(next[k]));
    try {
      await db.putMany(entries);
      // wiped while writing: the person pointer must not come back
      if (!deviceDb()) return;
      setDevicePerson(who);
      for (const k of RECORDS) written[k] = next[k];
      mark('synced', d.syncedAt);
    } catch { /* storage full or blocked: the app works as before, without the device copy surviving a restart */ }
  }

  function scheduleSave(): void {
    if (!data.value) return;
    pending?.();
    mark('saving');
    pending = appTimeout(() => { void save(); }, SAVE_DEBOUNCE_MS);
  }

  /** Writes a save still waiting for its debounce now: the page is going away. */
  function flushSave(): void {
    if (!pending) return;
    pending();
    pending = null;
    void save();
  }

  /** Takes in an answer of `/api/changes`: applies it, keeps it and hands it on. Exposed for tests; `sync` is the entry point. */
  function take(res: ChangeSet): void {
    const clock = useClockStore();
    const base = res.full || !data.value ? emptyData(person ?? '') : data.value;
    const complete = res.events.failed.length === 0 && !res.taskLists.failed;
    const quiet = !!data.value && isQuiet(data.value, res);
    // an answer that changes nothing keeps the very same lists (so they are not rewritten) and is not handed on again
    const next = quiet ? { ...base, cursor: res.cursor, files: base.files } : applyChanges(base, res);
    // the clock's config (zone, frozen time, polling, plugins) goes with the data so a start without a connection has it
    const config = clock.loaded ? clock.config as AppConfig : next.config;
    data.value = complete ? { ...next, config, syncedAt: clock.nowMs() } : { ...next, config };
    fresh.value = complete;
    failed.value = !complete;
    if (!quiet) hydrate();
    // a sync is already one batch: it is written at once, so a page closed right after still has it
    pending?.();
    mark('saving');
    void save();
  }

  /** One round of the device sync: asks the server what changed since the cursor and takes it in. Throws on failure (the caller reports it). */
  async function sync(): Promise<void> {
    const clock = useClockStore();
    const auth = useAuthStore();
    // who is asking must be known before the device's answer may be used: another person's store is wiped by the watcher
    if (auth.status === 'unknown') await auth.check();
    const asking = sessionPerson();
    if (asking && person !== null && asking !== person) return;
    const mine = epoch;
    try {
      const res = await api.changes(data.value?.cursor ?? null, clock.today);
      // wiped or another person signed in while the answer was on its way: it is not this device's data
      const now = sessionPerson();
      if (mine !== epoch || (now && asking && now !== asking) || (now && person !== null && now !== person)) return;
      take(res);
    } catch (e) {
      failed.value = true;
      throw e;
    }
  }

  /** A successful write's answer: the item goes into the device copy at once. */
  function put(item: CalendarItem): void {
    if (!data.value) return;
    data.value = putItem(data.value, item);
    scheduleSave();
  }
  /** A successful delete (or a list that left): the item leaves the device copy. */
  function drop(id: string, calendarId?: string): void {
    if (!data.value) return;
    data.value = dropItem(data.value, id, calendarId);
    scheduleSave();
  }
  /** A successful write of a per-person file: its answer replaces the device copy. */
  function putFile(name: DeviceFileName, value: unknown): void {
    if (!data.value) return;
    data.value = { ...data.value, files: { ...data.value.files, [name]: value } };
    scheduleSave();
  }
  /** A changed list of calendars (hidden, reminder defaults). */
  function putCalendars(list: DeviceData['calendars']): void {
    if (!data.value) return;
    data.value = { ...data.value, calendars: list };
    scheduleSave();
  }

  /** Starts following the session: another person's session wipes the store and starts the page afresh; the page leaving saves. */
  function install(): () => void {
    stop();
    const auth = useAuthStore();
    stops.push(
      watch(() => [auth.status, auth.email] as const, () => {
        const who = sessionPerson();
        if (!who) return;
        if (person !== null && who !== person) {
          // nothing of the other person may stay on screen or be saved as this one's: wipe and start clean
          stop();
          data.value = null;
          useItemsStore().dropDevice();
          void wipeDevice().then(() => window.location.reload());
          return;
        }
        person = who;
        // the person is known only now: a sync that came first is saved now
        scheduleSave();
      }, { immediate: true }),
      listen(window, 'pagehide', flushSave),
      listen(document, 'visibilitychange', () => { if (document.hidden) flushSave(); }),
    );
    return stop;
  }

  function stop(): void {
    pending?.();
    pending = null;
    stops.forEach((s) => s());
    stops = [];
  }

  return {
    data, ready, noteShown, syncedAt, fresh, failed, file, read, restore, sync, take, install, stop, put, drop, putFile, putCalendars,
  };
});
