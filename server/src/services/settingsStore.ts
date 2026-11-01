import fs from 'node:fs';
import type { Category, Settings } from '../api/types.js';
import { isRecord, PersonJsonStore } from '../lib/personJsonStore.js';
import type { Clock } from '../lib/clock.js';
import { nearestGoogleColorId } from '@calendar/shared/colors';
import { formatInZone } from '../lib/time.js';

const DEFAULT_CATEGORIES: Omit<Category, 'googleColorId'>[] = [
  { id: 'shopping', name: 'Shopping', color: '#0b8043', icon: '🛒' },
  { id: 'todo', name: 'To-do', color: '#3f51b5', icon: '✅' },
  { id: 'work', name: 'Work', color: '#8e24aa', icon: '💼' },
  { id: 'home', name: 'Home', color: '#f4511e', icon: '🏠' },
];

export const withGoogleColor = (c: Omit<Category, 'googleColorId'>): Category => ({ ...c, googleColorId: nearestGoogleColorId(c.color) });

function defaultSettings(now: string): Settings {
  return {
    themeMode: 'system',
    seedColor: '#1a73e8',
    defaultView: 'month',
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

/** What a person's `settings.json` holds: the {@link Settings} plus the retired scene and garden style still to migrate. */
type Stored = Partial<Settings> & Record<string, unknown>;

/** One person's settings as read: what is served, and the retired values kept on disk for the theme migration. */
interface Loaded { s: Settings; scene?: string; garden?: string }

/** Settings and categories per person in `users/<sub>/settings.json` (ADR 0035); written only on a change, so opening the app makes no data. */
export class SettingsStore {
  private readonly files: PersonJsonStore<Stored | null>;
  /** The `updated` of never-saved defaults: fixed while the server runs, so the change feed does not resend them. */
  private readonly started: string;

  constructor(dataDir: string, private readonly clock: Clock, private readonly tz: string) {
    // only a file that is not an object is set aside; every missing field takes its default
    this.files = new PersonJsonStore<Stored | null>(dataDir, 'settings.json', (r) => (isRecord(r) ? (r as Stored) : null), () => null);
    this.started = this.stamp();
  }

  /** The person's file as last parsed, by file identity: categories are read for every task list in a sync. */
  private readonly cache = new Map<string, { key: string; l: Loaded }>();

  private load(sub: string): Loaded {
    let key: string | null = null;
    try {
      const st = fs.statSync(this.files.path(sub));
      key = `${st.ino}:${st.mtimeMs}:${st.size}`;
    } catch { /* no file yet: the defaults */ }
    const hit = key ? this.cache.get(sub) : undefined;
    if (hit && hit.key === key) return hit.l;
    const l = this.parse(sub);
    if (key) this.cache.set(sub, { key, l });
    return l;
  }

  private parse(sub: string): Loaded {
    const raw = this.files.read(sub);
    // `transitionWarningMinutes` was replaced by the reminder lists (feature reminders); the shared `streakFlame` and
    // `plant` switches by the person pref `streak`, Off for everyone, so they are dropped, not carried over (API.md)
    const { scene, garden, transitionWarningMinutes: _retired, streakFlame: _flame, plant: _plant, defaultEventColorId: _color, ...loaded } = raw ?? {};
    const defaults = defaultSettings(this.started);
    return {
      s: raw ? { ...defaults, ...(loaded as Partial<Settings>) } : defaults,
      ...(typeof scene === 'string' && { scene }),
      ...(typeof garden === 'string' && { garden }),
    };
  }

  /** The person's retired garden style (`plant`, `sunflowers` or `off`), or undefined when none was ever stored. */
  legacyGarden(sub: string): string | undefined {
    return this.load(sub).garden;
  }

  /** The person's retired top bar scene (`sunflowers`, `mordor` or `none`), or undefined when none was ever stored. */
  legacyTopBarScene(sub: string): string | undefined {
    return this.load(sub).scene;
  }

  private stamp(): string {
    return formatInZone(this.clock.real(), this.tz);
  }

  /** The person's settings as `GET /api/settings` answers them. */
  get(sub: string): Settings {
    return structuredClone(this.load(sub).s);
  }

  /** The person's categories. */
  categories(sub: string): Category[] {
    return this.load(sub).s.categories;
  }

  /** Applies a mutation to a copy of the person's settings, bumps version/updated, persists. */
  update(sub: string, fn: (draft: Settings) => void): Settings {
    const cur = this.load(sub);
    const draft = structuredClone(cur.s);
    fn(draft);
    draft.version = cur.s.version + 1;
    draft.updated = this.stamp();
    this.save(sub, { ...cur, s: draft });
    return structuredClone(draft);
  }

  /** Forgets every person's settings (test reset) and returns the defaults a person then reads. */
  reset(): Settings {
    this.files.reset();
    this.cache.clear();
    return defaultSettings(this.stamp());
  }

  private save(sub: string, l: Loaded): void {
    this.files.write(sub, { ...l.s, ...(l.scene && { scene: l.scene }), ...(l.garden && { garden: l.garden }) });
  }
}
