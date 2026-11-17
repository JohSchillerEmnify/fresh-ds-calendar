/**
 * Static sample data and the collapsed-state storage of the theme menu's preview (feature theme-menu).
 * The sample is plain data in fixed far-future dates: it never calls the API, never touches a store and is
 * never "today", so the real renderers neither dim nor ring it. The calendar items are shaped like the server's and
 * turned into segments by the real `itemSegments`.
 */
import type { CalendarEvent, TaskList } from '@/api/types';
import type { MessageKey } from '@/i18n';
import { itemSegments, type Segment } from '@/lib/items';

/** The three sample days (a Monday to a Wednesday). */
export const SAMPLE_DAYS = ['2030-01-07', '2030-01-08', '2030-01-09'] as const;
/** Minutes after midnight at the top of the sample's hour grid. */
export const SAMPLE_GRID_START = 7 * 60;
/** Hours of the grid the sample shows. */
export const SAMPLE_GRID_HOURS = 4;

/** One sample event: a day index into {@link SAMPLE_DAYS}, a time range and a colour; the title is a catalogue key. */
interface SampleEvent { id: string; day: number; start: string; end: string; color: string; title: MessageKey }

const SAMPLE_EVENTS: readonly SampleEvent[] = [
  { id: 'p1', day: 0, start: '07:30', end: '09:00', color: '#1a73e8', title: 'themePreview.sample.sync' },
  { id: 'p2', day: 0, start: '09:30', end: '10:30', color: '#0b8043', title: 'themePreview.sample.lunch' },
  { id: 'p3', day: 1, start: '07:00', end: '08:30', color: '#f4511e', title: 'themePreview.sample.run' },
  { id: 'p4', day: 1, start: '09:00', end: '10:30', color: '#8e24aa', title: 'themePreview.sample.review' },
  { id: 'p5', day: 2, start: '08:00', end: '09:30', color: '#f6bf26', title: 'themePreview.sample.call' },
];

/** The sample task list: item titles (catalogue keys) and whether each is ticked. */
const SAMPLE_TASKS: readonly { title: MessageKey; done: boolean }[] = [
  { title: 'themePreview.sample.milk', done: true },
  { title: 'themePreview.sample.bread', done: true },
  { title: 'themePreview.sample.eggs', done: false },
];

const STAMP = '2030-01-01T00:00:00+00:00';

function sampleEvent(e: SampleEvent, title: string): CalendarEvent {
  const date = SAMPLE_DAYS[e.day];
  return {
    kind: 'event', id: e.id, calendarId: 'sample', title, description: '', location: '', allDay: false,
    start: `${date}T${e.start}:00+00:00`, end: `${date}T${e.end}:00+00:00`, colorId: null, color: e.color, etag: '', updated: STAMP, reminders: { useDefault: true, minutes: [] },
  };
}

function sampleList(title: string, itemTitle: (k: MessageKey) => string): TaskList {
  const items = SAMPLE_TASKS.map((x, n) => ({ id: `l-${n}`, title: itemTitle(x.title), done: x.done }));
  return {
    kind: 'tasklist', id: 'sample-list', calendarId: 'sample', title, date: SAMPLE_DAYS[1], time: null, items, doneCount: items.filter((i) => i.done).length,
    totalCount: items.length, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#0b8043', calendarColor: '#0b8043', completedOn: null, canvas: null, etag: '', updated: STAMP,
  };
}

/** The sample calendar's segments of a day, titles in the language `tr` speaks. */
export function sampleSegmentsOf(date: string, tr: (k: MessageKey) => string): Segment[] {
  const list = sampleList(tr('themePreview.sample.groceries'), tr);
  const items = [...SAMPLE_EVENTS.map((e) => sampleEvent(e, tr(e.title))), list];
  return items.flatMap((i) => itemSegments(i)).filter((s) => s.date === date);
}

/** A sample event as the option tiles show it: a chip under the tile's own look. */
export function sampleChipSegment(title: string): Segment {
  return itemSegments(sampleEvent({ id: 'chip', day: 0, start: '09:00', end: '10:00', color: '#1a73e8', title: 'themePreview.sample.sync' }, title))[0];
}

/** The `localStorage` key of the per-device collapsed state. */
export const COLLAPSED_KEY = 'cal.themePreviewCollapsed';

/** Reads whether the preview was collapsed on this device; unavailable storage means expanded. */
export function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}

/** Remembers the collapsed state on this device; unavailable storage is ignored. */
export function writeCollapsed(collapsed: boolean): void {
  try {
    if (collapsed) localStorage.setItem(COLLAPSED_KEY, '1');
    else localStorage.removeItem(COLLAPSED_KEY);
  } catch { /* storage unavailable: the choice just is not remembered */ }
}

/** The scale that fits the design width into a container, never enlarging; 1 while the container is unmeasured. */
export function previewScale(containerWidth: number, designWidth: number): number {
  return containerWidth > 0 ? Math.min(1, containerWidth / designWidth) : 1;
}
