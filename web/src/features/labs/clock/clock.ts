/** What the 24-hour clock shows of a day: which segments are arcs, which are listed in the middle, and their texts. */
import { displayTitle, type Segment } from '@/lib/items';
import { assignLanes } from './geometry';

/** Splits a day's segments: timed events and timed task lists become arcs (on lanes), untimed task lists the middle. */
export function clockSegments(segs: Segment[]): { timed: Array<Segment & { lane: number }>; untimed: Segment[] } {
  const timed = segs.filter((s) => !s.allDay && s.startTime && s.endTime);
  const untimed = segs.filter((s) => s.item.kind === 'tasklist' && !s.startTime);
  return { timed: assignLanes(timed), untimed };
}

/** The text a clock entry is named with: the title, for task lists followed by "done/total". */
export function clockText(item: Segment['item']): string {
  return item.kind === 'tasklist' ? `${displayTitle(item)} ${item.doneCount}/${item.totalCount}` : displayTitle(item);
}
