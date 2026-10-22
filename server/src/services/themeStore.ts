import fs from 'node:fs';
import path from 'node:path';
import { MAX_THEMES, MAX_THEME_BYTES, sanitizePicture, validatePicture, validateTheme, type ThemeDoc, type ThemePicture } from '@calendar/shared';
import { listUserSubs, userDir } from '../auth/people.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { nanoid } from '../lib/ids.js';
import { validation } from '../lib/errors.js';
import { loadSvgSanitizer } from '../lib/svg.js';

/** A theme of a person: the document and its (already sanitised) own picture, under an id of its own. */
export interface StoredTheme { id: string; created: number; doc: ThemeDoc; picture?: ThemePicture }

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const THEME_FILE = /^users\/[A-Za-z0-9_-]+\/themes\/([A-Za-z0-9_-]{1,32})\.json$/;

/** Whether a theme document is within {@link MAX_THEME_BYTES} once stored. */
export const themeFitsSize = (doc: unknown): boolean => Buffer.byteLength(JSON.stringify(doc)) <= MAX_THEME_BYTES;

/**
 * Re-checks a theme file that a backup restore is about to write, exactly like an import: document, size and the
 * picture's SVG sanitising. Other files pass unchanged.
 *
 * @param rel The file's path relative to the data directory.
 * @param content The file's text from the backup.
 * @returns The (re-serialised, sanitised) text to write, or null to skip the file.
 */
export async function vetRestoredFile(rel: string, content: string): Promise<string | null> {
  const id = THEME_FILE.exec(rel)?.[1];
  if (!id) return content;
  try {
    const t = JSON.parse(content) as Partial<StoredTheme> | null;
    if (typeof t !== 'object' || t === null || t.id !== id || !themeFitsSize(t.doc)) return null;
    const doc = validateTheme(t.doc);
    if (!doc.ok) return null;
    let picture: ThemePicture | undefined;
    if (t.picture !== undefined) {
      const valid = validatePicture(t.picture);
      if (!valid.ok) return null;
      const safe = sanitizePicture(await loadSvgSanitizer(), valid.picture);
      if (!safe.ok) return null;
      picture = safe.picture;
    }
    return JSON.stringify({ id, created: typeof t.created === 'number' ? t.created : 0, doc: doc.doc, ...(picture ? { picture } : {}) });
  } catch {
    return null;
  }
}

/** A person's imported themes, one JSON file each in `DATA_DIR/users/<sub>/themes/` (feature theme-import). */
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
    for (const u of listUserSubs(this.dataDir)) fs.rmSync(this.dir(u), { recursive: true, force: true });
  }
}
