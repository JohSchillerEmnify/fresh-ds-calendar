import type { InkDoc, InkStroke } from '@calendar/shared/api';
import { isRecord, PersonJsonStore } from '../lib/personJsonStore.js';

/** What a person without ink has. */
const empty = (): InkDoc => ({ version: 1, items: {} });

/** A person's ink strokes by item id in `users/<sub>/ink.json` (too big for Google's properties; ADR 0033). */
export class InkStore {
  private readonly files: PersonJsonStore<InkDoc>;

  constructor(dataDir: string) {
    this.files = new PersonJsonStore<InkDoc>(dataDir, 'ink.json',
      (r) => (isRecord(r) && isRecord(r.items) ? { version: 1, items: r.items as InkDoc['items'] } : null), empty);
  }

  /** The person's own ink document; an empty one when none is stored. */
  get(sub: string): InkDoc {
    return this.files.read(sub);
  }

  /** Replaces the strokes of one item. */
  setItem(sub: string, itemId: string, strokes: InkStroke[]): void {
    const doc = this.get(sub);
    doc.items[itemId] = strokes;
    this.files.write(sub, doc);
  }

  /** Removes and returns the strokes of these items (a list that becomes shared takes its ink along). */
  take(sub: string, itemIds: string[]): Record<string, InkStroke[]> {
    const doc = this.get(sub);
    const out: Record<string, InkStroke[]> = {};
    for (const id of itemIds) if (doc.items[id]) { out[id] = doc.items[id]; delete doc.items[id]; }
    if (Object.keys(out).length) this.files.write(sub, doc);
    return out;
  }

  /** Forgets the strokes of these items (decision A8). */
  removeItems(sub: string, itemIds: string[]): void {
    const doc = this.get(sub);
    const had = itemIds.filter((id) => id in doc.items);
    if (!had.length) return;
    for (const id of had) delete doc.items[id];
    this.files.write(sub, doc);
  }

  /** Forgets every person's ink (test reset). */
  reset(): void {
    this.files.reset();
  }
}
