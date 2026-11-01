/** Pure form model of the event dialog: defaults, duration-keeping edits, validation and API conversion. */
import { TIME_RE, TITLE_MAX } from '@calendar/shared/limits';
import { parseIsoDate, toIsoDate, addDays } from '@/lib/dates';
import type { CalendarEvent, CreateBirthdayInput, CreateEventInput, Reminders, UpdateEventInput } from '@/api/types';
import { fromWallMinutes, localToIso, wallMinutes } from './zone';
import { placeFromEvent, placeLocation, type PlacePick } from './place';
import { t } from '@/i18n';

export interface EventForm {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  /** Inclusive for all-day events (the API end is exclusive). */
  endDate: string;
  endTime: string;
  description: string;
  /** The text in the location field: a picked place's name, or what was typed. */
  location: string;
  /** The place picked from the suggestions (feature event-location); null for typed text. */
  place: PlacePick | null;
  calendarId: string;
  /** Google colorId '1'..'11'; '' = calendar color. */
  colorId: string;
  /** `minutes` is the own list; it stays empty while `useDefault` (the calendar's default is shown from the calendar list). */
  reminders: Reminders;
}

/** The validation messages in the active language (looked up when a problem is found, so a language switch applies). */
const msg = {
  titleRequired: () => t('calendar.event.validation.titleRequired'),
  titleLong: () => t('calendar.event.validation.titleLong'),
  end: () => t('calendar.event.validation.endAfterStart'),
  date: () => t('calendar.event.validation.date'),
  time: () => t('calendar.event.validation.time'),
  descLong: () => t('calendar.event.validation.descriptionLong'),
  locLong: () => t('calendar.event.validation.locationLong'),
  tooLong: () => t('calendar.event.validation.tooLong'),
};

/** New event: start at `time` (default 09:00) on `date`, `minutes` long (default one hour; a drawn block gives its own). */
export function newForm(date: string, time: string | null, calendarId: string, colorId: string | null, minutes = 60): EventForm {
  const t = time ?? '09:00';
  // a block drawn on the grid gives the length (feature event-editing); else an hour
  const end = fromWallMinutes(wallMinutes(date, t) + minutes);
  return {
    title: '', allDay: false, startDate: date, startTime: t, endDate: end.date, endTime: end.time,
    description: '', location: '', place: null, calendarId, colorId: colorId ?? '', reminders: { useDefault: true, minutes: [] },
  };
}

/** The own reminder list of an event: empty while it follows its calendar's default. */
export const ownReminders = (ev: CalendarEvent): Reminders => (!ev.reminders || ev.reminders.useDefault ? { useDefault: true, minutes: [] } : { useDefault: false, minutes: [...ev.reminders.minutes] });

export function formFromEvent(ev: CalendarEvent): EventForm {
  // a picked place shows its name in the field and its address on the line under it
  const place = placeFromEvent(ev);
  const where = { location: place ? place.name : ev.location, place };
  if (ev.allDay) {
    const last = parseIsoDate(ev.end);
    const endIncl = last ? toIsoDate(addDays(last, -1)) : ev.end;
    return {
      title: ev.title, allDay: true, startDate: ev.start, startTime: '09:00', endDate: endIncl < ev.start ? ev.start : endIncl, endTime: '10:00',
      description: ev.description, ...where, calendarId: ev.calendarId, colorId: ev.colorId ?? '', reminders: ownReminders(ev),
    };
  }
  return {
    title: ev.title, allDay: false, startDate: ev.start.slice(0, 10), startTime: ev.start.slice(11, 16), endDate: ev.end.slice(0, 10), endTime: ev.end.slice(11, 16),
    description: ev.description, ...where, calendarId: ev.calendarId, colorId: ev.colorId ?? '', reminders: ownReminders(ev),
  };
}

/** The location text Google gets: `"<name>, <address>"` for a picked place, else the typed text. */
const locationText = (f: EventForm): string => (f.place ? placeLocation(f.place) : f.location);

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
  if (!validDate(f.startDate) || !validDate(startDate) || !validDate(f.endDate) || !TIME_RE.test(f.startTime) || !TIME_RE.test(startTime) || !TIME_RE.test(f.endTime)) return next;
  const delta = wallMinutes(startDate, startTime) - wallMinutes(f.startDate, f.startTime);
  const e = fromWallMinutes(wallMinutes(f.endDate, f.endTime) + delta);
  next.endDate = e.date;
  next.endTime = e.time;
  return next;
}

/** First problem of the form, or null. `field` names the offending control for focus handling. */
export function validate(f: EventForm): { field: string; message: string } | null {
  const title = f.title.trim();
  if (!title) return { field: 'title', message: msg.titleRequired() };
  if (title.length > TITLE_MAX) return { field: 'title', message: msg.titleLong() };
  if (!validDate(f.startDate)) return { field: 'startDate', message: msg.date() };
  if (!validDate(f.endDate)) return { field: 'endDate', message: msg.date() };
  if (!f.allDay) {
    if (!TIME_RE.test(f.startTime)) return { field: 'startTime', message: msg.time() };
    if (!TIME_RE.test(f.endTime)) return { field: 'endTime', message: msg.time() };
  }
  const s = f.allDay ? wallMinutes(f.startDate, '00:00') : wallMinutes(f.startDate, f.startTime);
  const e = f.allDay ? wallMinutes(f.endDate, '00:00') : wallMinutes(f.endDate, f.endTime);
  if (f.allDay ? e < s : e <= s) return { field: 'end', message: msg.end() };
  const span = (e - s) / 1440 + (f.allDay ? 1 : 0);
  if (span > 366) return { field: 'end', message: msg.tooLong() };
  if (f.description.length > 8000) return { field: 'description', message: msg.descLong() };
  if (locationText(f).length > 500) return { field: 'location', message: msg.locLong() };
  return null;
}

/** Form -> API body. Assumes `validate` passed. */
export function toInput(f: EventForm, tz: string): CreateEventInput {
  const base = {
    calendarId: f.calendarId || undefined,
    title: f.title.trim(), description: f.description, location: locationText(f), colorId: f.colorId || null,
    place: f.place ? { name: f.place.name, lat: f.place.lat, lon: f.place.lon } : null,
    reminders: { useDefault: f.reminders.useDefault, minutes: f.reminders.useDefault ? [] : [...f.reminders.minutes] },
  };
  if (f.allDay) {
    const end = fromWallMinutes(wallMinutes(f.endDate, '00:00') + 1440).date;
    return { ...base, allDay: true, start: f.startDate, end };
  }
  return { ...base, allDay: false, start: localToIso(f.startDate, f.startTime, tz), end: localToIso(f.endDate, f.endTime, tz) };
}

/** Whether two own reminder lists are the same (the calendar default has no list of its own). */
export const sameReminders = (a: Reminders, b: Reminders): boolean =>
  a.useDefault === b.useDefault && (a.useDefault || (a.minutes.length === b.minutes.length && a.minutes.every((m, i) => m === b.minutes[i])));

/** Fields that differ from the original event, for a minimal PATCH. */
export function diffInput(next: CreateEventInput, ev: CalendarEvent): Partial<CreateEventInput> {
  const out: Partial<CreateEventInput> = {};
  if (next.title !== ev.title) out.title = next.title;
  if ((next.description ?? '') !== ev.description) out.description = next.description;
  if ((next.location ?? '') !== ev.location) out.location = next.location;
  const [a, b] = [next.place ?? null, placeFromEvent(ev)];
  if (a?.name !== b?.name || a?.lat !== b?.lat || a?.lon !== b?.lon) out.place = a;
  // a new location always says whether it has a place, so no stale place properties linger in Google
  if (out.location !== undefined) out.place = a;
  if ((next.colorId ?? null) !== ev.colorId) out.colorId = next.colorId ?? null;
  if (next.calendarId && next.calendarId !== ev.calendarId) out.calendarId = next.calendarId;
  if (next.reminders && !sameReminders(next.reminders, ownReminders(ev))) out.reminders = next.reminders;
  if (next.allDay !== ev.allDay || next.start !== ev.start || next.end !== ev.end) {
    out.allDay = next.allDay;
    out.start = next.start;
    out.end = next.end;
  }
  return out;
}

// --- birthdays (the event dialog in birthday mode: name, date, colour) -----------------------------------------------

/** First problem of a birthday form (its name and date), or null. */
export function validateBirthday(f: EventForm): { field: string; message: string } | null {
  const title = f.title.trim();
  if (!title) return { field: 'title', message: msg.titleRequired() };
  if (title.length > TITLE_MAX) return { field: 'title', message: msg.titleLong() };
  if (!validDate(f.startDate)) return { field: 'startDate', message: msg.date() };
  return null;
}

/** Birthday form -> `POST /api/events` body. Assumes `validateBirthday` passed. */
export function toBirthdayInput(f: EventForm): CreateBirthdayInput {
  return { kind: 'birthday', title: f.title.trim(), date: f.startDate, colorId: f.colorId || null };
}

/** Fields of a birthday that differ from the opened one: only name, colour and the day (a one-day all-day range), as Google allows. */
export function birthdayPatch(f: EventForm, ev: CalendarEvent): UpdateEventInput {
  const out: UpdateEventInput = {};
  const title = f.title.trim();
  if (title !== ev.title) out.title = title;
  if ((f.colorId || null) !== ev.colorId) out.colorId = f.colorId || null;
  if (f.startDate !== ev.start) {
    out.allDay = true;
    out.start = f.startDate;
    out.end = fromWallMinutes(wallMinutes(f.startDate, '00:00') + 1440).date;
  }
  return out;
}
