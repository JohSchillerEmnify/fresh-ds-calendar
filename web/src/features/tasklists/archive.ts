/**
 * Pure rules of the Tasks view's Archive tab (ARCHITECTURE "Archive"): which lists are finished, their order, the
 * search match and the template copy. No store or DOM access, so they are unit-tested with fixed data.
 */
import type { CreateTaskListInput, TaskList } from '@/api/types';
import { displayTitle } from '@/lib/items';

/** A list is finished (archived) when it has items and every one is ticked. */
export const isFinished = (l: Pick<TaskList, 'totalCount' | 'doneCount'>): boolean => l.totalCount > 0 && l.doneCount >= l.totalCount;

/**
 * Newest finished first by `completedOn`; lists without it (finished outside the app) come last, ordered by their
 * date (newest first, undated after dated), then by title (A-103).
 */
export function sortArchive(lists: TaskList[]): TaskList[] {
  const byTitle = (a: TaskList, b: TaskList) => displayTitle(a).toLowerCase().localeCompare(displayTitle(b).toLowerCase());
  return [...lists].sort((a, b) => {
    const ca = a.completedOn ?? null, cb = b.completedOn ?? null;
    if ((ca === null) !== (cb === null)) return ca === null ? 1 : -1;
    if (ca !== null && cb !== null) return cb.localeCompare(ca) || byTitle(a, b);
    return (b.date ?? '').localeCompare(a.date ?? '') || byTitle(a, b);
  });
}

/** Whether the list title or any item title contains `query` (case-insensitive); a blank query matches everything. */
export function matchesSearch(l: Pick<TaskList, 'title' | 'items'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return l.title.toLowerCase().includes(q) || l.items.some((i) => i.title.toLowerCase().includes(q));
}

/** The copy "Use as template" creates: same title, category and tags, no date, every item open, no repeat or estimate. */
export function templateOf(l: Pick<TaskList, 'title' | 'categoryId' | 'tags' | 'items'>, categoriesOn = true): CreateTaskListInput {
  return { title: l.title, date: null, categoryId: categoriesOn ? l.categoryId : null, tags: [...l.tags], items: l.items.map((i) => ({ title: i.title, done: false })) };
}
