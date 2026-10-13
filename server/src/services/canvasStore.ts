import fs from 'node:fs';
import path from 'node:path';
import type { CanvasArea, CanvasDoc } from '../api/types.js';
import { userDir } from '../auth/people.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';

/** What a person without a canvas document has. */
const EMPTY: CanvasDoc = { version: 1, areas: [] };

/**
 * A person's Canvas areas, one JSON document in `DATA_DIR/users/<sub>/canvas.json` (ARCHITECTURE "Canvas"). The
 * document is read and replaced whole, so a later Google Drive backup can take the file as it is.
 */
export class CanvasStore {
  constructor(private readonly dataDir: string) {}

  private file(sub: string): string {
    return path.join(userDir(this.dataDir, sub), 'canvas.json');
  }

  /** The person's document; an empty one when none is stored or the file is unusable. */
  get(sub: string): CanvasDoc {
    const d = readJson<Partial<CanvasDoc>>(this.file(sub));
    return { version: 1, areas: Array.isArray(d?.areas) ? (d.areas as CanvasArea[]) : [] };
  }

  /** Replaces the person's areas (already validated) and returns the stored document. */
  put(sub: string, areas: CanvasArea[]): CanvasDoc {
    const doc: CanvasDoc = { ...EMPTY, areas };
    writeJsonAtomic(this.file(sub), doc);
    return doc;
  }

  /** Forgets every person's document (test reset). */
  reset(): void {
    const users = path.join(this.dataDir, 'users');
    if (!fs.existsSync(users)) return;
    for (const u of fs.readdirSync(users)) fs.rmSync(path.join(users, u, 'canvas.json'), { force: true });
  }
}
