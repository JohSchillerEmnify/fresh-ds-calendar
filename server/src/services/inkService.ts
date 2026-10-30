import { INK_LIST_MAX_BYTES, inkListBytes } from '@calendar/shared/limits';
import type { InkDoc, InkStroke } from '@calendar/shared/api';
import type { InkStore } from './inkStore.js';
import { isSharedId, type SharedListService } from './sharedLists.js';

/** Ink of handwritten items: a personal list's strokes in the person's file, a shared list's in the list itself. */
export class InkService {
  constructor(private readonly store: InkStore, private readonly shared: SharedListService) {}

  /** The ink the person sees: their own and that of every shared list they are on. */
  doc(sub: string): InkDoc {
    const items = { ...this.store.get(sub).items };
    for (const d of this.shared.visibleTo(sub)) Object.assign(items, d.ink ?? {});
    return { version: 1, items };
  }

  private strokesOf(sub: string, listId: string): Record<string, InkStroke[]> {
    return isSharedId(listId) ? this.shared.access(sub, listId).ink ?? {} : this.store.get(sub).items;
  }

  /** The strokes of one item of a list, erase marks included. */
  get(sub: string, listId: string, itemId: string): InkStroke[] {
    return this.strokesOf(sub, listId)[itemId] ?? [];
  }

  /** Whether `strokes` for `itemId` keep the list (whose ink items are `listItemIds`) within the limit. */
  fits(sub: string, listId: string, listItemIds: string[], itemId: string, strokes: InkStroke[]): boolean {
    const all = this.strokesOf(sub, listId);
    const others = listItemIds.filter((id) => id !== itemId && all[id]).map((id) => all[id]!);
    return inkListBytes([...others, strokes]) <= INK_LIST_MAX_BYTES;
  }

  /** Whether the ink of a new list of these items fits. */
  fitsNew(strokes: InkStroke[][]): boolean {
    return inkListBytes(strokes) <= INK_LIST_MAX_BYTES;
  }

  /** Stores the strokes of one item of a list. */
  set(sub: string, listId: string, itemId: string, strokes: InkStroke[]): void {
    if (!isSharedId(listId)) return this.store.setItem(sub, itemId, strokes);
    const doc = this.shared.access(sub, listId);
    this.shared.saveInk(doc, { ...doc.ink, [itemId]: strokes });
  }

  /** Forgets the ink of these items of a list. */
  remove(sub: string, listId: string, itemIds: string[]): void {
    if (!isSharedId(listId)) return this.store.removeItems(sub, itemIds);
    const doc = this.shared.access(sub, listId);
    if (!itemIds.some((id) => doc.ink && id in doc.ink)) return;
    const ink = { ...doc.ink };
    for (const id of itemIds) delete ink[id];
    this.shared.saveInk(doc, ink);
  }
}
