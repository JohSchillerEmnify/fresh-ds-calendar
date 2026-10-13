import { format } from 'date-fns';
import type { TaskList } from '@/api/types';
import { parseIsoDate } from '@/lib/dates';

/** 45 -> "~45 min", 90 -> "~1 h 30 min", 120 -> "~2 h". */
export function formatEstimate(min: number): string {
  if (min < 60) return `~${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `~${h} h ${m} min` : `~${h} h`;
}

/** "From Sat 10 Oct" (gentle wording, never "overdue"). */
export function carriedLabel(date: string | null): string {
  const d = date ? parseIsoDate(date) : null;
  return d ? `From ${format(d, 'EEE d MMM')}` : 'From earlier';
}

export const itemsText = (tl: TaskList): string => (tl.items.length ? tl.items.map((i) => i.title).join(', ') : 'No items');
export const firstOpenItem = (tl: TaskList) => tl.items.find((i) => !i.done) ?? null;

/** All items ticked (an empty list is not "done"). */
export const isComplete = (tl: Pick<TaskList, 'totalCount' | 'doneCount'>): boolean => tl.totalCount > 0 && tl.doneCount >= tl.totalCount;
/** Class for one item name in the card: struck through when ticked. */
export const itemClass = (done: boolean): string => (done ? 'it done' : 'it');

export type CheckState = 'empty' | 'partial' | 'done';
/** Glyph state of the list's checkbox: empty, partly filled (fill 15..85 %) or checked. */
export function checkState(done: number, total: number): { state: CheckState; fill: number } {
  if (total <= 0 || done <= 0) return { state: 'empty', fill: 0 };
  if (done >= total) return { state: 'done', fill: 100 };
  return { state: 'partial', fill: Math.min(85, Math.max(15, Math.round((done / total) * 100))) };
}
