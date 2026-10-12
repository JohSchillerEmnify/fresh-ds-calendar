import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { userDir } from '../auth/people.js';

/** The person used while sign-in is off. */
export const LOCAL_PERSON = 'local';

interface Prefs { hiddenCalendars: string[] }

/** Per-person preferences in `DATA_DIR/users/<sub>/prefs.json` (hidden calendars). */
export class PrefsStore {
  constructor(private readonly dataDir: string) {}

  private file(sub: string): string {
    return path.join(userDir(this.dataDir, sub), 'prefs.json');
  }

  hiddenCalendars(sub: string): string[] {
    const p = readJson<Prefs>(this.file(sub));
    return Array.isArray(p?.hiddenCalendars) ? p.hiddenCalendars : [];
  }

  setHidden(sub: string, calendarId: string, hidden: boolean): void {
    const rest = this.hiddenCalendars(sub).filter((i) => i !== calendarId);
    writeJsonAtomic(this.file(sub), { hiddenCalendars: hidden ? [...rest, calendarId] : rest } satisfies Prefs);
  }

  /** Forgets every person's preferences (test reset). */
  reset(): void {
    const users = path.join(this.dataDir, 'users');
    if (!fs.existsSync(users)) return;
    for (const u of fs.readdirSync(users)) fs.rmSync(path.join(users, u, 'prefs.json'), { force: true });
  }
}
