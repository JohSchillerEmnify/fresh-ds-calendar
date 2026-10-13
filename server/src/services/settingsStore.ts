import path from 'node:path';
import type { Category, Settings } from '../api/types.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import type { Clock } from '../lib/clock.js';
import { nearestGoogleColorId } from '../lib/colors.js';
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
    transitionWarningMinutes: 10,
    streakFlame: true,
    garden: 'plant',
    categories: DEFAULT_CATEGORIES.map(withGoogleColor),
    updated: now,
    version: 1,
  };
}

/** Settings and categories in DATA_DIR/settings.json (atomic writes, versioned). Independent of the provider. */
export class SettingsStore {
  private s: Settings;
  private readonly file: string | null;
  /** The retired `Settings.scene`, kept on disk (not served) until every person's theme has absorbed it. */
  private legacyScene: string | undefined;

  constructor(dataDir: string | null, private readonly clock: Clock, private readonly tz: string) {
    this.file = dataDir ? path.join(dataDir, 'settings.json') : null;
    const raw = this.file ? readJson<Partial<Settings> & { scene?: string }>(this.file) : null;
    const { scene, ...loaded } = raw ?? {};
    this.legacyScene = typeof scene === 'string' ? scene : undefined;
    const defaults = defaultSettings(this.stamp());
    this.s = raw ? { ...defaults, ...loaded } : defaults;
    if (!raw) this.save(false);
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
    this.save(false);
    return this.get();
  }

  private save(_bump: boolean): void {
    if (this.file) writeJsonAtomic(this.file, this.legacyScene ? { ...this.s, scene: this.legacyScene } : this.s);
  }
}
