import { PREF_KEYS, readPrefs, type Prefs } from '@calendar/shared/prefs';
import { isRecord, PersonJsonStore } from '../lib/personJsonStore.js';
import { ReminderOverrideStore } from './reminderOverrides.js';

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
const DEFAULT_THEME: ThemePref = { preset: 'Default', overrides: {}, seasonal: 'all' };

/** Everything stored in `prefs.json`: the {@link Prefs} plus hidden calendars, the tasks calendar id and the theme. */
interface StoredPrefs extends Prefs {
  hiddenCalendars: string[];
  /** The person's "Calendar app: tasks" calendar, once found or created (feature tasklists-own-calendar). */
  tasksCalendarId: string | null;
  theme?: StoredTheme;
}

/** Fills every field of a stored document with a valid value, so a hand-edited or older file still reads. */
function normalise(p: Partial<StoredPrefs> | null): StoredPrefs {
  return {
    ...p,
    hiddenCalendars: Array.isArray(p?.hiddenCalendars) ? p.hiddenCalendars : [],
    tasksCalendarId: typeof p?.tasksCalendarId === 'string' && p.tasksCalendarId ? p.tasksCalendarId : null,
    ...readPrefs(p),
  };
}

/** Per-person preferences in `DATA_DIR/users/<sub>/prefs.json` (hidden calendars, Labs switches, support cat, theme, tasks calendar). */
export class PrefsStore {
  /** The person's own reminders for events they can only read (its own file next to `prefs.json`). */
  readonly reminderOverrides: ReminderOverrideStore;

  private readonly files: PersonJsonStore<StoredPrefs>;

  constructor(dataDir: string) {
    this.reminderOverrides = new ReminderOverrideStore(dataDir);
    // every field falls back to its default; only a file that is not an object is set aside
    this.files = new PersonJsonStore<StoredPrefs>(dataDir, 'prefs.json',
      (r) => (isRecord(r) ? normalise(r) : null), () => normalise(null));
  }

  private read(sub: string): StoredPrefs {
    return this.files.read(sub);
  }

  private merge(sub: string, patch: Partial<StoredPrefs>): StoredPrefs {
    const p = { ...this.read(sub), ...patch };
    this.files.write(sub, p);
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
    // read-time migration (feature theme-menu): Automatic => Default + all, scene `season` => header, else off
    const { scene, ...rest } = overrides;
    if (t.preset === 'Automatic') return { preset: 'Default', overrides: scene === 'season' ? rest : overrides, seasonal: 'all' };
    if (scene === 'season') return { preset: t.preset, overrides: rest, seasonal: 'header' };
    return { preset: t.preset, overrides, seasonal: 'off' };
  }

  /**
   * Folds the retired top bar scene into the person's theme, once (feature theme-scenes). The scene that was
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
    this.files.write(sub, { ...prev, theme: { ...prev.theme, preset: cur.preset, overrides, seasonal: cur.seasonal, seasonalMigrated: true, sceneUnified: true } });
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
    this.files.write(sub, { ...prev, theme: { ...prev.theme, preset: cur.preset, overrides, seasonal: cur.seasonal, seasonalMigrated: true, gardenMigrated: true } });
  }

  /** Merges a theme change into the stored preferences and returns the result. */
  setTheme(sub: string, patch: { preset?: string; overrides?: ThemeOverrides; seasonal?: string }): ThemePref {
    const prev = this.read(sub);
    const cur = this.theme(sub);
    const theme: ThemePref = { preset: patch.preset ?? cur.preset, overrides: patch.overrides ?? cur.overrides, seasonal: patch.seasonal ?? cur.seasonal };
    // a person's own save replaces the old scene and garden style, so there is nothing left to migrate
    this.files.write(sub, { ...prev, theme: { ...theme, seasonalMigrated: true, sceneUnified: true, gardenMigrated: true } });
    return theme;
  }

  setHidden(sub: string, calendarId: string, hidden: boolean): void {
    const p = this.read(sub);
    const rest = p.hiddenCalendars.filter((i) => i !== calendarId);
    this.files.write(sub, { ...p, hiddenCalendars: hidden ? [...rest, calendarId] : rest });
  }

  /** The person's {@link Prefs} as `GET /api/prefs` returns them. */
  labsPrefs(sub: string): Prefs {
    const stored = this.read(sub);
    return Object.fromEntries(PREF_KEYS.map((k) => [k, stored[k]])) as unknown as Prefs;
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
    this.reminderOverrides.reset();
    this.files.reset();
  }
}
