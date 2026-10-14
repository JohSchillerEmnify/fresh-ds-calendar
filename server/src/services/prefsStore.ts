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

/** Where the view switcher sits (ARCHITECTURE "View switcher position"): bottom bar, tabs row under the top bar, or side rail. */
export type NavPosition = 'bottom' | 'top' | 'rail';
export const NAV_POSITION_VALUES: readonly NavPosition[] = ['bottom', 'top', 'rail'];

/** How the Tasks view groups its lists (ARCHITECTURE "Tasks view"). */
export type TasksGroupBy = 'time' | 'category' | 'none';
export const TASKS_GROUP_BY_VALUES: readonly TasksGroupBy[] = ['time', 'category', 'none'];
/** How the Tasks view sorts its lists. */
export type TasksSortBy = 'date' | 'name' | 'category' | 'changed' | 'progress';
export const TASKS_SORT_BY_VALUES: readonly TasksSortBy[] = ['date', 'name', 'category', 'changed', 'progress'];

/** The "When" choice of the Tasks filter (ARCHITECTURE "Tasks filter"). */
export type TasksWhen = 'all' | 'nodate' | 'dated' | 'overdue' | 'today' | 'tomorrow' | 'week';
export const TASKS_WHEN_VALUES: readonly TasksWhen[] = ['all', 'nodate', 'dated', 'overdue', 'today', 'tomorrow', 'week'];
/** The Tasks view's filter: category ids (or `none`) combined with "or", and one When choice, combined with "and". */
export interface TasksFilter { categories: string[]; when: TasksWhen }
export const DEFAULT_TASKS_FILTER: TasksFilter = { categories: [], when: 'all' };

/** The filter as stored, or a default for anything that is not a valid one (also the shape check of `PATCH /api/prefs`). */
export function toTasksFilter(v: unknown): TasksFilter | null {
  if (!v || typeof v !== 'object') return null;
  const { categories, when, ...rest } = v as Record<string, unknown>;
  if (Object.keys(rest).length || !TASKS_WHEN_VALUES.includes(when as TasksWhen) || !Array.isArray(categories) || categories.length > 50) return null;
  if (!categories.every((c) => typeof c === 'string' && c.length >= 1 && c.length <= 64) || new Set(categories).size !== categories.length) return null;
  return { categories: [...categories] as string[], when: when as TasksWhen };
}

/** What finishing an undated task list does: show it in the calendar on that day, or keep it in the Archive only. */
export type UndatedDone = 'calendar' | 'archive';
export const UNDATED_DONE_VALUES: readonly UndatedDone[] = ['calendar', 'archive'];

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

/** The languages the app is translated into (`en` is the default; the two `de-x-*` ones are fun dialects). */
export const LANGUAGE_VALUES = ['en', 'de', 'de-x-mainfr', 'de-x-coldmirror'] as const;
/** The `language` preference: `auto` follows the device, otherwise one of {@link LANGUAGE_VALUES}. */
export type LanguagePref = 'auto' | (typeof LANGUAGE_VALUES)[number];

/** Whether `v` is an allowed `language` preference value. */
export function isLanguagePref(v: unknown): v is LanguagePref {
  return v === 'auto' || LANGUAGE_VALUES.includes(v as (typeof LANGUAGE_VALUES)[number]);
}

/** Bedtime mode (ARCHITECTURE "Bedtime mode"): fixed times, or follow the first appointment of the next day. */
export type BedtimeMode = 'fixed' | 'dynamic';
export const BEDTIME_MODES: readonly BedtimeMode[] = ['fixed', 'dynamic'];
/** The per-person bedtime preference; times are `HH:MM`. */
export interface BedtimePrefs {
  enabled: boolean; mode: BedtimeMode; bedtime: string; wake: string;
  weekendDifferent: boolean; weekendBedtime: string; weekendWake: string;
  sleepMinutes: number; leadMinutes: number; reminderMinutes: number;
}
export const DEFAULT_BEDTIME: BedtimePrefs = {
  enabled: false, mode: 'fixed', bedtime: '23:00', wake: '07:00', weekendDifferent: false, weekendBedtime: '00:00', weekendWake: '09:00',
  sleepMinutes: 480, leadMinutes: 60, reminderMinutes: 30,
};
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Allowed range (inclusive) of each whole-number bedtime field. */
const BEDTIME_RANGES = { sleepMinutes: [60, 960], leadMinutes: [0, 480], reminderMinutes: [0, 240] } as const;

/**
 * Checks a `bedtime` patch and returns the valid fields, or the message of the first problem.
 *
 * @param raw The `bedtime` value of a `PATCH /api/prefs` body.
 * @returns The validated partial preference, or an error message string.
 */
export function parseBedtimePatch(raw: unknown): Partial<BedtimePrefs> | string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'bedtime must be an object';
  const b = raw as Record<string, unknown>;
  const out: Partial<BedtimePrefs> = {};
  for (const k of ['enabled', 'weekendDifferent'] as const) {
    if (b[k] === undefined) continue;
    if (typeof b[k] !== 'boolean') return `bedtime.${k} must be a boolean`;
    out[k] = b[k] as boolean;
  }
  if (b.mode !== undefined) {
    if (!BEDTIME_MODES.includes(b.mode as BedtimeMode)) return 'bedtime.mode must be fixed or dynamic';
    out.mode = b.mode as BedtimeMode;
  }
  for (const k of ['bedtime', 'wake', 'weekendBedtime', 'weekendWake'] as const) {
    if (b[k] === undefined) continue;
    if (typeof b[k] !== 'string' || !TIME_RE.test(b[k] as string)) return `bedtime.${k} must be HH:MM`;
    out[k] = b[k] as string;
  }
  for (const [k, [lo, hi]] of Object.entries(BEDTIME_RANGES) as Array<[keyof typeof BEDTIME_RANGES, readonly [number, number]]>) {
    if (b[k] === undefined) continue;
    if (!Number.isInteger(b[k]) || (b[k] as number) < lo || (b[k] as number) > hi) return `bedtime.${k} must be a whole number from ${lo} to ${hi}`;
    out[k] = b[k] as number;
  }
  return out;
}

/**
 * Which reminders reach the person as system notifications (Android app now, Web Push once HTTPS exists), ADHD-RESEARCH
 * R32: few, chosen ones. The in-app snackbars follow their own settings and are not affected.
 */
export interface NotifyPrefs {
  /** The bedtime reminder (its lead is `bedtime.reminderMinutes`). */
  bedtime: boolean;
  /** "Dentist starts in 10 min" before timed events (lead: the transition warning setting). */
  events: boolean;
  /** The same before task lists with a time. */
  tasklists: boolean;
  /** A morning overview of the day at `morningTime`. */
  morning: boolean;
  morningTime: string;
}
export const DEFAULT_NOTIFY: NotifyPrefs = { bedtime: true, events: true, tasklists: true, morning: false, morningTime: '08:00' };

/** Checks a `notify` patch and returns the valid fields, or the message of the first problem. */
export function parseNotifyPatch(raw: unknown): Partial<NotifyPrefs> | string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'notify must be an object';
  const b = raw as Record<string, unknown>;
  const out: Partial<NotifyPrefs> = {};
  for (const k of ['bedtime', 'events', 'tasklists', 'morning'] as const) {
    if (b[k] === undefined) continue;
    if (typeof b[k] !== 'boolean') return `notify.${k} must be a boolean`;
    out[k] = b[k] as boolean;
  }
  if (b.morningTime !== undefined) {
    if (typeof b.morningTime !== 'string' || !TIME_RE.test(b.morningTime)) return 'notify.morningTime must be HH:MM';
    out.morningTime = b.morningTime;
  }
  return out;
}

function readNotify(raw: unknown): NotifyPrefs {
  const parsed = parseNotifyPatch(raw);
  return { ...DEFAULT_NOTIFY, ...(typeof parsed === 'string' ? {} : parsed) };
}

/** Fills a stored value up to a complete {@link BedtimePrefs}; anything invalid falls back to the default. */
function readBedtime(raw: unknown): BedtimePrefs {
  const parsed = parseBedtimePatch(raw);
  return { ...DEFAULT_BEDTIME, ...(typeof parsed === 'string' ? {} : parsed) };
}

/** Parses a `labsViews` value: an object of at most 32 view ids (lowercase, digits, hyphens) mapped to booleans, or `null` when it is anything else. */
export function toLabsViews(raw: unknown): Record<string, boolean> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length > 32 || !entries.every(([k, v]) => /^[a-z][a-z0-9-]{0,31}$/.test(k) && typeof v === 'boolean')) return null;
  return Object.fromEntries(entries) as Record<string, boolean>;
}

/** The per-person preferences returned by `GET /api/prefs` (Labs, the approach track and window, the Approaching card, tasks calendar visibility, support cat, Tasks view grouping and sorting, language). */
export interface Prefs {
  /** Which Labs views the switcher offers, per view id; an id that is missing follows the client's registry default (ARCHITECTURE "Labs"). */
  labsViews: Record<string, boolean>;
  labs: boolean; approachBar: boolean; approachWindowHours: ApproachWindowHours;
  /** The Approaching card above the calendar views (ARCHITECTURE "Approaching card"). */
  approachingCard: boolean;
  taskCategories: boolean;
  /** "Show tasks calendar in Google": the tasks calendar's entry in Google's list is not hidden. */
  tasksCalendarVisible: boolean;
  supportCat: SupportCat;
  /** The small build-version label in the bottom-left corner of the main UI (off by default). */
  versionInCorner: boolean;
  /** Left-handed mode: the phone layout is mirrored (ARCHITECTURE "Left-handed mode"; off by default). */
  leftHanded: boolean;
  /** The "From Sat 10 Oct" label on task lists carried over to today (on by default; off for no reminder of the past). */
  showCarriedFrom: boolean;
  /** Where the view switcher sits on phones (default `bottom`) and on desktop and tablets (default `rail`). */
  navPhone: NavPosition;
  navDesktop: NavPosition;
  /** Tasks view grouping and sorting, remembered per person. */
  tasksGroupBy: TasksGroupBy;
  tasksSortBy: TasksSortBy;
  /** Labs: the AI prompt and the import in the theme menu (saved own themes show either way). */
  labsOwnThemes: boolean;
  tasksSortDir: TasksSortDir;
  /** "Finished list without a date" (ARCHITECTURE "Archive"). */
  undatedDone: UndatedDone;
  /** The Tasks view's filter, shared by Open, Canvas and Archive (ARCHITECTURE "Tasks filter"). */
  tasksFilter: TasksFilter;
  /** The UI language: `auto` (device language) or a fixed one (ARCHITECTURE "i18n"). */
  language: LanguagePref;
  /** Bedtime mode: the night band in the timeline views and the reminder (ARCHITECTURE "Bedtime mode"). */
  bedtime: BedtimePrefs;
  /** Which reminders become system notifications (ARCHITECTURE "Notifications"). */
  notify: NotifyPrefs;
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
      labsViews: toLabsViews(p?.labsViews) ?? {},
      approachBar: p?.approachBar !== false,
      approachWindowHours: isApproachWindow(p?.approachWindowHours) ? p.approachWindowHours : 3,
      approachingCard: p?.approachingCard !== false,
      taskCategories: p?.taskCategories !== false,
      tasksCalendarId: typeof p?.tasksCalendarId === 'string' && p.tasksCalendarId ? p.tasksCalendarId : null,
      tasksCalendarVisible: p?.tasksCalendarVisible === true,
      supportCat: SUPPORT_CAT_VALUES.includes(p?.supportCat as SupportCat) ? (p!.supportCat as SupportCat) : 'sometimes',
      versionInCorner: p?.versionInCorner === true,
      leftHanded: p?.leftHanded === true,
      showCarriedFrom: p?.showCarriedFrom !== false,
      navPhone: NAV_POSITION_VALUES.includes(p?.navPhone as NavPosition) ? (p!.navPhone as NavPosition) : 'bottom',
      navDesktop: NAV_POSITION_VALUES.includes(p?.navDesktop as NavPosition) ? (p!.navDesktop as NavPosition) : 'rail',
      tasksGroupBy: TASKS_GROUP_BY_VALUES.includes(p?.tasksGroupBy as TasksGroupBy) ? (p!.tasksGroupBy as TasksGroupBy) : 'time',
      tasksSortBy: TASKS_SORT_BY_VALUES.includes(p?.tasksSortBy as TasksSortBy) ? (p!.tasksSortBy as TasksSortBy) : 'date',
      labsOwnThemes: p?.labsOwnThemes === true,
      tasksSortDir: TASKS_SORT_DIR_VALUES.includes(p?.tasksSortDir as TasksSortDir) ? (p!.tasksSortDir as TasksSortDir) : 'default',
      undatedDone: UNDATED_DONE_VALUES.includes(p?.undatedDone as UndatedDone) ? (p!.undatedDone as UndatedDone) : 'calendar',
      tasksFilter: toTasksFilter(p?.tasksFilter) ?? { ...DEFAULT_TASKS_FILTER, categories: [] },
      language: isLanguagePref(p?.language) ? p.language : 'auto',
      bedtime: readBedtime(p?.bedtime),
      notify: readNotify(p?.notify),
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
    const { labs, labsViews, approachBar, approachWindowHours, approachingCard, taskCategories, tasksCalendarVisible, supportCat, versionInCorner, labsOwnThemes, leftHanded, showCarriedFrom, navPhone, navDesktop, tasksGroupBy, tasksSortBy, tasksSortDir, undatedDone, tasksFilter, language, bedtime, notify } = this.read(sub);
    return { labs, labsViews, approachBar, approachWindowHours, approachingCard, taskCategories, tasksCalendarVisible, supportCat, versionInCorner, labsOwnThemes, leftHanded, showCarriedFrom, navPhone, navDesktop, tasksGroupBy, tasksSortBy, tasksSortDir, undatedDone, tasksFilter, language, bedtime, notify };
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
