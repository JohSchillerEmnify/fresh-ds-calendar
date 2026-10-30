import { ESTIMATE_MAX, ESTIMATE_MIN, LIST_ITEMS_MAX, TIME_RE, TITLE_MAX } from '@calendar/shared/limits';
import { t } from '@/i18n';
import { parseIsoDate } from '@/lib/dates';
import type { Reminders } from '@/api/types';

export interface TaskListForm {
  title: string;
  /** '' = no date: the list is saved undated (the time and repeat are ignored). */
  date: string;
  time: string;
  estimate: string;
  categoryId: string; // 'none' = no category
  items: string;
  repeat: '' | 'daily' | 'weekly' | 'monthly';
  /** The list's own reminders; `minutes` stays empty while it uses the tasks calendar's default. */
  reminders?: Reminders;
}

export function parseItems(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Empty create form: the slot's (or focused) date, and the slot's time when one was tapped, else no time. A null date starts the form undated. */
export function newTaskListForm(date: string | null, time?: string | null, minutes?: number): TaskListForm {
  // a block drawn on the grid gives its length as the estimate, at most the 12 hours a list may take
  const estimate = minutes ? String(Math.min(minutes, ESTIMATE_MAX)) : '';
  return { title: '', date: date ?? '', time: time ?? '', estimate, categoryId: 'none', items: '', repeat: '', reminders: { useDefault: true, minutes: [] } };
}

/**
 * First problem as a user-facing sentence, or null when the form can be saved. `itemCount` is the number of items
 * the list will have (default: the lines of `f.items`; the edit form passes the list's current items).
 */
export function validateForm(f: TaskListForm, itemCount = parseItems(f.items).length): string | null {
  if (!f.title.trim() && itemCount === 0) return t('tasklist.titleOrItem');
  if (f.title.trim().length > TITLE_MAX) return t('tasks.validation.titleTooLong');
  if (f.date && !parseIsoDate(f.date)) return t('tasks.validation.pickDate');
  if (f.date && f.time && !TIME_RE.test(f.time)) return t('tasks.validation.timeFormat');
  if (f.estimate.trim()) {
    const n = Number(f.estimate);
    if (!Number.isInteger(n) || n < ESTIMATE_MIN || n > ESTIMATE_MAX) return t('tasks.validation.estimateRange');
  }
  if (parseItems(f.items).length > LIST_ITEMS_MAX) return t('tasks.validation.tooManyItems');
  if (parseItems(f.items).some((line) => line.length > TITLE_MAX)) return t('tasks.validation.itemTooLong');
  return null;
}
