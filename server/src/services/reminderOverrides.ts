/**
 * The person's own reminders for events they can only read, and the default reminders of calendars they can only read
 * (feature reminders): Google refused to store them, so the app keeps them per person and applies them when it reads the
 * event or the calendar list. One file per person,
 * `DATA_DIR/users/<sub>/reminder-overrides.json`, part of the Drive backup like every file under `users/<sub>/`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { listUserSubs, userDir } from '../auth/people.js';
import type { Reminders } from '../api/types.js';

/** How reminder changes of a calendar's read-only events were last stored: in Google, or only in the app. */
export type ReminderPath = 'google' | 'local';

interface Stored {
  /** Per calendar id: the path that worked last, so a refused calendar is not asked again every time. */
  paths: Record<string, ReminderPath>;
  /** Per calendar id: when `local` was recorded (epoch ms); it expires so Google is asked again. */
  localSince: Record<string, number>;
  /** Calendar id -> event id -> the person's reminders for that event. */
  events: Record<string, Record<string, Reminders>>;
  /** Calendar id -> the person's popup default list kept by the app, and when Google last refused it (epoch ms). */
  defaults: Record<string, KeptDefaults>;
}

/** A read-only calendar's popup defaults kept by the app; `since` makes Google be asked again after a day. */
export interface KeptDefaults {
  minutes: number[];
  since: number;
}

const FILE = 'reminder-overrides.json';
/** How long a refusal is remembered before Google is asked again (a calendar's sharing may have changed). */
export const LOCAL_PATH_TTL_MS = 24 * 3_600_000;

/** Per-person reminder overrides of read-only events and the remembered storage path per calendar. */
export class ReminderOverrideStore {
  private cache = new Map<string, { stamp: string; data: Stored }>();

  constructor(private readonly dataDir: string) {}

  private file(sub: string): string {
    return path.join(userDir(this.dataDir, sub), FILE);
  }

  /** The stored data, re-read when the file changed (a backup restore rewrites it). */
  private read(sub: string): Stored {
    const file = this.file(sub);
    let stamp = 'none';
    try {
      const s = fs.statSync(file);
      stamp = `${s.mtimeMs}:${s.size}`;
    } catch {
      // no file yet: empty
    }
    const hit = this.cache.get(sub);
    if (hit && hit.stamp === stamp) return hit.data;
    const raw = stamp === 'none' ? null : readJson<Partial<Stored>>(file);
    const data: Stored = { paths: raw?.paths ?? {}, localSince: raw?.localSince ?? {}, events: raw?.events ?? {}, defaults: raw?.defaults ?? {} };
    this.cache.set(sub, { stamp, data });
    return data;
  }

  private write(sub: string, data: Stored): void {
    writeJsonAtomic(this.file(sub), data);
    this.cache.delete(sub);
  }

  /** The person's reminders for this event, or `undefined` when the app keeps none. */
  get(sub: string, calendarId: string, eventId: string): Reminders | undefined {
    return this.read(sub).events[calendarId]?.[eventId];
  }

  /** The path remembered for the calendar at `now` (epoch ms), or `undefined` before the first change there or once a `local` record is older than a day. */
  pathOf(sub: string, calendarId: string, now: number): ReminderPath | undefined {
    const d = this.read(sub);
    if (d.paths[calendarId] === 'local' && now - (d.localSince[calendarId] ?? 0) >= LOCAL_PATH_TTL_MS) return undefined;
    return d.paths[calendarId];
  }

  /** Remembers the reminders of an event as the app's own and that the calendar needs this path. */
  setLocal(sub: string, calendarId: string, eventId: string, reminders: Reminders, now: number): void {
    const d = structuredClone(this.read(sub));
    d.paths[calendarId] = 'local';
    d.localSince[calendarId] = now;
    (d.events[calendarId] ??= {})[eventId] = reminders;
    this.write(sub, d);
  }

  /** Remembers that Google took the change (and drops the event's own copy, Google is the source again). */
  setGoogle(sub: string, calendarId: string, eventId: string): void {
    const d = structuredClone(this.read(sub));
    d.paths[calendarId] = 'google';
    delete d.localSince[calendarId];
    if (d.events[calendarId]) {
      delete d.events[calendarId][eventId];
      if (Object.keys(d.events[calendarId]).length === 0) delete d.events[calendarId];
    }
    this.write(sub, d);
  }

  /** The popup defaults the app keeps for a calendar, or `undefined` while Google holds them. */
  defaultsOf(sub: string, calendarId: string): number[] | undefined {
    return this.read(sub).defaults[calendarId]?.minutes;
  }

  /** True while a refusal of the calendar's defaults is younger than a day, so Google is not asked again yet. */
  defaultsRefusedAt(sub: string, calendarId: string, now: number): boolean {
    const kept = this.read(sub).defaults[calendarId];
    return !!kept && now - kept.since < LOCAL_PATH_TTL_MS;
  }

  /** Keeps the calendar's popup defaults in the app, stamped `now` like the events' `local` path. */
  setLocalDefaults(sub: string, calendarId: string, minutes: number[], now: number): void {
    const d = structuredClone(this.read(sub));
    d.defaults[calendarId] = { minutes: [...minutes], since: now };
    this.write(sub, d);
  }

  /** Drops the kept defaults of a calendar: Google took them and is the source again. */
  setGoogleDefaults(sub: string, calendarId: string): void {
    if (!this.read(sub).defaults[calendarId]) return;
    const d = structuredClone(this.read(sub));
    delete d.defaults[calendarId];
    this.write(sub, d);
  }

  /** Forgets every person's overrides (test reset). */
  reset(): void {
    this.cache.clear();
    for (const u of listUserSubs(this.dataDir)) fs.rmSync(path.join(userDir(this.dataDir, u), FILE), { force: true });
  }
}
