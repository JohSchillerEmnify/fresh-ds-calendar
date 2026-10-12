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

/** How often the emotional support cat comes by when a task list is finished. */
export type SupportCat = 'off' | 'sometimes' | 'always';
export const SUPPORT_CAT_VALUES: readonly SupportCat[] = ['off', 'sometimes', 'always'];

/** How far ahead the approach bar reaches, in whole hours (ARCHITECTURE "Labs"): 3, 6, 12 or any custom value. */
export const APPROACH_WINDOW_MIN = 1;
export const APPROACH_WINDOW_MAX = 24;
export type ApproachWindowHours = number;

/** Whether `v` is an allowed approach window length (a whole number of hours, 1–24). */
export function isApproachWindow(v: unknown): v is ApproachWindowHours {
  return Number.isInteger(v) && (v as number) >= APPROACH_WINDOW_MIN && (v as number) <= APPROACH_WINDOW_MAX;
}

/** The per-person preferences returned by `GET /api/prefs` (Labs, the approach track and window, the Approaching card, tasks calendar visibility, support cat). */
export interface Prefs {
  labs: boolean; approachBar: boolean; approachWindowHours: ApproachWindowHours;
  /** The Approaching card above the calendar views (ARCHITECTURE "Approaching card"). */
  approachingCard: boolean;
  /** "Show tasks calendar in Google": the tasks calendar's entry in Google's list is not hidden. */
  tasksCalendarVisible: boolean;
  supportCat: SupportCat;
}

/** Everything stored in `prefs.json`: the {@link Prefs} plus hidden calendars, the tasks calendar id and the theme. */
interface StoredPrefs extends Prefs {
  hiddenCalendars: string[];
  /** The person's "Calendar app: tasks" calendar, once found or created (ARCHITECTURE §3). */
  tasksCalendarId: string | null;
  theme?: ThemePref;
}

/** Per-person preferences in `DATA_DIR/users/<sub>/prefs.json` (hidden calendars, Labs switches, support cat, theme, tasks calendar). */
export class PrefsStore {
  constructor(private readonly dataDir: string) {}

  private file(sub: string): string {
    return path.join(userDir(this.dataDir, sub), 'prefs.json');
  }

  private read(sub: string): StoredPrefs {
    const p = readJson<Partial<StoredPrefs>>(this.file(sub));
    return {
      ...p,
      hiddenCalendars: Array.isArray(p?.hiddenCalendars) ? p.hiddenCalendars : [],
      labs: p?.labs === true,
      approachBar: p?.approachBar !== false,
      approachWindowHours: isApproachWindow(p?.approachWindowHours) ? p.approachWindowHours : 3,
      approachingCard: p?.approachingCard !== false,
      tasksCalendarId: typeof p?.tasksCalendarId === 'string' && p.tasksCalendarId ? p.tasksCalendarId : null,
      tasksCalendarVisible: p?.tasksCalendarVisible === true,
      supportCat: SUPPORT_CAT_VALUES.includes(p?.supportCat as SupportCat) ? (p!.supportCat as SupportCat) : 'sometimes',
    };
  }

  private merge(sub: string, patch: Partial<StoredPrefs>): StoredPrefs {
    const p = { ...this.read(sub), ...patch };
    writeJsonAtomic(this.file(sub), p satisfies StoredPrefs);
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
    writeJsonAtomic(this.file(sub), { ...prev, theme } satisfies StoredPrefs);
    return theme;
  }

  setHidden(sub: string, calendarId: string, hidden: boolean): void {
    const p = this.read(sub);
    const rest = p.hiddenCalendars.filter((i) => i !== calendarId);
    writeJsonAtomic(this.file(sub), { ...p, hiddenCalendars: hidden ? [...rest, calendarId] : rest } satisfies StoredPrefs);
  }

  /** The person's {@link Prefs} as `GET /api/prefs` returns them. */
  labsPrefs(sub: string): Prefs {
    const { labs, approachBar, approachWindowHours, approachingCard, tasksCalendarVisible, supportCat } = this.read(sub);
    return { labs, approachBar, approachWindowHours, approachingCard, tasksCalendarVisible, supportCat };
  }

  /**
   * Merges the given switches into the person's preferences and returns the result. `tasksCalendarVisible` is not
   * accepted here: it changes Google first, through `TasksCalendar.setVisible` and `setTasksCalendarVisible`.
   */
  setLabs(sub: string, patch: Partial<Omit<Prefs, 'tasksCalendarVisible'>>): Prefs {
    this.merge(sub, patch);
    return this.labsPrefs(sub);
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
