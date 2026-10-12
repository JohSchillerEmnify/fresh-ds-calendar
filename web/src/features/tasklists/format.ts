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
export function carriedLabel(date: string): string {
  const d = parseIsoDate(date);
  return d ? `From ${format(d, 'EEE d MMM')}` : 'From earlier';
}

export const itemsText = (tl: TaskList): string => (tl.items.length ? tl.items.map((i) => i.title).join(', ') : 'No items');
export const firstOpenItem = (tl: TaskList) => tl.items.find((i) => !i.done) ?? null;
