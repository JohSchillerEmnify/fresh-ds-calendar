import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { userDir } from '../auth/people.js';

/** The person used while sign-in is off. */
export const LOCAL_PERSON = 'local';

/** Fine-tuning choices that replace the preset's own attributes. */
export interface ThemeOverrides { glow?: string; entries?: string; corners?: string; scene?: string; seed?: string }
/** A person's chosen theme: a preset name plus fine-tuning overrides. */
export interface ThemePref {
  preset: string; overrides: ThemeOverrides;
  /** What Automatic changes with the calendar (`both` when absent) and the base theme of "scene only". */
  automatic?: string; automaticBase?: string;
}
/** What `prefs.json` stores: the theme plus markers that the retired top bar scene and garden style were folded into it. */
interface StoredTheme extends ThemePref { sceneUnified?: true; gardenMigrated?: true }
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
  /** The small build-version label in the bottom-left corner of the main UI (off by default). */
  versionInCorner: boolean;
  /** Labs: the AI prompt and the import in the theme menu (saved own themes show either way). */
  labsOwnThemes: boolean;
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
      labsOwnThemes: p?.labsOwnThemes === true,
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
    return t ? { preset: t.preset, overrides: t.overrides ?? {}, ...(t.automatic ? { automatic: t.automatic } : {}), ...(t.automaticBase ? { automaticBase: t.automaticBase } : {}) } : { ...DEFAULT_THEME, overrides: {} };
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
    const own = cur.overrides.scene ?? (cur.preset === 'Default' || cur.preset === 'Neon' ? 'none' : 'preset');
    const overrides = own === 'none' ? { ...cur.overrides, scene: legacy } : cur.overrides;
    writeJsonAtomic(this.file(sub), { ...prev, theme: { ...prev.theme, preset: cur.preset, overrides, sceneUnified: true } } satisfies StoredPrefs);
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
    let overrides = cur.overrides;
    if (legacy === 'sunflowers') {
      // Default and Neon were the presets whose own scene was the (gated) field; other presets showed their own scene
      if (overrides.scene === undefined && (cur.preset === 'Default' || cur.preset === 'Neon')) overrides = { ...overrides, scene: 'sunflowers' };
    } else if (overrides.scene === 'sunflowers') {
      overrides = { ...overrides, scene: 'none' };
    }
    writeJsonAtomic(this.file(sub), { ...prev, theme: { ...prev.theme, preset: cur.preset, overrides, gardenMigrated: true } } satisfies StoredPrefs);
  }

  /** Merges a theme change into the stored preferences and returns the result. */
  setTheme(sub: string, patch: { preset?: string; overrides?: ThemeOverrides; automatic?: string; automaticBase?: string }): ThemePref {
    const prev = this.read(sub);
    const cur = this.theme(sub);
    const automatic = patch.automatic ?? cur.automatic;
    const automaticBase = patch.automaticBase ?? cur.automaticBase;
    const theme: ThemePref = {
      preset: patch.preset ?? cur.preset, overrides: patch.overrides ?? cur.overrides,
      ...(automatic ? { automatic } : {}), ...(automaticBase ? { automaticBase } : {}),
    };
    // a person's own save replaces the old scene and garden style, so there is nothing left to migrate
    writeJsonAtomic(this.file(sub), { ...prev, theme: { ...theme, sceneUnified: true, gardenMigrated: true } } satisfies StoredPrefs);
    return theme;
  }

  setHidden(sub: string, calendarId: string, hidden: boolean): void {
    const p = this.read(sub);
    const rest = p.hiddenCalendars.filter((i) => i !== calendarId);
    writeJsonAtomic(this.file(sub), { ...p, hiddenCalendars: hidden ? [...rest, calendarId] : rest } satisfies StoredPrefs);
  }

  /** The person's {@link Prefs} as `GET /api/prefs` returns them. */
  labsPrefs(sub: string): Prefs {
    const { labs, approachBar, approachWindowHours, approachingCard, tasksCalendarVisible, supportCat, versionInCorner, labsOwnThemes } = this.read(sub);
    return { labs, approachBar, approachWindowHours, approachingCard, tasksCalendarVisible, supportCat, versionInCorner, labsOwnThemes };
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
