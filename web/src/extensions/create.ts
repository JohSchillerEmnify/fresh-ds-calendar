import { minutesToTime, toIsoDate } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { createActions, dialogs, type CreateContext } from './registry';
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

/** Default behaviour of the two built-in actions until a feature registers its dialog. */
export function defaultCreateRun(kind: 'event' | 'tasklist') {
  return (ctx: CreateContext) => {
    const ui = useUiStore();
    if (dialogs[kind]) ui.openDialog(kind, { mode: 'create', ...ctx });
    else ui.notify(`The ${kind === 'event' ? 'event' : 'task list'} editor is not available yet`);
  };
}

export function openCreate(id: 'event' | 'tasklist' | string, date?: string, time?: string | null): void {
  const a = createActions.find((x) => x.id === id);
  a?.run(createContext(date, time));
}
