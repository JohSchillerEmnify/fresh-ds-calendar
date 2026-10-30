import type { CanvasArea, CanvasDoc } from '../api/types.js';
import { isRecord, PersonJsonStore } from '../lib/personJsonStore.js';

/** What a person without a canvas document has. */
const EMPTY: CanvasDoc = { version: 1, areas: [] };

/**
 * A person's Canvas areas, one JSON document in `DATA_DIR/users/<sub>/canvas.json` (feature tasks-canvas). The
 * document is read and replaced whole, so a later Google Drive backup can take the file as it is.
 */
export class CanvasStore {
  private readonly files: PersonJsonStore<CanvasDoc>;

  constructor(dataDir: string) {
    this.files = new PersonJsonStore<CanvasDoc>(dataDir, 'canvas.json',
      (r) => (isRecord(r) && Array.isArray(r.areas) ? { version: 1, areas: r.areas as CanvasArea[] } : null), () => ({ ...EMPTY }));
  }

  /** The person's document; an empty one when none is stored (an unusable file is set aside first). */
  get(sub: string): CanvasDoc {
    return this.files.read(sub);
  }

  /** Replaces the person's areas (already validated) and returns the stored document. */
  put(sub: string, areas: CanvasArea[]): CanvasDoc {
    const doc: CanvasDoc = { ...EMPTY, areas };
    this.files.write(sub, doc);
    return doc;
  }

  /** Forgets every person's document (test reset). */
  reset(): void {
    this.files.reset();
  }
}
