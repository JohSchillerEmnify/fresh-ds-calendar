import { minutesToTime, toIsoDate } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { dialogs, type CreateContext } from './registry';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';

/** Defaults for a new item (feature event-editing): focus date; today → next full hour (cap 23:00), else 09:00. */
export function createContext(date?: string, time?: string | null): CreateContext {
  const cal = useCalendarStore();
  const clock = useClockStore();
  const d = date ?? toIsoDate(cal.focusDate);
  if (time !== undefined) return { date: d, time };
  if (d === clock.today) {
    const next = Math.min(23 * 60, (Math.floor(clock.minutesNow / 60) + 1) * 60);
    return { date: d, time: minutesToTime(next) };
  }
  return { date: d, time: '09:00' };
}

export type NewKind = 'event' | 'tasklist';
const KIND_KEY = 'calendar.newKind';

/** Last kind chosen in the "new" dialog (per device); events by default. */
export function lastNewKind(): NewKind {
  try { return localStorage.getItem(KIND_KEY) === 'tasklist' ? 'tasklist' : 'event'; } catch { return 'event'; }
}
export function rememberNewKind(k: NewKind): void {
  try { localStorage.setItem(KIND_KEY, k); } catch { /* storage unavailable: the choice just is not remembered */ }
}

/** Opens the task list dialog for a list without a date (the "+" of the Tasks view); no Event / Task list switch. */
export function openNewUndated(): void {
  const ui = useUiStore();
  if (dialogs.tasklist) ui.openDialog('tasklist', { mode: 'create', date: null });
  else ui.notify(t('calendar.create.editorUnavailable'));
}

/**
 * Opens the one "new" dialog (FAB, empty slot) as the remembered kind, prefilled with the slot's date/time.
 * `time` is passed only when a slot gave one: the event form fills its own default, the task list form stays untimed.
 */
export function openNew(date?: string, time?: string | null): void {
  const ui = useUiStore();
  const kind = lastNewKind();
  if (dialogs[kind]) ui.openDialog(kind, { mode: 'create', date: createContext(date).date, ...(time !== undefined ? { time } : {}) });
  else ui.notify(t('calendar.create.editorUnavailable'));
}
