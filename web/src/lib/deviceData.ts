/**
 * What the device keeps of one person (ADR 0025) and the pure rules on it: applying an answer of `GET /api/changes`,
 * keeping events within the window, and reading items, day counts and open lists back out. No I/O and no store here,
 * so every rule is unit tested without a browser (`web/test/device-data.test.ts`).
 */
import { dedupeBirthdays } from '@calendar/shared/birthdays';
import type { AppConfig, Calendar, CalendarEvent, CalendarItem, DaySummary, LocalDate, TaskList } from '@/api/types';
import { addDays, parseIsoDate, toIsoDate } from '@/lib/dates';
import { itemSegments } from '@/lib/items';

/** The per-person files a change set can carry, by name (API.md `GET /api/changes`); each is the answer of its own GET. */
export type DeviceFileName =
  | 'settings' | 'prefs' | 'theme' | 'themes' | 'templates' | 'canvas' | 'ink' | 'motivation' | 'categoryShares' | 'people' | 'tasksCalendarReminders' | 'calendarColors';

/** Events from today minus a year to today plus a year, end exclusive. */
export interface DeviceWindow { from: LocalDate; to: LocalDate }

/** Everything one person's device holds; `cursor` is opaque (the server's position of this device). */
export interface DeviceData {
  v: 2;
  person: string;
  cursor: string | null;
  /** App-clock time (ms) of the last complete successful sync; `null` before the first one. */
  syncedAt: number | null;
  window: DeviceWindow | null;
  config: AppConfig | null;
  calendars: Array<Calendar & { hidden?: boolean }>;
  events: CalendarEvent[];
  taskLists: TaskList[];
  files: Partial<Record<DeviceFileName, unknown>>;
  /** The next sync reads everything again (a category changed, which the change stream does not report on the lists). */
  needFull?: true;
}

/** The answer of `GET /api/changes` (API.md). */
export interface ChangeSet {
  full: boolean;
  cursor: string;
  window: DeviceWindow;
  calendars: Array<Calendar & { hidden?: boolean }>;
  events: {
    calendars: string[]; replace: string[]; series: Array<{ calendarId: string; seriesId: string }>;
    removed: Array<{ calendarId: string; id: string }>; upserts: CalendarEvent[]; failed: string[];
  };
  taskLists: { replace: boolean; series: string[]; removed: string[]; upserts: TaskList[]; failed: boolean };
  files: Partial<Record<DeviceFileName, unknown>>;
}

/** An empty store for `person`. */
export function emptyData(person: string): DeviceData {
  return { v: 2, person, cursor: null, syncedAt: null, window: null, config: null, calendars: [], events: [], taskLists: [], files: {} };
}

/** The window the server keeps for a device whose today is `today` (as `windowOf` in the server's change feed). */
export function windowOf(today: LocalDate): DeviceWindow {
  const d = parseIsoDate(today)!;
  return { from: toIsoDate(addDays(d, -365)), to: toIsoDate(addDays(d, 366)) };
}

const touches = (it: CalendarItem, from: LocalDate, to: LocalDate): boolean => itemSegments(it).some((s) => s.date >= from && s.date < to);

/**
 * Whether `id` is (an instance of) the repeating series `seriesId`. Google names an instance `<series>_<start>`, the start
 * being `YYYYMMDD` (all-day) or `YYYYMMDDTHHMMSSZ`; the change set carries no series field on events, so the id is the only link.
 * Requiring that start keeps a plain event whose id merely begins with `<series>_` out of it.
 */
const inSeries = (id: string, seriesId: string): boolean => id === seriesId || (id.startsWith(`${seriesId}_`) && /^\d{8}(T\d{6}Z)?$/.test(id.slice(seriesId.length + 1)));

/** Keeps the events that touch the window; task lists are never pruned. */
function pruneWindow(data: DeviceData, w: DeviceWindow): DeviceData {
  return { ...data, window: w, events: data.events.filter((e) => touches(e, w.from, w.to)) };
}

/** Recolours the events that follow a calendar whose colour changed (`colorId` null, old colour); the same list when none did. */
export function recolourEvents(events: CalendarEvent[], before: DeviceData['calendars'], after: DeviceData['calendars']): CalendarEvent[] {
  const was = new Map(before.filter((c) => c.color).map((c) => [c.id, c.color.toLowerCase()]));
  const now = new Map(after.filter((c) => c.color && was.has(c.id) && was.get(c.id) !== c.color.toLowerCase()).map((c) => [c.id, c.color]));
  if (now.size === 0) return events;
  return events.map((e) => (now.has(e.calendarId) && e.colorId === null && e.color.toLowerCase() === was.get(e.calendarId) ? { ...e, color: now.get(e.calendarId)! } : e));
}

export type CalendarSetting = 'colour' | 'hidden' | 'default reminders';

/** Which settings (colour, hidden, default reminders) differ per calendar between two lists. */
export function calendarSettingChanges(a: DeviceData['calendars'], b: DeviceData['calendars']): Array<{ id: string; setting: CalendarSetting }> {
  const was = new Map(a.map((c) => [c.id, c]));
  return b.flatMap((c) => {
    const o = was.get(c.id);
    if (!o) return [];
    const out: Array<{ id: string; setting: CalendarSetting }> = [];
    if ((o.color ?? '').toLowerCase() !== (c.color ?? '').toLowerCase()) out.push({ id: c.id, setting: 'colour' });
    if (!!o.hidden !== !!c.hidden) out.push({ id: c.id, setting: 'hidden' });
    if (JSON.stringify(o.defaultReminders ?? null) !== JSON.stringify(c.defaultReminders ?? null)) out.push({ id: c.id, setting: 'default reminders' });
    return out;
  });
}

/** How long a local change of a calendar setting counts as "just made" when a sync answer replaces it. */
const RECENT_LOCAL_MS = 120_000;

/** The settings a sync answer replaces although this device set them within {@link RECENT_LOCAL_MS}; `touched` maps `id:setting` to the time of the local change. */
export function replacedSettings(held: DeviceData['calendars'], incoming: DeviceData['calendars'], touched: Map<string, number>, now: number): Array<{ setting: CalendarSetting; agoS: number }> {
  return calendarSettingChanges(held, incoming).flatMap(({ id, setting }) => {
    const at = touched.get(`${id}:${setting}`);
    return at !== undefined && now - at < RECENT_LOCAL_MS ? [{ setting, agoS: Math.round((now - at) / 1000) }] : [];
  });
}

/** The Google calendar an event is read from: what the change feed's calendar ids name (a birthday shows under the Birthdays calendar). */
const sourceOf = (e: CalendarEvent): string => e.sourceCalendarId ?? e.calendarId;

/**
 * Applies one answer: calendars first, then per kind the replace / series / removed drops, then the upserts, then the
 * files (the order API.md prescribes). A calendar listed in `failed` keeps its stored events. Returns a new value.
 */
export function applyChanges(data: DeviceData, res: ChangeSet): DeviceData {
  const ev = res.events, tl = res.taskLists;
  const cals = new Set(ev.calendars);
  const replaced = new Set(ev.replace);
  let events = data.events.filter((e) => cals.has(sourceOf(e)) && !replaced.has(sourceOf(e)));
  for (const s of ev.series) events = events.filter((e) => !(sourceOf(e) === s.calendarId && inSeries(e.id, s.seriesId)));
  const gone = new Set(ev.removed.map((r) => `${r.calendarId}\n${r.id}`));
  events = events.filter((e) => !gone.has(`${sourceOf(e)}\n${e.id}`));
  // a calendar recoloured elsewhere: the events that follow it change colour, Google sends none of them again
  events = recolourEvents(events, data.calendars, res.calendars);
  const byKey = new Map(events.map((e) => [`${sourceOf(e)}\n${e.id}`, e]));
  for (const e of ev.upserts) byKey.set(`${sourceOf(e)}\n${e.id}`, e);

  let lists = tl.replace ? data.taskLists.filter((l) => l.id.startsWith('shared:')) : data.taskLists;
  for (const s of tl.series) lists = lists.filter((l) => !(l.seriesId === s || inSeries(l.id, s)));
  const removed = new Set(tl.removed);
  lists = lists.filter((l) => !removed.has(l.id));
  const byId = new Map(lists.map((l) => [l.id, l]));
  for (const l of tl.upserts) byId.set(l.id, l);

  // a calendar that failed keeps its old window end (as the server's cursor does), so the days it missed are not shown as empty
  const w = (ev.failed.length > 0 || tl.failed) && data.window ? { from: res.window.from, to: data.window.to } : res.window;
  return pruneWindow({
    ...data, cursor: res.cursor, calendars: res.calendars, events: [...byKey.values()],
    taskLists: [...byId.values()], files: { ...data.files, ...res.files },
  }, w);
}

/** Whether an answer changes nothing the device holds but its cursor (same window, no changes, no files, nothing failed). */
export function isQuiet(data: DeviceData, res: ChangeSet): boolean {
  const e = res.events, t = res.taskLists;
  return !res.full && !!data.window && data.window.from === res.window.from && data.window.to === res.window.to
    && e.replace.length === 0 && e.series.length === 0 && e.removed.length === 0 && e.upserts.length === 0 && e.failed.length === 0
    && !t.replace && t.series.length === 0 && t.removed.length === 0 && t.upserts.length === 0 && !t.failed
    && Object.keys(res.files).length === 0 && JSON.stringify(data.calendars) === JSON.stringify(res.calendars);
}

/** The items (events and dated task lists) that touch `[from, to)`. */
export function itemsIn(data: DeviceData, from: LocalDate, to: LocalDate): CalendarItem[] {
  return [...dedupeBirthdays(data.events), ...data.taskLists].filter((it) => touches(it, from, to));
}

/** Whether `[from, to)` lies inside the window, so the device holds all of it (outside, the server is asked). */
export function covers(data: DeviceData, from: LocalDate, to: LocalDate): boolean {
  return !!data.window && from >= data.window.from && to <= data.window.to;
}

/** Day counts for `[from, to)` as `GET /api/summary` answers them, computed from the held items. */
export function summaryOf(data: DeviceData, from: LocalDate, to: LocalDate): Record<LocalDate, DaySummary> {
  const days: Record<LocalDate, DaySummary> = {};
  for (const it of [...dedupeBirthdays(data.events), ...data.taskLists]) {
    for (const s of itemSegments(it)) {
      if (s.date < from || s.date >= to) continue;
      const row = (days[s.date] ??= { events: 0, tasklists: 0, openTasklists: 0, density: 0 });
      if (it.kind === 'tasklist') { row.tasklists++; if (it.doneCount < it.totalCount) row.openTasklists++; } else row.events++;
    }
  }
  for (const r of Object.values(days)) {
    const n = r.events + r.tasklists;
    r.density = n >= 4 ? 3 : n >= 2 ? 2 : 1;
  }
  return days;
}

/** Puts a written item (the server's answer to a create or change) into the held data, replacing its older copy. */
export function putItem(data: DeviceData, item: CalendarItem): DeviceData {
  if (item.kind === 'event') {
    const rest = data.events.filter((e) => !(e.calendarId === item.calendarId && e.id === item.id));
    return { ...data, events: touches(item, data.window?.from ?? '0000-01-01', data.window?.to ?? '9999-12-31') ? [...rest, item] : rest };
  }
  return { ...data, taskLists: [...data.taskLists.filter((l) => l.id !== item.id), item] };
}

/** Takes a deleted item out of the held data; an event is told apart by its calendar (ids repeat across calendars). */
export function dropItem(data: DeviceData, id: string, calendarId?: string): DeviceData {
  return {
    ...data,
    events: data.events.filter((e) => !(e.id === id && (calendarId === undefined || e.calendarId === calendarId))),
    taskLists: data.taskLists.filter((l) => l.id !== id),
  };
}
