import { TITLE_MAX } from '@calendar/shared/limits';
import { stableId } from '../lib/ids.js';
import { addDays, formatInZone, localDateOf, localTimeOf, zonedToUtc } from '../lib/time.js';
import type { CanvasPlace, Category, Recurrence, TaskItem } from '../api/types.js';
import type { GoogleEvent, GoogleEventInput, GoogleEventPatch } from '../providers/CalendarProvider.js';

export const MAX_PRIVATE_BYTES = 30_000;
/** Largest stored Canvas coordinate (feature tasks-canvas): larger than the board, so the board can grow. */
const CANVAS_MAX = 10_000;
const CHUNK = 1000;
const SINGLE_MAX = 1024;
/** The all-day date that stores undated task lists in Google (ADR 0017). */
export const UNDATED_ANCHOR = '2099-12-31';
const RRULE: Record<Recurrence, string> = { daily: 'RRULE:FREQ=DAILY', weekly: 'RRULE:FREQ=WEEKLY', monthly: 'RRULE:FREQ=MONTHLY' };

export interface TaskListData {
  title: string;
  /** Null = undated: stored on {@link UNDATED_ANCHOR} with the `undated` marker, never with a time. */
  date: string | null;
  time: string | null;
  items: TaskItem[];
  categoryId: string | null;
  tags: string[];
  estimateMinutes: number | null;
  recurrence: Recurrence | null;
  /** App-clock date of the write that ticked the last open item; null while an item is open or when unknown. */
  completedOn: string | null;
  /** App-clock date the list was created on; absent on lists made before it was stored (they carry over as before). */
  createdOn?: string | null;
  /** The note's place on the Canvas (`cx`, `cy`); null = none yet. */
  canvas: CanvasPlace | null;
}

const isFinished = (items: TaskItem[]): boolean => items.length > 0 && items.every((i) => i.done);

/** `completedOn` after a write: today when the write finishes the list, the old value while it stays finished, else null. */
export function nextCompletedOn(before: Pick<TaskListData, 'items' | 'completedOn'>, after: Pick<TaskListData, 'items'>, today: string): string | null {
  if (!isFinished(after.items)) return null;
  return isFinished(before.items) ? before.completedOn : today;
}

/**
 * The date a write gives an undated list that it finishes: today, or null when the list stays as it is. Only a write
 * that ticks the last open item of an undated list re-dates it (a list that was already complete is left alone), and
 * not at all with the setting "Archive only" (`undatedDone = 'archive'`: the list stays undated, feature tasks-archive).
 */
export function dateOnCompletion(
  before: Pick<TaskListData, 'items' | 'date'>, after: Pick<TaskListData, 'items' | 'date'>, today: string, undatedDone: 'calendar' | 'archive' = 'calendar',
): string | null {
  if (undatedDone === 'archive') return null;
  return before.date === null && after.date === null && !isFinished(before.items) && isFinished(after.items) ? today : null;
}

/** Whether the event is an undated task list (anchor-dated, `undated = "1"`). */
export function isUndatedEvent(ev: GoogleEvent): boolean {
  return ev.extendedProperties?.private?.undated === '1';
}

export function isTaskListEvent(ev: GoogleEvent): boolean {
  return ev.extendedProperties?.private?.kind === 'tasklist';
}

/** What Google shows for an ink item (decision A3). */
const INK_PLACEHOLDER = 'Handwritten item';

export function mirror(items: TaskItem[]): string {
  return items.map((i) => `${i.done ? '☑' : '☐'} ${i.ink ? INK_PLACEHOLDER : i.title}`).join('\n');
}

/** Serialises items into `items`, `items_1..` + `itemsChunks`. Absent keys are `null` (to delete when patching). */
export function encodeItems(items: TaskItem[]): Record<string, string | null> {
  const json = JSON.stringify(items.map((i) => ({ id: i.id, t: i.title, d: i.done ? 1 : 0, ...(i.ink ? { k: 1 } : {}) })));
  const out: Record<string, string | null> = {};
  if (json.length <= SINGLE_MAX) {
    out.items = json;
    out.itemsChunks = null;
  } else {
    const n = Math.ceil(json.length / CHUNK);
    for (let i = 0; i < n; i++) out[i === 0 ? 'items' : `items_${i}`] = json.slice(i * CHUNK, (i + 1) * CHUNK);
    out.itemsChunks = String(n);
  }
  return out;
}

/** All keys this codec may write; used to null out stale ones. */
function staleChunkKeys(existing: Record<string, string> | undefined, written: Record<string, string | null>): Record<string, null> {
  const out: Record<string, null> = {};
  for (const k of Object.keys(existing ?? {})) if (/^items_\d+$/.test(k) && written[k] == null) out[k] = null;
  return out;
}

export function encodePrivate(d: TaskListData, existing?: Record<string, string>): Record<string, string | null> {
  const p: Record<string, string | null> = {
    kind: 'tasklist',
    tlv: '1',
    // An untitled list is truly titleless: empty Google summary and empty app title.
    untitled: d.title ? null : '1',
    undated: d.date === null ? '1' : null,
    ...encodeItems(d.items),
    categoryId: d.categoryId,
    tags: d.tags.length ? JSON.stringify(d.tags) : null,
    estimate: d.estimateMinutes === null ? null : String(d.estimateMinutes),
    recurrence: d.recurrence,
    completedOn: d.completedOn,
    createdOn: d.createdOn ?? null,
    // the marker the Archive reads with `privateExtendedProperty=done=1`; derived from the items so it cannot disagree
    done: isFinished(d.items) ? '1' : null,
    cx: d.canvas ? String(d.canvas.x) : null,
    cy: d.canvas ? String(d.canvas.y) : null,
  };
  Object.assign(p, staleChunkKeys(existing, p));
  return p;
}

/** Google summary: the title; empty for an untitled list, so no task ever becomes the event's title in Google's apps. */
function summaryOf(d: TaskListData): string {
  return d.title;
}

export function privateSize(p: Record<string, string | null>): number {
  let n = 0;
  for (const [k, v] of Object.entries(p)) if (v != null) n += k.length + v.length;
  return n;
}

function times(d: TaskListData, tz: string) {
  const date = d.date ?? UNDATED_ANCHOR;
  if (d.date === null || d.time === null) return { start: { date }, end: { date: addDays(date, 1) } };
  const s = zonedToUtc(d.date, d.time, tz);
  const e = s + (d.estimateMinutes ?? 30) * 60_000;
  return {
    start: { dateTime: formatInZone(s, tz), timeZone: tz },
    end: { dateTime: formatInZone(e, tz), timeZone: tz },
  };
}

export function categoryColorId(cats: Category[], categoryId: string | null): string | null {
  return cats.find((c) => c.id === categoryId)?.googleColorId ?? null;
}

export function encodeTaskList(d: TaskListData, tz: string, colorId: string | null): GoogleEventInput {
  const priv: Record<string, string> = {};
  for (const [k, v] of Object.entries(encodePrivate(d))) if (v != null) priv[k] = v;
  const ev: GoogleEventInput = {
    summary: summaryOf(d),
    description: mirror(d.items),
    ...times(d, tz),
    extendedProperties: { private: priv },
  };
  if (colorId) ev.colorId = colorId;
  if (d.recurrence) ev.recurrence = [RRULE[d.recurrence]];
  return ev;
}

/** The series' RRULE has this rhythm already (its UNTIL / COUNT, EXDATE lines and other parts then stay as they are). */
function sameRhythm(lines: string[] | undefined, r: Recurrence): boolean {
  const freq = RRULE[r].slice('RRULE:'.length);
  return !!lines?.some((l) => l.startsWith('RRULE:') && l.slice(6).split(';').includes(freq));
}

/** Full-replacement patch for an existing task list event (null removes stale keys/fields). */
export function encodeTaskListPatch(d: TaskListData, tz: string, colorId: string | null, existing: GoogleEvent): GoogleEventPatch {
  const patch: GoogleEventPatch = {
    summary: summaryOf(d),
    description: mirror(d.items),
    ...times(d, tz),
    colorId,
    extendedProperties: { private: encodePrivate(d, existing.extendedProperties?.private) },
  };
  // Only masters carry the rule; never rewrite it on an instance.
  if (!existing.recurringEventId) {
    // a rule of the same rhythm stays as it is: a series ended by a split keeps its UNTIL
    if (d.recurrence) { if (!sameRhythm(existing.recurrence, d.recurrence)) patch.recurrence = [RRULE[d.recurrence]]; }
    else (patch as { recurrence?: string[] | null }).recurrence = null as unknown as string[];
  }
  return patch;
}

/** The Canvas place from `cx` / `cy`: both must be integer strings in 0..{@link CANVAS_MAX}, else none. */
export function readCanvas(p: Record<string, string>): CanvasPlace | null {
  const ok = (v: string | undefined): v is string => v !== undefined && /^\d{1,5}$/.test(v) && Number(v) <= CANVAS_MAX;
  return ok(p.cx) && ok(p.cy) ? { x: Number(p.cx), y: Number(p.cy) } : null;
}

export function parseDescription(desc: string | undefined): TaskItem[] {
  const items: TaskItem[] = [];
  const lines = (desc ?? '').split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const m = /^(☐|☑|\[ \]|\[x\])\s*(.*)$/i.exec(line);
    const title = (m ? m[2]! : line).trim().slice(0, TITLE_MAX);
    if (!title) return;
    const done = !!m && (m[1] === '☑' || m[1]!.toLowerCase() === '[x]');
    items.push({ id: stableId(`${idx}:${title}`), title, done });
  });
  return items.slice(0, 200);
}

export function readItems(ev: GoogleEvent): TaskItem[] {
  const p = ev.extendedProperties?.private ?? {};
  if (p.items === undefined) return parseDescription(ev.description);
  let json = p.items;
  const n = Number(p.itemsChunks ?? 1);
  if (n > 1) for (let i = 1; i < n; i++) json += p[`items_${i}`] ?? '';
  try {
    const arr = JSON.parse(json) as { id: string; t: string; d: number; k?: number }[];
    if (!Array.isArray(arr)) throw new Error('bad');
    return arr.map((x) => ({ id: String(x.id), title: String(x.t), done: x.d === 1, ...(x.k === 1 ? { ink: true as const } : {}) }));
  } catch {
    return parseDescription(ev.description);
  }
}

/** A stored `YYYY-MM-DD` day, else null (a missing or malformed value reads as unknown). */
function isoDay(v: string | undefined): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function decodeTaskList(ev: GoogleEvent, tz: string): TaskListData {
  const p = ev.extendedProperties?.private ?? {};
  let date: string | null;
  let time: string | null = null;
  if (p.undated === '1') date = null;
  else if (ev.start.date) date = ev.start.date;
  else {
    const ms = Date.parse(ev.start.dateTime!);
    date = localDateOf(ms, tz);
    time = localTimeOf(ms, tz);
  }
  let tags: string[] = [];
  if (p.tags) {
    try {
      const t = JSON.parse(p.tags);
      if (Array.isArray(t)) tags = t.filter((x): x is string => typeof x === 'string');
    } catch { /* ignore */ }
  }
  const est = p.estimate !== undefined ? Number(p.estimate) : NaN;
  let recurrence: Recurrence | null = null;
  const r = p.recurrence ?? /FREQ=(DAILY|WEEKLY|MONTHLY)/.exec(ev.recurrence?.find((l) => l.startsWith('RRULE:')) ?? '')?.[1]?.toLowerCase();
  if (r === 'daily' || r === 'weekly' || r === 'monthly') recurrence = r;
  return {
    title: p.untitled === '1' ? '' : ev.summary ?? '',
    date,
    time,
    items: readItems(ev),
    categoryId: p.categoryId || null,
    tags,
    estimateMinutes: Number.isFinite(est) ? est : null,
    recurrence,
    completedOn: isoDay(p.completedOn),
    createdOn: isoDay(p.createdOn),
    canvas: readCanvas(p),
  };
}
