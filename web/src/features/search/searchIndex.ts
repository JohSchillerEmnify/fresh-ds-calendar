/** The item search's index (feature item-search): MiniSearch over the device copy, built in small steps and then kept in step item by item. */
import MiniSearch, { type SearchResult } from 'minisearch';
import type { CalendarEvent, TaskList } from '@/api/types';
import { normalize } from '@/lib/normalize';

export type Searchable = CalendarEvent | TaskList;
/** A found item with the index words that matched, by field (`title`, `notes`, `place`, `items`). */
export interface IndexHit { item: Searchable; terms: Record<string, string[]> }

interface SearchDoc { id: string; title: string; notes: string; place: string; items: string }

const PREFIX_FROM = 3;
const FUZZY_FROM = 4;
/** Documents added between two yields to the page. */
const CHUNK = 150;

const options = {
  fields: ['title', 'notes', 'place', 'items'],
  idField: 'id',
  processTerm: (term: string): string => normalize(term),
  searchOptions: {
    combineWith: 'AND' as const,
    prefix: (term: string): boolean => term.length >= PREFIX_FROM,
    fuzzy: (term: string): number | false => (term.length >= FUZZY_FROM ? 1 : false),
  },
};
const tokenize = MiniSearch.getDefault('tokenize') as (text: string) => string[];

/** An event is told apart by its calendar (ids repeat across calendars); a list by its id. */
const keyOf = (it: Searchable): string => (it.kind === 'event' ? `e:${it.calendarId}\n${it.id}` : `l:${it.id}`);

function docOf(id: string, it: Searchable): SearchDoc {
  if (it.kind === 'event') return { id, title: it.title, notes: it.description, place: it.location, items: '' };
  // an ink item has no text (handwritten-lists G3)
  return { id, title: it.title, notes: '', place: '', items: it.items.filter((i) => !i.ink && i.title).map((i) => i.title).join('\n') };
}

const tick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

export class ItemIndex {
  private readonly ms = new MiniSearch<SearchDoc>(options);
  private readonly held = new Map<string, Searchable>();

  get size(): number { return this.held.size; }

  /** Forgets every document (the device was wiped). */
  clear(): void {
    this.ms.removeAll();
    this.held.clear();
  }

  /** What `items` differs by from what the index holds: documents to add, to replace (changed object) and to discard. */
  private diff(items: readonly Searchable[]): { put: Array<[string, Searchable, boolean]>; drop: string[] } {
    const keys = new Set<string>();
    const put: Array<[string, Searchable, boolean]> = [];
    for (const it of items) {
      const key = keyOf(it);
      keys.add(key);
      const had = this.held.get(key);
      if (had !== it) put.push([key, it, had !== undefined]);
    }
    return { put, drop: [...this.held.keys()].filter((k) => !keys.has(k)) };
  }

  private apply(put: Array<[string, Searchable, boolean]>): void {
    for (const [key, it, had] of put) {
      if (had) this.ms.discard(key);
      this.ms.add(docOf(key, it));
      this.held.set(key, it);
    }
  }

  private discardAll(drop: string[]): void {
    for (const key of drop) { this.ms.discard(key); this.held.delete(key); }
  }

  /** Brings the index in step with `items` at once. */
  update(items: readonly Searchable[]): void {
    const { put, drop } = this.diff(items);
    this.discardAll(drop);
    this.apply(put);
  }

  /** The same in steps of `chunk` documents, calling `pause` between them so the page stays responsive. */
  async updateAsync(items: readonly Searchable[], chunk = CHUNK, pause: () => Promise<void> = tick): Promise<void> {
    const { put, drop } = this.diff(items);
    this.discardAll(drop);
    for (let i = 0; i < put.length; i += chunk) {
      if (i > 0) await pause();
      this.apply(put.slice(i, i + chunk));
    }
  }

  /** The items that contain every word of `query`, with the index words that matched. */
  search(query: string): IndexHit[] {
    if (!normalize(query)) return [];
    const out: IndexHit[] = [];
    for (const r of this.ms.search(query) as SearchResult[]) {
      const item = this.held.get(r.id as string);
      if (item) out.push({ item, terms: r.match as Record<string, string[]> });
    }
    return out;
  }
}

/** The first item of a list that holds one of the matched words (the result names it); null when only the title matched. */
export function matchedItemTitle(list: TaskList, terms: IndexHit['terms']): string | null {
  const wanted = new Set(Object.entries(terms).filter(([, fields]) => fields.includes('items')).map(([term]) => term));
  if (!wanted.size) return null;
  const found = list.items.find((i) => !i.ink && i.title && tokenize(i.title).some((w) => wanted.has(normalize(w))));
  return found?.title ?? null;
}
