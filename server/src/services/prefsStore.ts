import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { userDir } from '../auth/people.js';

/** The person used while sign-in is off. */
export const LOCAL_PERSON = 'local';

interface Prefs {
  hiddenCalendars: string[]; labs: boolean; approachBar: boolean;
  /** The person's "Calendar app: tasks" calendar, once found or created (ARCHITECTURE §3). */
  tasksCalendarId: string | null;
  /** "Show tasks calendar in Google": the tasks calendar's entry in Google's list is not hidden. */
  tasksCalendarVisible: boolean;
}

/** The experimental-feature switches returned by `GET /api/prefs`. */
export interface LabsPrefs { labs: boolean; approachBar: boolean }

/** Per-person preferences in `DATA_DIR/users/<sub>/prefs.json` (hidden calendars, Labs switches, tasks calendar). */
export class PrefsStore {
  constructor(private readonly dataDir: string) {}

  private file(sub: string): string {
    return path.join(userDir(this.dataDir, sub), 'prefs.json');
  }

  private read(sub: string): Prefs {
    const p = readJson<Partial<Prefs>>(this.file(sub));
    return {
      hiddenCalendars: Array.isArray(p?.hiddenCalendars) ? p.hiddenCalendars : [],
      labs: p?.labs === true,
      approachBar: p?.approachBar === true,
      tasksCalendarId: typeof p?.tasksCalendarId === 'string' && p.tasksCalendarId ? p.tasksCalendarId : null,
      tasksCalendarVisible: p?.tasksCalendarVisible === true,
    };
  }

  private merge(sub: string, patch: Partial<Prefs>): Prefs {
    const p = { ...this.read(sub), ...patch };
    writeJsonAtomic(this.file(sub), p satisfies Prefs);
    return p;
  }

  hiddenCalendars(sub: string): string[] {
    return this.read(sub).hiddenCalendars;
  }

  setHidden(sub: string, calendarId: string, hidden: boolean): void {
    const p = this.read(sub);
    const rest = p.hiddenCalendars.filter((i) => i !== calendarId);
    writeJsonAtomic(this.file(sub), { ...p, hiddenCalendars: hidden ? [...rest, calendarId] : rest } satisfies Prefs);
  }

  labsPrefs(sub: string): LabsPrefs {
    const { labs, approachBar } = this.read(sub);
    return { labs, approachBar };
  }

  /** Merges the given Labs switches into the person's preferences and returns the result. */
  setLabs(sub: string, patch: Partial<LabsPrefs>): LabsPrefs {
    const p = { ...this.read(sub), ...patch };
    writeJsonAtomic(this.file(sub), p satisfies Prefs);
    return { labs: p.labs, approachBar: p.approachBar };
  }

  tasksCalendarId(sub: string): string | null {
    return this.read(sub).tasksCalendarId;
  }

  setTasksCalendarId(sub: string, id: string): void {
    this.merge(sub, { tasksCalendarId: id });
  }

  tasksCalendarVisible(sub: string): boolean {
    return this.read(sub).tasksCalendarVisible;
  }

  setTasksCalendarVisible(sub: string, visible: boolean): void {
    this.merge(sub, { tasksCalendarVisible: visible });
  }

  /** Forgets every person's preferences (test reset). */
  reset(): void {
    const users = path.join(this.dataDir, 'users');
    if (!fs.existsSync(users)) return;
    for (const u of fs.readdirSync(users)) fs.rmSync(path.join(users, u, 'prefs.json'), { force: true });
  }
}
