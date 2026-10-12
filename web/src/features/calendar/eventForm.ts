/** Pure form model of the event dialog: defaults, duration-keeping edits, validation and API conversion. */
import { parseIsoDate, toIsoDate, addDays } from '@/lib/dates';
import type { CalendarEvent, CreateEventInput } from '@/api/types';
import { fromWallMinutes, localToIso, wallMinutes } from './zone';

export interface EventForm {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  /** Inclusive for all-day events (the API end is exclusive). */
  endDate: string;
  endTime: string;
  description: string;
  location: string;
  calendarId: string;
  /** Google colorId '1'..'11'; '' = calendar color. */
  colorId: string;
}

export const MSG_TITLE_REQUIRED = 'Title is required';
export const MSG_TITLE_LONG = 'Title must be at most 200 characters';
export const MSG_END = 'End must be after start';
export const MSG_DATE = 'Enter a valid date';
export const MSG_TIME = 'Enter a valid time';
export const MSG_DESC_LONG = 'Description must be at most 8000 characters';
export const MSG_LOC_LONG = 'Location must be at most 500 characters';
export const MSG_TOO_LONG = 'An event can last at most 366 days';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** New event: start at `time` (default 09:00) on `date`, one hour long. */
export function newForm(date: string, time: string | null, calendarId: string, colorId: string | null): EventForm {
  const t = time ?? '09:00';
  const end = fromWallMinutes(wallMinutes(date, t) + 60);
  return {
    title: '', allDay: false, startDate: date, startTime: t, endDate: end.date, endTime: end.time,
    description: '', location: '', calendarId, colorId: colorId ?? '',
  };
}

export function formFromEvent(ev: CalendarEvent): EventForm {
  if (ev.allDay) {
    const last = parseIsoDate(ev.end);
    const endIncl = last ? toIsoDate(addDays(last, -1)) : ev.end;
    return {
      title: ev.title, allDay: true, startDate: ev.start, startTime: '09:00', endDate: endIncl < ev.start ? ev.start : endIncl, endTime: '10:00',
      description: ev.description, location: ev.location, calendarId: ev.calendarId, colorId: ev.colorId ?? '',
    };
  }
  return {
    title: ev.title, allDay: false, startDate: ev.start.slice(0, 10), startTime: ev.start.slice(11, 16), endDate: ev.end.slice(0, 10), endTime: ev.end.slice(11, 16),
    description: ev.description, location: ev.location, calendarId: ev.calendarId, colorId: ev.colorId ?? '',
  };
}

const validDate = (s: string) => parseIsoDate(s) !== null;

/** Moves the end by the same wall-clock delta as the start so the duration is kept (spec "Changing the start time keeps the event duration"). */
export function withStart(f: EventForm, startDate: string, startTime: string): EventForm {
  const next = { ...f, startDate, startTime };
  if (f.allDay) {
    if (!validDate(f.startDate) || !validDate(startDate) || !validDate(f.endDate)) return next;
    const delta = (wallMinutes(startDate, '00:00') - wallMinutes(f.startDate, '00:00'));
    next.endDate = fromWallMinutes(wallMinutes(f.endDate, '00:00') + delta).date;
    return next;
  }
  if (!validDate(f.startDate) || !validDate(startDate) || !validDate(f.endDate) || !TIME.test(f.startTime) || !TIME.test(startTime) || !TIME.test(f.endTime)) return next;
  const delta = wallMinutes(startDate, startTime) - wallMinutes(f.startDate, f.startTime);
  const e = fromWallMinutes(wallMinutes(f.endDate, f.endTime) + delta);
  next.endDate = e.date;
  next.endTime = e.time;
  return next;
}

/** First problem of the form, or null. `field` names the offending control for focus handling. */
export function validate(f: EventForm): { field: string; message: string } | null {
  const title = f.title.trim();
  if (!title) return { field: 'title', message: MSG_TITLE_REQUIRED };
  if (title.length > 200) return { field: 'title', message: MSG_TITLE_LONG };
  if (!validDate(f.startDate)) return { field: 'startDate', message: MSG_DATE };
  if (!validDate(f.endDate)) return { field: 'endDate', message: MSG_DATE };
  if (!f.allDay) {
    if (!TIME.test(f.startTime)) return { field: 'startTime', message: MSG_TIME };
    if (!TIME.test(f.endTime)) return { field: 'endTime', message: MSG_TIME };
  }
  const s = f.allDay ? wallMinutes(f.startDate, '00:00') : wallMinutes(f.startDate, f.startTime);
  const e = f.allDay ? wallMinutes(f.endDate, '00:00') : wallMinutes(f.endDate, f.endTime);
  if (f.allDay ? e < s : e <= s) return { field: 'end', message: MSG_END };
  const span = (e - s) / 1440 + (f.allDay ? 1 : 0);
  if (span > 366) return { field: 'end', message: MSG_TOO_LONG };
  if (f.description.length > 8000) return { field: 'description', message: MSG_DESC_LONG };
  if (f.location.length > 500) return { field: 'location', message: MSG_LOC_LONG };
  return null;
}

/** Form -> API body. Assumes `validate` passed. */
export function toInput(f: EventForm, tz: string): CreateEventInput {
  const base = {
    calendarId: f.calendarId || undefined,
    title: f.title.trim(), description: f.description, location: f.location, colorId: f.colorId || null,
  };
  if (f.allDay) {
    const end = fromWallMinutes(wallMinutes(f.endDate, '00:00') + 1440).date;
    return { ...base, allDay: true, start: f.startDate, end };
  }
  return { ...base, allDay: false, start: localToIso(f.startDate, f.startTime, tz), end: localToIso(f.endDate, f.endTime, tz) };
}

/** Fields that differ from the original event, for a minimal PATCH. */
export function diffInput(next: CreateEventInput, ev: CalendarEvent): Partial<CreateEventInput> {
  const out: Partial<CreateEventInput> = {};
  if (next.title !== ev.title) out.title = next.title;
  if ((next.description ?? '') !== ev.description) out.description = next.description;
  if ((next.location ?? '') !== ev.location) out.location = next.location;
  if ((next.colorId ?? null) !== ev.colorId) out.colorId = next.colorId ?? null;
  if (next.calendarId && next.calendarId !== ev.calendarId) out.calendarId = next.calendarId;
  if (next.allDay !== ev.allDay || next.start !== ev.start || next.end !== ev.end) {
    out.allDay = next.allDay;
    out.start = next.start;
    out.end = next.end;
  }
  return out;
}
