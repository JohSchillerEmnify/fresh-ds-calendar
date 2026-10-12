/**
 * Test-side copy of the task list <-> Google event encoding (ARCHITECTURE.md §3), used by the "Google ..." steps to
 * act on the provider as the official Google Calendar app (or another client) would.
 */
import type { GoogleEvent } from './api.js';
import { addDays } from './dates.js';

export interface RawItem { id: string; t: string; d: 0 | 1 }

const CHUNK_LIMIT = 1024;
const CHUNK_SIZE = 1000;

export function isTaskList(ev: GoogleEvent): boolean {
  return ev.extendedProperties?.private?.kind === 'tasklist';
}

/** Concatenate `items` + `items_1..n-1` (n = itemsChunks). */
export function readItemsJson(priv: Record<string, string>): string | undefined {
  if (priv.items === undefined) return undefined;
  const n = Number(priv.itemsChunks ?? '1');
  let json = priv.items;
  for (let i = 1; i < n; i++) json += priv[`items_${i}`] ?? '';
  return json;
}

export function readItems(ev: GoogleEvent): RawItem[] {
  const json = readItemsJson(ev.extendedProperties?.private ?? {});
  return json ? (JSON.parse(json) as RawItem[]) : [];
}

export function chunkCount(ev: GoogleEvent): number {
  const priv = ev.extendedProperties?.private ?? {};
  const declared = Number(priv.itemsChunks ?? '1');
  const present = 1 + Object.keys(priv).filter((k) => /^items_\d+$/.test(k) && priv[k]).length;
  return Math.max(declared, priv.items === undefined ? 0 : present);
}

export function describeItems(items: RawItem[]): string {
  return items.map((i) => `${i.d ? '☑' : '☐'} ${i.t}`).join('\n');
}

/**
 * Private extended properties for the given items, chunked like the server does. `previous` lets the writer blank
 * stale higher chunks with '' (Google patch semantics: deep merge of `private`).
 */
export function encodeItems(items: RawItem[], previous: Record<string, string> = {}): Record<string, string> {
  const json = JSON.stringify(items);
  const out: Record<string, string> = {};
  for (const k of Object.keys(previous)) if (/^items_\d+$/.test(k) || k === 'itemsChunks') out[k] = '';
  if (json.length <= CHUNK_LIMIT) {
    out.items = json;
  } else {
    const slices: string[] = [];
    for (let i = 0; i < json.length; i += CHUNK_SIZE) slices.push(json.slice(i, i + CHUNK_SIZE));
    out.items = slices[0];
    slices.slice(1).forEach((s, i) => (out[`items_${i + 1}`] = s));
    out.itemsChunks = String(slices.length);
  }
  return out;
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
export function itemId(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

/** Resolve a dotted path (`extendedProperties.private.kind`, `start.dateTime`) in a JSON value. */
export function dig(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((v, k) => (v == null ? undefined : (v as Record<string, unknown>)[k]), value);
}

/**
 * A task list event as another Google client would insert it (all-day, items in extended properties) into the
 * person's tasks calendar (`calendarId`, see `Api.tasksCalendarId`).
 */
export function googleTaskListBody(calendarId: string, title: string, date: string, items: { title: string; done: boolean }[]) {
  const raw: RawItem[] = items.map((i) => ({ id: itemId(), t: i.title, d: i.done ? 1 : 0 }));
  return {
    calendarId,
    summary: title,
    description: describeItems(raw),
    start: { date },
    end: { date: addDays(date, 1) },
    extendedProperties: { private: { kind: 'tasklist', tlv: '1', ...encodeItems(raw) } },
  };
}
