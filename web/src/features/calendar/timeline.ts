/** Pure time math for the timeline: block geometry, now marker position, Now card model, duration wording. */
import type { Segment } from '@/lib/items';
import { minutesToTime } from '@/lib/dates';
import { t } from '@/i18n';

export { blockGeometry, MIN_BLOCK_PX } from '@/lib/items';

export const minutesToPx = (min: number, hourHeight: number) => (min / 60) * hourHeight;

/** Top (px) of the now marker; the marker itself is a line with `data-time`. */
export function nowMarkerTop(minutesNow: number, hourHeight: number): number {
  return minutesToPx(minutesNow, hourHeight);
}

/** `<60 min` -> `35 min`; whole hours -> `2 h`; else `1 h 20 min`. Rounds down to whole minutes (ARCHITECTURE 5b). */
export function formatDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  if (m < 60) return t('calendar.duration.minutes', { minutes: m });
  const h = Math.floor(m / 60), r = m % 60;
  return r === 0 ? t('calendar.duration.hours', { hours: h }) : t('calendar.duration.hoursMinutes', { hours: h, minutes: r });
}

export interface NowCardModel {
  current: { id: string; title: string; left: string; line: string; elapsedPercent: number; color: string } | null;
  nextLine: string;
}

/** Timed, non-all-day event segments of one day, as the Now card sees them. */
function timedEvents(segs: Segment[]): Segment[] {
  return segs.filter((s) => s.item.kind === 'event' && !s.allDay && s.startTime !== null);
}

/**
 * Now card for today. Current = start <= now < end (the one ending first when several). Next = the first timed event
 * starting after now (not the current one), else "Nothing else today".
 */
export function nowCardModel(daySegments: Segment[], nowMin: number): NowCardModel {
  const evs = timedEvents(daySegments);
  const running = evs.filter((s) => s.startMin <= nowMin && nowMin < s.endMin).sort((a, b) => a.endMin - b.endMin || a.startMin - b.startMin);
  const cur = running[0];
  const upcoming = evs.filter((s) => s.startMin > nowMin).sort((a, b) => a.startMin - b.startMin)[0];
  const nextLine = upcoming ? t('calendar.now.next', { title: upcoming.item.title, duration: formatDuration(upcoming.startMin - nowMin) }) : t('calendar.now.nothingElse');
  if (!cur) return { current: null, nextLine };
  const left = formatDuration(cur.endMin - nowMin);
  const total = cur.endMin - cur.startMin;
  return {
    current: {
      id: cur.item.id, title: cur.item.title, left, line: t('calendar.now.left', { title: cur.item.title, left }),
      elapsedPercent: Math.min(100, Math.max(0, Math.floor(((nowMin - cur.startMin) / total) * 100))),
      color: (cur.item as { color: string }).color,
    },
    nextLine,
  };
}

/**
 * Transition warnings due at `nowMin`: timed events starting in 1..`warnMinutes` minutes. `key` is unique per event
 * occurrence (id + start) so each warns once.
 */
export function dueWarnings(daySegments: Segment[], nowMin: number, warnMinutes: number): { key: string; title: string; inMin: number; startMin: number }[] {
  if (warnMinutes <= 0) return [];
  return timedEvents(daySegments)
    .filter((s) => s.first && s.startMin > nowMin && s.startMin - nowMin <= warnMinutes)
    .map((s) => ({ key: `${s.item.id}|${s.date}|${s.startMin}`, title: s.item.title, inMin: s.startMin - nowMin, startMin: s.startMin }));
}

export const hhmm = (m: number) => minutesToTime(m);
