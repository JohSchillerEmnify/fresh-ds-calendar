import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { userDir } from '../auth/people.js';

/** The person used while sign-in is off. */
export const LOCAL_PERSON = 'local';

interface Prefs { hiddenCalendars: string[]; labs: boolean; approachBar: boolean }

/** The experimental-feature switches returned by `GET /api/prefs`. */
export interface LabsPrefs { labs: boolean; approachBar: boolean }

/** Per-person preferences in `DATA_DIR/users/<sub>/prefs.json` (hidden calendars, Labs switches). */
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
    };
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

  /** Forgets every person's preferences (test reset). */
  reset(): void {
    const users = path.join(this.dataDir, 'users');
    if (!fs.existsSync(users)) return;
    for (const u of fs.readdirSync(users)) fs.rmSync(path.join(users, u, 'prefs.json'), { force: true });
  }
}
