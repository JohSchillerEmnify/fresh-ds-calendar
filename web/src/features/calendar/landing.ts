/** The times a moved, resized or drawn entry would land on, as marks for the hour column (feature drag-and-drop). */
import type { CalendarItem } from '@/api/types';
import { TASKLIST_BLOCK_MINUTES } from '@/lib/items';
import { minutesToTime } from '@/lib/dates';
import type { DrawRange } from './draw';
import { splitByDay } from './draw';
import { wallMinutes } from './zone';

export interface LandingMark { edge: 'start' | 'end'; minutes: number; col: number; time: string }

export interface LandingSources {
  /** `lengthMin`: the whole entry, so an overnight entry's end is known from any of its day pieces. */
  drag: { date: string; minutes: number; lengthMin: number } | null;
  /** `continues`: the segment goes on past midnight, so its end is on a later day. */
  resize: { date: string; startMin: number; endMin: number; continues?: boolean } | null;
  /** The block being drawn; null once released (the block kept behind the dialog is not marked). */
  draw: { dates: string[]; range: DrawRange } | null;
}

const mark = (edge: LandingMark['edge'], minutes: number, col: number): LandingMark => ({ edge, minutes, col, time: minutesToTime(minutes) });

/** The whole length of an entry in minutes: an event's start to end, a task list's estimate. */
export function itemLengthMin(item: CalendarItem): number {
  if (item.kind === 'tasklist') return item.estimateMinutes ?? TASKLIST_BLOCK_MINUTES;
  return wallMinutes(item.end.slice(0, 10), item.end.slice(11, 16)) - wallMinutes(item.start.slice(0, 10), item.start.slice(11, 16));
}

/** Start and end marks of what is in motion on this grid; an end on a later day than the start is not marked. */
export function landingMarks(s: LandingSources, dates: string[]): LandingMark[] {
  if (s.drag) {
    const col = dates.indexOf(s.drag.date);
    if (col < 0) return [];
    const end = s.drag.minutes + s.drag.lengthMin;
    return end > 1440 ? [mark('start', s.drag.minutes, col)] : [mark('start', s.drag.minutes, col), mark('end', end, col)];
  }
  if (s.resize) {
    const col = dates.indexOf(s.resize.date);
    if (col < 0) return [];
    return s.resize.continues ? [mark('start', s.resize.startMin, col)] : [mark('start', s.resize.startMin, col), mark('end', s.resize.endMin, col)];
  }
  if (s.draw) {
    const pieces = splitByDay(s.draw.range);
    const first = pieces[0], last = pieces[pieces.length - 1];
    if (!first || !last) return [];
    const at = (day: number) => dates.indexOf(s.draw!.dates[day] ?? '');
    const marks = [mark('start', first.start, at(first.day))];
    if (last.day === first.day) marks.push(mark('end', last.end, at(last.day)));
    return marks.filter((m) => m.col >= 0);
  }
  return [];
}
