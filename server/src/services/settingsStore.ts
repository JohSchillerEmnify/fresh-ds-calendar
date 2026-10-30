import path from 'node:path';
import type { Category, Settings } from '../api/types.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import type { Clock } from '../lib/clock.js';
import { nearestGoogleColorId } from '@calendar/shared/colors';
import { formatInZone } from '../lib/time.js';

export const DEFAULT_CATEGORIES: Omit<Category, 'googleColorId'>[] = [
  { id: 'shopping', name: 'Shopping', color: '#0b8043', icon: '🛒' },
  { id: 'todo', name: 'To-do', color: '#3f51b5', icon: '✅' },
  { id: 'work', name: 'Work', color: '#8e24aa', icon: '💼' },
  { id: 'home', name: 'Home', color: '#f4511e', icon: '🏠' },
];

export const withGoogleColor = (c: Omit<Category, 'googleColorId'>): Category => ({ ...c, googleColorId: nearestGoogleColorId(c.color) });

export function defaultSettings(now: string): Settings {
  return {
    themeMode: 'system',
    seedColor: '#1a73e8',
    defaultView: 'month',
    defaultEventColorId: null,
    animationLevel: 'full',
    sounds: false,
    calmMode: false,
    ignoreSystemMotion: false,
    sunflowers: 'grow',
    categories: DEFAULT_CATEGORIES.map(withGoogleColor),
    updated: now,
    version: 1,
  };
}

/** Settings and categories in DATA_DIR/settings.json (atomic writes, versioned). Independent of the provider. */
export class SettingsStore {
  private s!: Settings;
  private readonly file: string | null;
  /** The retired `Settings.scene`, kept on disk (not served) until every person's theme has absorbed it. */
  private legacyScene: string | undefined;
  /** The retired `Settings.garden`, kept on disk (not served) until every person's theme has absorbed it. */
  private legacyGardenStyle: string | undefined;

  constructor(dataDir: string | null, private readonly clock: Clock, private readonly tz: string) {
    this.file = dataDir ? path.join(dataDir, 'settings.json') : null;
    this.reload();
  }

  /** Reads the file again (start, and after a backup restore replaced it). */
  reload(): void {
    const raw = this.file ? readJson<Partial<Settings> & { scene?: string; garden?: string; transitionWarningMinutes?: unknown; streakFlame?: unknown; plant?: unknown }>(this.file) : null;
    // `transitionWarningMinutes` was replaced by the reminder lists (feature reminders); the shared `streakFlame` and
    // `plant` switches by the person pref `streak`, Off for everyone, so they are dropped, not carried over (API.md)
    const { scene, garden, transitionWarningMinutes: _retired, streakFlame: _flame, plant: _plant, ...loaded } = raw ?? {};
    this.legacyScene = typeof scene === 'string' ? scene : undefined;
    this.legacyGardenStyle = typeof garden === 'string' ? garden : undefined;
    const defaults = defaultSettings(this.stamp());
    this.s = raw ? { ...defaults, ...loaded } : defaults;
    if (!raw) this.save(false);
  }

  /** The retired garden style (`plant`, `sunflowers` or `off`), or undefined when none was ever stored. */
  legacyGarden(): string | undefined {
    return this.legacyGardenStyle;
  }

  /** The retired top bar scene (`sunflowers`, `mordor` or `none`), or undefined when none was ever stored. */
  legacyTopBarScene(): string | undefined {
    return this.legacyScene;
  }

  private stamp(): string {
    return formatInZone(this.clock.real(), this.tz);
  }

  get(): Settings {
    return structuredClone(this.s);
  }

  categories(): Category[] {
    return this.s.categories;
  }

  /** Applies a mutation to a copy, bumps version/updated, persists. */
  update(fn: (draft: Settings) => void): Settings {
    const draft = structuredClone(this.s);
    fn(draft);
    draft.version = this.s.version + 1;
    draft.updated = this.stamp();
    this.s = draft;
    this.save(false);
    return this.get();
  }

  reset(): Settings {
    this.s = defaultSettings(this.stamp());
    this.legacyGardenStyle = undefined;
    this.save(false);
    return this.get();
  }

  private save(_bump: boolean): void {
    if (!this.file) return;
    writeJsonAtomic(this.file, { ...this.s, ...(this.legacyScene && { scene: this.legacyScene }), ...(this.legacyGardenStyle && { garden: this.legacyGardenStyle }) });
  }
}
