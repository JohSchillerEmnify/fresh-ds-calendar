/** Pure model of the Labs Now / Next deck (feature labs-now-next): what the Now, Next and Later cards show for today. */
import type { Segment } from '@/lib/items';
import { nowCardModel } from '@/features/calendar/timeline';
import { timedToday } from '@/features/labs/approach/approach';

/** What the Now card shows: the running event, else the first open task list, else free time. */
export type NowState =
  | { kind: 'running'; segment: Segment; leftMin: number; leftPercent: number }
  | { kind: 'tasks'; segment: Segment; task: string }
  /** `untilMin`: start of the next timed entry of today; null when nothing is left today. */
  | { kind: 'free'; untilMin: number | null };

/** An entry still ahead today (the segment as it sits in time; a carried-over list at its own time). */
export interface UpNext { segment: Segment; startMin: number; inMin: number }

export interface NowNextModel { now: NowState; next: UpNext | null; later: UpNext[] }

/**
 * The deck for today at `nowMin`. Running = the Approaching card's rule ({@link nowCardModel}: a timed event with
 * start <= now < end, the one ending first). Without one, the oldest open task list of today (carried-over first, then
 * the day's order) that has no time or whose time has come, with its first unticked item. Next and Later are every
 * entry with a time today (events and task lists) starting after now, by start; all-day and untimed entries are left out.
 */
export function nowNextModel(daySegments: Segment[], nowMin: number): NowNextModel {
  const ahead = daySegments.flatMap(timedToday).filter((s) => s.startMin > nowMin).sort((a, b) => a.startMin - b.startMin)
    .map((segment) => ({ segment, startMin: segment.startMin, inMin: segment.startMin - nowMin }));
  const [next = null, ...later] = ahead;
  return { now: nowState(daySegments, nowMin, next), next, later };
}

function nowState(segs: Segment[], nowMin: number, next: UpNext | null): NowState {
  // One rule for "running" across the app: reuse the Approaching card's choice.
  const cur = nowCardModel(segs, nowMin).current;
  const running = cur ? segs.find((s) => s.item.id === cur.id && s.startTime !== null) : undefined;
  if (running) {
    const leftMin = running.endMin - nowMin;
    return { kind: 'running', segment: running, leftMin, leftPercent: Math.round((leftMin / (running.endMin - running.startMin)) * 100) };
  }
  const lists = segs.filter((s) => s.item.kind === 'tasklist' && s.item.items.some((i) => !i.done) && isDue(s, nowMin));
  // stable sort: the oldest list first, the day's order within a date
  const first = [...lists].sort((a, b) => listDate(a).localeCompare(listDate(b)))[0];
  if (first && first.item.kind === 'tasklist') return { kind: 'tasks', segment: first, task: first.item.items.find((i) => !i.done)!.title };
  return { kind: 'free', untilMin: next?.startMin ?? null };
}

/** A list without a time is due all day; one with a time (also when carried over) once that time has come. */
function isDue(s: Segment, nowMin: number): boolean {
  const timed = timedToday(s)[0];
  return !timed || timed.startMin <= nowMin;
}

const listDate = (s: Segment) => s.carriedFrom ?? s.date;
