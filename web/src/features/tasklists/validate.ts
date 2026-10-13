import { t } from '@/i18n';
import { parseIsoDate } from '@/lib/dates';

export interface TaskListForm {
  title: string;
  date: string;
  time: string;
  estimate: string;
  categoryId: string; // 'none' = no category
  items: string;
  repeat: '' | 'daily' | 'weekly' | 'monthly';
}

export function parseItems(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Empty create form: the slot's (or focused) date, and the slot's time when one was tapped, else no time. */
export function newTaskListForm(date: string, time?: string | null): TaskListForm {
  return { title: '', date, time: time ?? '', estimate: '', categoryId: 'none', items: '', repeat: '' };
}

/**
 * First problem as a user-facing sentence, or null when the form can be saved. `itemCount` is the number of items
 * the list will have (default: the lines of `f.items`; the edit form passes the list's current items).
 */
export function validateForm(f: TaskListForm, itemCount = parseItems(f.items).length): string | null {
  if (!f.title.trim() && itemCount === 0) return t('tasklist.titleOrItem');
  if (f.title.trim().length > 200) return 'Title is too long (200 characters at most)';
  if (!parseIsoDate(f.date)) return 'Pick a date';
  if (f.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.time)) return 'Enter a time like 18:00';
  if (f.estimate.trim()) {
    const n = Number(f.estimate);
    if (!Number.isInteger(n) || n < 5 || n > 720) return 'Estimate must be a whole number of minutes from 5 to 720';
  }
  if (parseItems(f.items).length > 200) return 'A task list can have 200 items at most';
  if (parseItems(f.items).some((t) => t.length > 200)) return 'Item titles can have 200 characters at most';
  return null;
}
