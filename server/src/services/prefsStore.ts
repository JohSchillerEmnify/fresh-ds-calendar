import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { userDir } from '../auth/people.js';

/** The person used while sign-in is off. */
export const LOCAL_PERSON = 'local';

/** Fine-tuning choices that replace the preset's own attributes. */
export interface ThemeOverrides {
  glow?: string; entries?: string; corners?: string; scene?: string; seed?: string;
  glowStrength?: number; radius?: number; tint?: number; density?: string; checkbox?: string; checkFill?: string; check?: string; icons?: string;
}
/** A person's chosen theme: a preset name plus fine-tuning overrides. */
/** What the calendar changes by itself (`off`, `header` = the top bar scene, `all` = colours and scene). */
export interface ThemePref { preset: string; overrides: ThemeOverrides; seasonal: string }
/** What `prefs.json` stores: the theme plus markers that the retired top bar scene and garden style were folded into it. */
interface StoredTheme extends Omit<ThemePref, 'seasonal'> { seasonal?: string; sceneUnified?: true; gardenMigrated?: true; seasonalMigrated?: true }
/** A new person starts with the season's colours and header on base Default. */
export const DEFAULT_THEME: ThemePref = { preset: 'Default', overrides: {}, seasonal: 'all' };

/** How often the emotional support cat comes by when a task list is finished. */
export type SupportCat = 'off' | 'sometimes' | 'always';
export const SUPPORT_CAT_VALUES: readonly SupportCat[] = ['off', 'sometimes', 'always'];

/** How the Tasks view groups its lists (ARCHITECTURE "Tasks view"). */
export type TasksGroupBy = 'time' | 'category' | 'none';
export const TASKS_GROUP_BY_VALUES: readonly TasksGroupBy[] = ['time', 'category', 'none'];
/** How the Tasks view sorts its lists. */
export type TasksSortBy = 'date' | 'name' | 'category' | 'changed' | 'progress';
export const TASKS_SORT_BY_VALUES: readonly TasksSortBy[] = ['date', 'name', 'category', 'changed', 'progress'];

/** Sort direction relative to the sort key's own default (A-80). */
export type TasksSortDir = 'default' | 'reversed';
export const TASKS_SORT_DIR_VALUES: readonly TasksSortDir[] = ['default', 'reversed'];

/** How far ahead the approach bar reaches, in whole hours (ARCHITECTURE "Labs"): 3, 6, 12 or any custom value. */
export const APPROACH_WINDOW_MIN = 1;
export const APPROACH_WINDOW_MAX = 24;
export type ApproachWindowHours = number;

/** Whether `v` is an allowed approach window length (a whole number of hours, 1–24). */
export function isApproachWindow(v: unknown): v is ApproachWindowHours {
  return Number.isInteger(v) && (v as number) >= APPROACH_WINDOW_MIN && (v as number) <= APPROACH_WINDOW_MAX;
}

/** The per-person preferences returned by `GET /api/prefs` (Labs, the approach track and window, the Approaching card, tasks calendar visibility, support cat, Tasks view grouping and sorting). */
export interface Prefs {
  labs: boolean; approachBar: boolean; approachWindowHours: ApproachWindowHours;
  /** The Approaching card above the calendar views (ARCHITECTURE "Approaching card"). */
  approachingCard: boolean;
  /** "Show tasks calendar in Google": the tasks calendar's entry in Google's list is not hidden. */
  tasksCalendarVisible: boolean;
  supportCat: SupportCat;
  /** The small build-version label in the bottom-left corner of the main UI (off by default). */
  versionInCorner: boolean;
  /** Left-handed mode: the phone layout is mirrored (ARCHITECTURE "Left-handed mode"; off by default). */
  leftHanded: boolean;
  /** Tasks view grouping and sorting, remembered per person. */
  tasksGroupBy: TasksGroupBy;
  tasksSortBy: TasksSortBy;
  /** Labs: the AI prompt and the import in the theme menu (saved own themes show either way). */
  labsOwnThemes: boolean;
  tasksSortDir: TasksSortDir;
}

/** Everything stored in `prefs.json`: the {@link Prefs} plus hidden calendars, the tasks calendar id and the theme. */
interface StoredPrefs extends Prefs {
  hiddenCalendars: string[];
  /** The person's "Calendar app: tasks" calendar, once found or created (ARCHITECTURE §3). */
  tasksCalendarId: string | null;
  theme?: StoredTheme;
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
      versionInCorner: p?.versionInCorner === true,
      leftHanded: p?.leftHanded === true,
      tasksGroupBy: TASKS_GROUP_BY_VALUES.includes(p?.tasksGroupBy as TasksGroupBy) ? (p!.tasksGroupBy as TasksGroupBy) : 'time',
      tasksSortBy: TASKS_SORT_BY_VALUES.includes(p?.tasksSortBy as TasksSortBy) ? (p!.tasksSortBy as TasksSortBy) : 'date',
      labsOwnThemes: p?.labsOwnThemes === true,
      tasksSortDir: TASKS_SORT_DIR_VALUES.includes(p?.tasksSortDir as TasksSortDir) ? (p!.tasksSortDir as TasksSortDir) : 'default',
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
    if (!t) return { ...DEFAULT_THEME, overrides: {} };
    const overrides = t.overrides ?? {};
    if (t.seasonalMigrated) return { preset: t.preset, overrides, seasonal: t.seasonal ?? 'off' };
    // read-time migration (ARCHITECTURE "Seasons & holidays"): Automatic => Default + all, scene `season` => header, else off
    const { scene, ...rest } = overrides;
    if (t.preset === 'Automatic') return { preset: 'Default', overrides: scene === 'season' ? rest : overrides, seasonal: 'all' };
    if (scene === 'season') return { preset: t.preset, overrides: rest, seasonal: 'header' };
    return { preset: t.preset, overrides, seasonal: 'off' };
  }

  /**
   * Folds the retired top bar scene into the person's theme, once (ARCHITECTURE "Themes"). The scene that was
   * visible wins: the theme's own scene if it was not `none`, otherwise the old top bar setting.
   *
   * @param legacy The old `Settings.scene`, or undefined when there is none to migrate.
   */
  migrateScene(sub: string, legacy: string | undefined): void {
    const prev = this.read(sub);
    if (legacy === undefined || prev.theme?.sceneUnified) return;
    const cur = this.theme(sub);
    // Default and Neon had no scene of their own; the other presets always did
    const raw = prev.theme?.preset ?? 'Default';
    const own = cur.overrides.scene ?? (raw === 'Default' || raw === 'Neon' ? 'none' : 'preset');
    const overrides = own === 'none' ? { ...cur.overrides, scene: legacy } : cur.overrides;
    writeJsonAtomic(this.file(sub), { ...prev, theme: { ...prev.theme, preset: cur.preset, overrides, seasonal: cur.seasonal, seasonalMigrated: true, sceneUnified: true } } satisfies StoredPrefs);
  }

  /**
   * Folds the retired garden style into the person's theme, once (API.md "Scenes"): people who saw the sunflower
   * field keep it as their scene, people who did not see it do not get it now that it always shows when chosen.
   * Call after {@link migrateScene}.
   *
   * @param legacy The old `Settings.garden`, or undefined when there is none to migrate.
   */
  migrateGarden(sub: string, legacy: string | undefined): void {
    const prev = this.read(sub);
    if (legacy === undefined || prev.theme?.gardenMigrated) return;
    const cur = this.theme(sub);
    const raw = prev.theme?.preset ?? 'Default';
    let overrides = cur.overrides;
    if (legacy === 'sunflowers') {
      // Default and Neon were the presets whose own scene was the (gated) field; other presets showed their own scene
      if (overrides.scene === undefined && (raw === 'Default' || raw === 'Neon')) overrides = { ...overrides, scene: 'sunflowers' };
    } else if (overrides.scene === 'sunflowers') {
      overrides = { ...overrides, scene: 'none' };
    }
    writeJsonAtomic(this.file(sub), { ...prev, theme: { ...prev.theme, preset: cur.preset, overrides, seasonal: cur.seasonal, seasonalMigrated: true, gardenMigrated: true } } satisfies StoredPrefs);
  }

  /** Merges a theme change into the stored preferences and returns the result. */
  setTheme(sub: string, patch: { preset?: string; overrides?: ThemeOverrides; seasonal?: string }): ThemePref {
    const prev = this.read(sub);
    const cur = this.theme(sub);
    const theme: ThemePref = { preset: patch.preset ?? cur.preset, overrides: patch.overrides ?? cur.overrides, seasonal: patch.seasonal ?? cur.seasonal };
    // a person's own save replaces the old scene and garden style, so there is nothing left to migrate
    writeJsonAtomic(this.file(sub), { ...prev, theme: { ...theme, seasonalMigrated: true, sceneUnified: true, gardenMigrated: true } } satisfies StoredPrefs);
    return theme;
  }

  setHidden(sub: string, calendarId: string, hidden: boolean): void {
    const p = this.read(sub);
    const rest = p.hiddenCalendars.filter((i) => i !== calendarId);
    writeJsonAtomic(this.file(sub), { ...p, hiddenCalendars: hidden ? [...rest, calendarId] : rest } satisfies StoredPrefs);
  }

  /** The person's {@link Prefs} as `GET /api/prefs` returns them. */
  labsPrefs(sub: string): Prefs {
    const { labs, approachBar, approachWindowHours, approachingCard, tasksCalendarVisible, supportCat, versionInCorner, labsOwnThemes, leftHanded, tasksGroupBy, tasksSortBy, tasksSortDir } = this.read(sub);
    return { labs, approachBar, approachWindowHours, approachingCard, tasksCalendarVisible, supportCat, versionInCorner, labsOwnThemes, leftHanded, tasksGroupBy, tasksSortBy, tasksSortDir };
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
