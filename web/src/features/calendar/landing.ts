/** The two times a moved, resized or drawn entry would land on, as marks for the hour column (feature drag-and-drop). */
import { minutesToTime } from '@/lib/dates';
import type { DrawRange } from './draw';
import { splitByDay } from './draw';

export interface LandingMark { edge: 'start' | 'end'; minutes: number; col: number; time: string }

export interface LandingSources {
  drag: { date: string; minutes: number; durationMin: number } | null;
  resize: { date: string; startMin: number; endMin: number; settle?: boolean } | null;
  /** The block being drawn; null once released (the block kept behind the dialog is not marked). */
  draw: { dates: string[]; range: DrawRange } | null;
}

const mark = (edge: LandingMark['edge'], minutes: number, col: number): LandingMark => ({ edge, minutes, col, time: minutesToTime(minutes) });

/** Start and end marks of what is in motion on this grid: a move first, then a resize, then a drawn block. */
export function landingMarks(s: LandingSources, dates: string[]): LandingMark[] {
  if (s.drag) {
    const col = dates.indexOf(s.drag.date);
    return col < 0 ? [] : [mark('start', s.drag.minutes, col), mark('end', s.drag.minutes + s.drag.durationMin, col)];
  }
  if (s.resize && !s.resize.settle) {
    const col = dates.indexOf(s.resize.date);
    return col < 0 ? [] : [mark('start', s.resize.startMin, col), mark('end', s.resize.endMin, col)];
  }
  if (s.draw) {
    const pieces = splitByDay(s.draw.range);
    const first = pieces[0], last = pieces[pieces.length - 1];
    if (!first || !last) return [];
    const at = (day: number) => s.draw!.dates.indexOf(dates[day] ?? '');
    return [mark('start', first.start, at(first.day)), mark('end', last.end, at(last.day))].filter((m) => m.col >= 0);
  }
  return [];
}
