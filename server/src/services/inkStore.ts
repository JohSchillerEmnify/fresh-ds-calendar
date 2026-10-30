import type { InkDoc, InkStroke } from '@calendar/shared/api';
import { isRecord, PersonJsonStore } from '../lib/personJsonStore.js';

/** Most ink one list holds, measured as the JSON of its strokes (decision Q3: about 200 KB). */
const INK_LIST_MAX_BYTES = 200_000;

/** What a person without ink has. */
const empty = (): InkDoc => ({ version: 1, lists: {} });

/** A person's ink strokes in `users/<sub>/ink.json` (too big for Google's properties; ADR 0033). */
export class InkStore {
  private readonly files: PersonJsonStore<InkDoc>;

  constructor(dataDir: string) {
    this.files = new PersonJsonStore<InkDoc>(dataDir, 'ink.json',
      (r) => (isRecord(r) && isRecord(r.lists) ? { version: 1, lists: r.lists as InkDoc['lists'] } : null), empty);
  }

  /** The person's ink document; an empty one when none is stored. */
  get(sub: string): InkDoc {
    return this.files.read(sub);
  }

  /** Whether `strokes` for `itemId` would keep the list within the list limit. */
  fits(sub: string, listId: string, itemId: string, strokes: InkStroke[]): boolean {
    const others = Object.entries(this.get(sub).lists[listId] ?? {}).filter(([id]) => id !== itemId);
    return JSON.stringify([...others.map(([, s]) => s), strokes]).length <= INK_LIST_MAX_BYTES;
  }

  /** Replaces the strokes of one item. */
  setItem(sub: string, listId: string, itemId: string, strokes: InkStroke[]): void {
    const doc = this.get(sub);
    doc.lists[listId] = { ...doc.lists[listId], [itemId]: strokes };
    this.files.write(sub, doc);
  }

  /** Forgets the strokes of one item (decision A8). */
  removeItem(sub: string, listId: string, itemId: string): void {
    const doc = this.get(sub);
    const list = doc.lists[listId];
    if (!list || !(itemId in list)) return;
    delete list[itemId];
    if (Object.keys(list).length === 0) delete doc.lists[listId];
    this.files.write(sub, doc);
  }

  /** Forgets all strokes of a list. */
  removeList(sub: string, listId: string): void {
    const doc = this.get(sub);
    if (!(listId in doc.lists)) return;
    delete doc.lists[listId];
    this.files.write(sub, doc);
  }

  /** Forgets every person's ink (test reset). */
  reset(): void {
    this.files.reset();
  }
}
