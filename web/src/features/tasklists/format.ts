import type { TaskItem, TaskList } from '@/api/types';
import { t } from '@/i18n';
import { formatDate, parseIsoDate } from '@/lib/dates';

/** 45 -> "~45 min", 90 -> "~1 h 30 min", 120 -> "~2 h". */
export function formatEstimate(min: number): string {
  if (min < 60) return t('tasks.card.estimateMin', { min });
  const hours = Math.floor(min / 60), rest = min % 60;
  return rest ? t('tasks.card.estimateHoursMin', { hours, min: rest }) : t('tasks.card.estimateHours', { hours });
}

/** "From Sat 10 Oct" (gentle wording, never "overdue"). */
export function carriedLabel(date: string | null): string {
  const d = date ? parseIsoDate(date) : null;
  if (!d) return t('tasks.card.fromEarlier');
  const day = formatDate(d, 'weekdayDayMonth');
  return t('tasks.card.from', { date: day });
}

export const firstOpenItem = (tl: TaskList) => tl.items.find((i) => !i.done) ?? null;

/** The one task of a one-line list: its text and done state, and the item that holds it (null while it is only the title). */
export interface SingleTask { text: string; done: boolean; item: TaskItem | null }
/** A list whose only line is one task: one item without a title, or a title without items; null for every other list. */
export function singleTask(tl: Pick<TaskList, 'title' | 'items'>): SingleTask | null {
  const title = tl.title.trim() ? tl.title : '';
  if (!title && tl.items.length === 1) return { text: tl.items[0].title, done: tl.items[0].done, item: tl.items[0] };
  if (title && !tl.items.length) return { text: title, done: false, item: null };
  return null;
}

/** All items ticked (an empty list is not "done"). */
export const isComplete = (tl: Pick<TaskList, 'totalCount' | 'doneCount'>): boolean => tl.totalCount > 0 && tl.doneCount >= tl.totalCount;
/** The count and ring are only worth showing for more than one item (a single tick item is its own progress). */
export const showProgress = (tl: Pick<TaskList, 'totalCount'>): boolean => tl.totalCount !== 1;
/** Class for one item name in the card: struck through when ticked. */
export const itemClass = (done: boolean): string => (done ? 'it done' : 'it');

export type CheckState = 'empty' | 'partial' | 'done';
/** Glyph state of the list's checkbox: empty, partly filled (fill 15..85 %) or checked. */
export function checkState(done: number, total: number): { state: CheckState; fill: number } {
  if (total <= 0 || done <= 0) return { state: 'empty', fill: 0 };
  if (done >= total) return { state: 'done', fill: 100 };
  return { state: 'partial', fill: Math.min(85, Math.max(15, Math.round((done / total) * 100))) };
}
