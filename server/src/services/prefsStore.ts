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

interface Prefs { hiddenCalendars?: string[]; theme?: ThemePref }

/** Per-person preferences in `DATA_DIR/users/<sub>/prefs.json` (hidden calendars, theme). */
export class PrefsStore {
  constructor(private readonly dataDir: string) {}

  private file(sub: string): string {
    return path.join(userDir(this.dataDir, sub), 'prefs.json');
  }

  hiddenCalendars(sub: string): string[] {
    const p = readJson<Prefs>(this.file(sub));
    return Array.isArray(p?.hiddenCalendars) ? p.hiddenCalendars : [];
  }

  /** The person's chosen theme (the Default preset until one is chosen). */
  theme(sub: string): ThemePref {
    const t = readJson<Prefs>(this.file(sub))?.theme;
    return t ? { preset: t.preset, overrides: t.overrides ?? {} } : { ...DEFAULT_THEME, overrides: {} };
  }

  /** Merges a theme change into the stored preferences and returns the result. */
  setTheme(sub: string, patch: { preset?: string; overrides?: ThemeOverrides }): ThemePref {
    const prev = readJson<Prefs>(this.file(sub)) ?? {};
    const cur = this.theme(sub);
    const theme: ThemePref = { preset: patch.preset ?? cur.preset, overrides: patch.overrides ?? cur.overrides };
    writeJsonAtomic(this.file(sub), { ...prev, theme } satisfies Prefs);
    return theme;
  }

  setHidden(sub: string, calendarId: string, hidden: boolean): void {
    const rest = this.hiddenCalendars(sub).filter((i) => i !== calendarId);
    const prev = readJson<Prefs>(this.file(sub)) ?? {};
    writeJsonAtomic(this.file(sub), { ...prev, hiddenCalendars: hidden ? [...rest, calendarId] : rest } satisfies Prefs);
  }

  /** Forgets every person's preferences (test reset). */
  reset(): void {
    const users = path.join(this.dataDir, 'users');
    if (!fs.existsSync(users)) return;
    for (const u of fs.readdirSync(users)) fs.rmSync(path.join(users, u, 'prefs.json'), { force: true });
  }
}
