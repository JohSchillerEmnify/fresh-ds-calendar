import { minutesToTime, toIsoDate } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { dialogs, type CreateContext } from './registry';
import { useUiStore } from '@/stores/ui';

/** Defaults for a new item (ARCHITECTURE §5): focus date; today → next full hour (cap 23:00), else 09:00. */
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

/** Opens the one "new" dialog (FAB, empty slot) as the remembered kind, prefilled with the slot's date/time. */
export function openNew(date?: string, time?: string | null): void {
  const ui = useUiStore();
  const kind = lastNewKind();
  if (dialogs[kind]) ui.openDialog(kind, { mode: 'create', ...createContext(date, time) });
  else ui.notify('The editor is not available yet');
}
