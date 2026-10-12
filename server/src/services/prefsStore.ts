import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { userDir } from '../auth/people.js';

/** The person used while sign-in is off. */
export const LOCAL_PERSON = 'local';

/** Fine-tuning choices that replace the preset's own attributes. */
export interface ThemeOverrides { glow?: string; entries?: string; corners?: string; scene?: string }
/** A person's chosen theme: a preset name plus fine-tuning overrides. */
export interface ThemePref { preset: string; overrides: ThemeOverrides }
export const DEFAULT_THEME: ThemePref = { preset: 'Default', overrides: {} };

/** Window lengths the approach bar offers (ARCHITECTURE "Labs"). */
export const APPROACH_WINDOWS = [3, 6, 12] as const;
export type ApproachWindowHours = (typeof APPROACH_WINDOWS)[number];

interface Prefs {
  hiddenCalendars: string[]; labs: boolean; approachBar: boolean; approachWindowHours: ApproachWindowHours;
  /** The person's "Calendar app: tasks" calendar, once found or created (ARCHITECTURE §3). */
  tasksCalendarId: string | null;
  /** "Show tasks calendar in Google": the tasks calendar's entry in Google's list is not hidden. */
  tasksCalendarVisible: boolean;
  theme?: ThemePref;
}

/** The experimental-feature switches returned by `GET /api/prefs`. */
export interface LabsPrefs { labs: boolean; approachBar: boolean; approachWindowHours: ApproachWindowHours }

/** Per-person preferences in `DATA_DIR/users/<sub>/prefs.json` (hidden calendars, Labs switches, theme, tasks calendar). */
export class PrefsStore {
  constructor(private readonly dataDir: string) {}

  private file(sub: string): string {
    return path.join(userDir(this.dataDir, sub), 'prefs.json');
  }

  private read(sub: string): Prefs {
    const p = readJson<Partial<Prefs>>(this.file(sub));
    return {
      ...p,
      hiddenCalendars: Array.isArray(p?.hiddenCalendars) ? p.hiddenCalendars : [],
      labs: p?.labs === true,
      approachBar: p?.approachBar === true,
      approachWindowHours: APPROACH_WINDOWS.find((h) => h === p?.approachWindowHours) ?? 3,
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

  /** The person's chosen theme (the Default preset until one is chosen). */
  theme(sub: string): ThemePref {
    const t = this.read(sub).theme;
    return t ? { preset: t.preset, overrides: t.overrides ?? {} } : { ...DEFAULT_THEME, overrides: {} };
  }

  /** Merges a theme change into the stored preferences and returns the result. */
  setTheme(sub: string, patch: { preset?: string; overrides?: ThemeOverrides }): ThemePref {
    const prev = this.read(sub);
    const cur = this.theme(sub);
    const theme: ThemePref = { preset: patch.preset ?? cur.preset, overrides: patch.overrides ?? cur.overrides };
    writeJsonAtomic(this.file(sub), { ...prev, theme } satisfies Prefs);
    return theme;
  }

  setHidden(sub: string, calendarId: string, hidden: boolean): void {
    const p = this.read(sub);
    const rest = p.hiddenCalendars.filter((i) => i !== calendarId);
    writeJsonAtomic(this.file(sub), { ...p, hiddenCalendars: hidden ? [...rest, calendarId] : rest } satisfies Prefs);
  }

  labsPrefs(sub: string): LabsPrefs {
    const { labs, approachBar, approachWindowHours } = this.read(sub);
    return { labs, approachBar, approachWindowHours };
  }

  /** Merges the given Labs switches into the person's preferences and returns the result. */
  setLabs(sub: string, patch: Partial<LabsPrefs>): LabsPrefs {
    const p = { ...this.read(sub), ...patch };
    writeJsonAtomic(this.file(sub), p satisfies Prefs);
    return { labs: p.labs, approachBar: p.approachBar, approachWindowHours: p.approachWindowHours };
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
