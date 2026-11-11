import type { Context, Hono } from 'hono';
import type { Ctx } from '../context.js';
import { validation } from '../lib/errors.js';
import { dayNumber, isLocalDate } from '../lib/time.js';
import type { Scope } from '../services/calendar.js';

/** What every route group gets: the router, the app context, and who and which calendar a request is for. */
export interface RouteDeps {
  r: Hono;
  ctx: Ctx;
  person: (c: Context) => string;
  cal: (c: Context) => ReturnType<Ctx['calendarFor']>;
}

export async function body(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

function dateParam(c: Context, name: string): string {
  const v = c.req.query(name);
  if (!v || !isLocalDate(v)) throw validation(`${name} must be a date (YYYY-MM-DD)`, name);
  return v;
}

/** `?scope=` of a task list change: `following` = this and all later occurrences of a repeating list (feature tasklist-repeating); absent or `this` = the given id. */
export function scopeOf(c: Context): Scope {
  const v = c.req.query('scope');
  if (v === undefined || v === 'this') return undefined;
  if (v === 'following') return 'following';
  throw validation('scope must be this or following', 'scope');
}

function checkRange(from: string, to: string, maxDays: number, field: string): { from: string; to: string } {
  if (to <= from) throw validation('to must be after from', field);
  if (dayNumber(to) - dayNumber(from) > maxDays) throw validation(`Range must be at most ${maxDays} days`, field);
  return { from, to };
}

export function range(c: Context, maxDays: number): { from: string; to: string } {
  return checkRange(dateParam(c, 'from'), dateParam(c, 'to'), maxDays, 'to');
}

/**
 * The items of a range for one person, as `GET /api/items`; `excludeHidden` leaves out the calendars the person switched
 * off (the one visibility rule, shared by the Android widget and the iPhone widget data).
 */
export async function readItems(ctx: Ctx, sub: string, cal: ReturnType<Ctx['calendarFor']>, from: string, to: string,
  opts: { ids?: string[]; also?: { from: string; to: string }; excludeHidden: boolean }) {
  const res = await cal.items(from, to, opts.ids, opts.also);
  if (opts.excludeHidden) {
    const hidden = new Set(ctx.prefs.hiddenCalendars(sub));
    res.items = res.items.filter((i) => !hidden.has(i.calendarId));
  }
  return res;
}

/** The optional `also=YYYY-MM-DD..YYYY-MM-DD` range (same rules as `from`/`to`). */
export function alsoRange(c: Context, maxDays: number): { from: string; to: string } | undefined {
  const v = c.req.query('also');
  if (v === undefined) return undefined;
  const [from, to, ...rest] = v.split('..');
  if (rest.length || !from || !to || !isLocalDate(from) || !isLocalDate(to)) {
    throw validation('also must be a range (YYYY-MM-DD..YYYY-MM-DD)', 'also');
  }
  return checkRange(from, to, maxDays, 'also');
}
