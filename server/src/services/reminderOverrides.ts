/**
 * The person's own reminders for events they can only read (feature reminders): Google has no per-event reminders for
 * events of a calendar the person can only read, so the app keeps them per person and applies them when it reads the
 * event. One file per person, `DATA_DIR/users/<sub>/reminder-overrides.json`, part of the Drive backup like every file
 * under `users/<sub>/`. Files of the older format (path memory, kept calendar defaults) are read for their `events` only.
 */
import fs from 'node:fs';
import { isRecord, PersonJsonStore } from '../lib/personJsonStore.js';
import type { Reminders } from '../api/types.js';

interface Stored {
  /** Calendar id -> event id -> the person's reminders for that event. */
  events: Record<string, Record<string, Reminders>>;
}

const FILE = 'reminder-overrides.json';

/** Per-person reminder overrides of read-only events. */
export class ReminderOverrideStore {
  private cache = new Map<string, { stamp: string; data: Stored }>();

  private readonly files: PersonJsonStore<Stored>;

  constructor(dataDir: string) {
    this.files = new PersonJsonStore<Stored>(dataDir, FILE,
      (r) => (isRecord(r) ? { events: (r.events ?? {}) as Stored['events'] } : null), () => ({ events: {} }));
  }

  /** The stored data, re-read when the file changed (a backup restore rewrites it). */
  private read(sub: string): Stored {
    const file = this.files.path(sub);
    let stamp = 'none';
    try {
      const s = fs.statSync(file);
      stamp = `${s.mtimeMs}:${s.size}`;
    } catch {
      // no file yet: empty
    }
    const hit = this.cache.get(sub);
    if (hit && hit.stamp === stamp) return hit.data;
    const data = this.files.read(sub);
    this.cache.set(sub, { stamp, data });
    return data;
  }

  private write(sub: string, data: Stored): void {
    this.files.write(sub, data);
    this.cache.delete(sub);
  }

  /** The person's reminders for this event, or `undefined` when the app keeps none. */
  get(sub: string, calendarId: string, eventId: string): Reminders | undefined {
    return this.read(sub).events[calendarId]?.[eventId];
  }

  /** Every override of the person, `calendar id -> event id -> reminders`. */
  all(sub: string): Record<string, Record<string, Reminders>> {
    return this.read(sub).events;
  }

  /** Keeps the reminders of an event as the app's own. */
  set(sub: string, calendarId: string, eventId: string, reminders: Reminders): void {
    const d = structuredClone(this.read(sub));
    (d.events[calendarId] ??= {})[eventId] = reminders;
    this.write(sub, d);
  }

  /** Forgets every person's overrides (test reset). */
  reset(): void {
    this.cache.clear();
    this.files.reset();
  }
}
