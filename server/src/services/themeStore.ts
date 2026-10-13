import fs from 'node:fs';
import path from 'node:path';
import { MAX_THEMES, type ThemeDoc, type ThemePicture } from '@calendar/shared';
import { userDir } from '../auth/people.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { nanoid } from '../lib/ids.js';
import { validation } from '../lib/errors.js';

/** A theme of a person: the document and its (already sanitised) own picture, under an id of its own. */
export interface StoredTheme { id: string; created: number; doc: ThemeDoc; picture?: ThemePicture }

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

/** A person's imported themes, one JSON file each in `DATA_DIR/users/<sub>/themes/` (ARCHITECTURE "Theme engine and AI themes"). */
export class ThemeStore {
  constructor(private readonly dataDir: string) {}

  private dir(sub: string): string {
    return path.join(userDir(this.dataDir, sub), 'themes');
  }

  /** The person's themes, oldest first. */
  list(sub: string): StoredTheme[] {
    const dir = this.dir(sub);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJson<StoredTheme>(path.join(dir, f)))
      .filter((t): t is StoredTheme => !!t?.id && !!t.doc)
      .sort((a, b) => a.created - b.created);
  }

  /** Stores a validated document and its sanitised picture; at most {@link MAX_THEMES} per person. */
  add(sub: string, doc: ThemeDoc, picture?: ThemePicture): StoredTheme {
    if (this.list(sub).length >= MAX_THEMES) throw validation(`You can keep at most ${MAX_THEMES} themes. Delete one first.`);
    const theme: StoredTheme = { id: nanoid(10), created: Date.now(), doc, ...(picture ? { picture } : {}) };
    writeJsonAtomic(path.join(this.dir(sub), `${theme.id}.json`), theme);
    return theme;
  }

  /** Deletes one theme; false when there is none with this id. */
  remove(sub: string, id: string): boolean {
    if (!ID_RE.test(id)) return false;
    const file = path.join(this.dir(sub), `${id}.json`);
    if (!fs.existsSync(file)) return false;
    fs.rmSync(file);
    return true;
  }

  /** Forgets every person's themes (test reset). */
  reset(): void {
    const users = path.join(this.dataDir, 'users');
    if (!fs.existsSync(users)) return;
    for (const u of fs.readdirSync(users)) fs.rmSync(path.join(users, u, 'themes'), { recursive: true, force: true });
  }
}
