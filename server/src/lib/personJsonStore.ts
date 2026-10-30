/** Per-person JSON files under `DATA_DIR/users/<sub>/` for five stores; a damaged file is set aside, never overwritten. */
import fs from 'node:fs';
import path from 'node:path';
import { listUserSubs, userDir } from '../auth/people.js';
import { writeJsonAtomic } from './atomicJson.js';

/** Whether a parsed JSON value is a plain object (not null, not an array). */
export const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Reads and writes one kind of per-person JSON document with the same damaged-file rule for every store. */
export class PersonJsonStore<T> {
  /** `name` is the default path below the person's folder; `parse` returns null for an unusable document; `log` gets one line per set-aside file. */
  constructor(
    private readonly dataDir: string,
    private readonly name: string,
    private readonly parse: (raw: unknown) => T | null,
    private readonly empty: () => T,
    private readonly log: (m: string) => void = (m) => console.warn(m),
  ) {}

  /** The absolute path of the person's file (`rel` overrides the default name, e.g. one file in a folder). */
  path(sub: string, rel: string = this.name): string {
    return path.join(userDir(this.dataDir, sub), rel);
  }

  /** The person's document, or the empty one; a damaged file is renamed to `<name>.corrupt-<timestamp>.json` first. */
  read(sub: string, rel: string = this.name): T {
    const file = this.path(sub, rel);
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      return this.empty();
    }
    let doc: T | null = null;
    try {
      doc = this.parse(JSON.parse(text));
    } catch {
      // not JSON: handled as damaged below
    }
    if (doc !== null) return doc;
    const aside = `${file.replace(/\.json$/, '')}.corrupt-${Date.now()}.json`;
    fs.renameSync(file, aside);
    this.log(`unreadable ${path.basename(file)} moved aside to ${path.basename(aside)}`);
    return this.empty();
  }

  /** Replaces the person's document atomically. */
  write(sub: string, doc: T, rel: string = this.name): void {
    writeJsonAtomic(this.path(sub, rel), doc);
  }

  /** Forgets every person's document (test reset). */
  reset(): void {
    for (const u of listUserSubs(this.dataDir)) fs.rmSync(this.path(u), { recursive: true, force: true });
  }
}

/** Whether a file name is a set-aside copy made by {@link PersonJsonStore.read}. */
export const isSetAside = (file: string): boolean => /\.corrupt-\d+\.json$/.test(file);
