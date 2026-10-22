/**
 * Static sample data and the collapsed-state storage of the theme menu's live preview (feature theme-menu).
 * The sample is plain data in fixed far-future dates: it never calls the API, never touches a store and is
 * never "today", so the real event renderer neither dims nor rings it.
 */
import type { CalendarEvent } from '@/api/types';
import type { MessageKey } from '@/i18n';
import type { Segment } from '@/lib/items';

/** The three sample days (a Monday to a Wednesday). */
export const SAMPLE_DAYS = ['2030-01-07', '2030-01-08', '2030-01-09'] as const;
/** Minutes after midnight where the sample time grid starts, and the pixels one hour takes in it. */
export const GRID_START_MIN = 8 * 60;
export const GRID_HOUR_PX = 30;
/** Height of the sample time grid in pixels (four hours). */
export const GRID_HEIGHT_PX = 4 * GRID_HOUR_PX;

/** One sample event: a day index into {@link SAMPLE_DAYS}, a time range and a colour; the title is a catalogue key. */
export interface SampleEvent { id: string; day: number; start: string; end: string; color: string; title: MessageKey }

/** Sample events in different colours; the first one is the "preview event" the scenarios read. */
export const SAMPLE_EVENTS: readonly SampleEvent[] = [
  { id: 'p1', day: 0, start: '09:00', end: '10:30', color: '#1a73e8', title: 'themePreview.sample.sync' },
  { id: 'p2', day: 0, start: '11:00', end: '12:00', color: '#0b8043', title: 'themePreview.sample.lunch' },
  { id: 'p3', day: 1, start: '08:30', end: '10:00', color: '#f4511e', title: 'themePreview.sample.run' },
  { id: 'p4', day: 1, start: '10:30', end: '12:00', color: '#8e24aa', title: 'themePreview.sample.review' },
  { id: 'p5', day: 2, start: '09:30', end: '11:00', color: '#f6bf26', title: 'themePreview.sample.call' },
];

/** The sample task list: item titles (catalogue keys) and whether each is ticked. */
export const SAMPLE_TASKS: readonly { title: MessageKey; done: boolean }[] = [
  { title: 'themePreview.sample.milk', done: true },
  { title: 'themePreview.sample.bread', done: true },
  { title: 'themePreview.sample.eggs', done: false },
];

const minutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** The segment the real event renderer takes for a sample event (a timed block on its day). */
export function sampleSegment(e: SampleEvent, title: string): Segment {
  const date = SAMPLE_DAYS[e.day];
  const item: CalendarEvent = {
    kind: 'event', id: e.id, calendarId: 'sample', title, description: '', location: '', allDay: false,
    start: `${date}T${e.start}:00+00:00`, end: `${date}T${e.end}:00+00:00`, colorId: null, color: e.color, etag: '', updated: `${date}T00:00:00+00:00`,
  };
  return { item, date, allDay: false, startTime: e.start, endTime: e.end, startMin: minutes(e.start), endMin: minutes(e.end), first: true, last: true };
}

/** Top offset and height in pixels of a sample event in the sample time grid. */
export function sampleBox(e: SampleEvent): { top: number; height: number } {
  const top = ((minutes(e.start) - GRID_START_MIN) * GRID_HOUR_PX) / 60;
  return { top, height: ((minutes(e.end) - minutes(e.start)) * GRID_HOUR_PX) / 60 };
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
