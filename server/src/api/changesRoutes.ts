/**
 * `GET /api/changes` (ADR 0025): what changed for the signed-in person since the device's cursor. The Google side
 * (events, task lists) comes from {@link CalendarService.changesSince}; every per-person file answers a version (a hash of
 * what the app would show) and is sent in full only when its version moved. The cursor is opaque: it holds the per-calendar sync tokens,
 * the version of every file and the stamp of every shared list, and only the device that got it sends it back.
 */
import { createHash } from 'node:crypto';
import type { Context, Hono } from 'hono';
import type { Ctx } from '../context.js';
import { validation } from '../lib/errors.js';
import { dayNumber, isLocalDate } from '../lib/time.js';
import { windowOf } from '../services/changeFeed.js';
import type { CalendarService, ChangeState } from '../services/calendar.js';

/** `p` is a short hash of the person the cursor was made for: another person's cursor is no cursor. */
interface Cursor extends ChangeState { v: 1; p: string; files: Record<string, string> }
const MAX_CURSOR_CHARS = 32_768;
const MAX_DATE_SKEW_DAYS = 3;

const isStringMap = (v: unknown): v is Record<string, string> => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'string');

const personOf = (sub: string): string => createHash('sha1').update(sub).digest('base64url').slice(0, 12);

/** The cursor a device sent, or null when it is missing, not one of ours or made for another person (the device then gets everything in full). */
export function decodeCursor(raw: string | undefined, person?: string): Cursor | null {
  if (!raw || raw.length > MAX_CURSOR_CHARS) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    return c.v === 1 && typeof c.to === 'string' && isLocalDate(c.to) && isStringMap(c.tokens) && isStringMap(c.shared) && isStringMap(c.files) && (person === undefined || c.p === personOf(person)) ? (c as Cursor) : null;
  } catch {
    return null;
  }
}

const encodeCursor = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
const versionOf = (v: unknown): string => createHash('sha1').update(JSON.stringify(v)).digest('base64url').slice(0, 16);

/** The views of the person's data that the route shares with the plain read endpoints. */
export interface ChangesViews {
  person(c: Context): string;
  cal(c: Context): CalendarService;
  theme(sub: string): unknown;
  themes(sub: string): unknown;
}

export function registerChanges(r: Hono, ctx: Ctx, v: ChangesViews): void {
  r.get('/changes', async (c) => {
    const asked = c.req.query('today');
    if (asked !== undefined && !isLocalDate(asked)) throw validation('today must be a date (YYYY-MM-DD)', 'today');
    // the device's date only counts when it is close to the server's (time zones, a day change); a wild one must not size the window
    const serverToday = ctx.motivation.today();
    const today = asked !== undefined && Math.abs(dayNumber(asked) - dayNumber(serverToday)) <= MAX_DATE_SKEW_DAYS ? asked : serverToday;
    const sub = v.person(c);
    const cal = v.cal(c);
    const prev = decodeCursor(c.req.query('cursor'), sub);

    // the calendar list is small and always answered in full; reading it first fills the service's calendar cache
    const hidden = ctx.prefs.hiddenCalendars(sub);
    const calendars = (await cal.calendars()).map((k) => ({ ...k, hidden: hidden.includes(k.id) }));

    // per-person files: a version each, the file itself only when the version moved
    const sources: Record<string, () => unknown> = {
      settings: () => ctx.settings.get(), prefs: () => ctx.prefs.labsPrefs(sub), theme: () => v.theme(sub), themes: () => v.themes(sub),
      templates: () => ({ templates: ctx.templates.list(sub) }), canvas: () => ctx.canvas.get(sub), ink: () => ctx.ink.get(sub), motivation: () => ctx.motivation.get(),
      categoryShares: () => ({ shares: ctx.shared.rulesOf(sub) }), people: () => ({ people: ctx.shared.candidates(sub) }),
    };
    const files: Record<string, unknown> = {};
    const versions: Record<string, string> = {};
    for (const [name, read] of Object.entries(sources)) {
      const value = read();
      versions[name] = versionOf(value);
      if (versions[name] !== prev?.files[name]) files[name] = value;
    }
    const tasksReminders = { defaultReminders: await cal.tasksDefaultReminders() };
    versions.tasksCalendarReminders = versionOf(tasksReminders);
    if (versions.tasksCalendarReminders !== prev?.files.tasksCalendarReminders) files.tasksCalendarReminders = tasksReminders;

    // the person's own reminders on read-only events change those events without Google knowing: re-list their calendars
    const overrides = ctx.prefs.reminderOverrides.all(sub);
    versions.reminderOverrides = versionOf(overrides);
    const forced = new Set(prev && versions.reminderOverrides !== prev.files.reminderOverrides ? Object.keys(overrides) : []);

    const g = await cal.changesSince(prev, today, forced);
    // a calendar that failed is retried next time, including the relist its reminder overrides asked for
    if ((g.events.failed.length || g.taskLists.failed) && prev?.files.reminderOverrides !== undefined) versions.reminderOverrides = prev.files.reminderOverrides;
    const cursor: Cursor = { v: 1, p: personOf(sub), ...g.state, files: versions };
    return c.json({ full: prev === null, cursor: encodeCursor(cursor), window: windowOf(today), calendars, events: g.events, taskLists: g.taskLists, files });
  });
}
