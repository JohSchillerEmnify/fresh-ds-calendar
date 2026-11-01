/** The per-person preferences (`GET/PATCH /api/prefs`) as one table of defaults and validation that server and web derive from; adding one is an entry here plus its line in `prefs.d.ts`. */

import { TIME_RE } from './limits.js';

/** The languages the app is translated into (`en` is the default; the two `de-x-*` ones are fun dialects). */
export const LANGUAGE_VALUES = ['en', 'de', 'de-x-mainfr', 'de-x-coldmirror'];

/** The bedtime preference of a person who never touched the settings: bedtime mode is off. */
export const DEFAULT_BEDTIME = {
  enabled: false, mode: 'fixed', bedtime: '23:00', wake: '07:00', weekendDifferent: false, weekendBedtime: '00:00', weekendWake: '09:00',
  sleepMinutes: 480, leadMinutes: 60, reminderMinutes: 30,
};
/** The notification preference of a new person: everything but the morning overview. */
export const DEFAULT_NOTIFY = { bedtime: true, events: true, tasklists: false, morning: false, morningTime: '08:00' };

const TASKS_WHEN = ['all', 'nodate', 'dated', 'overdue', 'today', 'tomorrow', 'week'];
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const ok = (value) => ({ value });

/** A boolean switch. */
const bool = (dflt) => ({ default: dflt, parse: (v, key) => (typeof v === 'boolean' ? ok(v) : { error: `${key} must be a boolean` }) });
/** One of a fixed list of values. `message` replaces the default `Invalid <key>`. */
const oneOf = (values, dflt, message) => ({ default: dflt, parse: (v, key) => (values.includes(v) ? ok(v) : { error: message ?? `Invalid ${key}` }) });

/** A tasks filter as stored, or null for anything that is not a valid one. */
function toTasksFilter(v) {
  if (!isObject(v)) return null;
  const { categories, when, ...rest } = v;
  if (Object.keys(rest).length || !TASKS_WHEN.includes(when) || !Array.isArray(categories) || categories.length > 50) return null;
  if (!categories.every((c) => typeof c === 'string' && c.length >= 1 && c.length <= 64) || new Set(categories).size !== categories.length) return null;
  return { categories: [...categories], when };
}

/** A `labsViews` value: at most 32 view ids (lowercase, digits, hyphens) mapped to booleans, or null. */
function toLabsViews(raw) {
  if (!isObject(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length > 32 || !entries.every(([k, v]) => /^[a-z][a-z0-9-]{0,31}$/.test(k) && typeof v === 'boolean')) return null;
  return Object.fromEntries(entries);
}

const BOOLEAN = ['a boolean', (v) => typeof v === 'boolean'];
const HHMM = ['HH:MM', (v) => typeof v === 'string' && TIME_RE.test(v)];
const range = (lo, hi) => [`a whole number from ${lo} to ${hi}`, (v) => Number.isInteger(v) && v >= lo && v <= hi];

/** A partial-object preference: each given field is checked by its own rule; the first problem is the error. */
const fields = (name, spec) => (raw) => {
  if (!isObject(raw)) return { error: `${name} must be an object` };
  const out = {};
  for (const [k, [what, valid]] of Object.entries(spec)) {
    if (raw[k] === undefined) continue;
    if (!valid(raw[k])) return { error: `${name}.${k} must be ${what}` };
    out[k] = raw[k];
  }
  return ok(out);
};

const parseBedtime = fields('bedtime', {
  enabled: BOOLEAN, weekendDifferent: BOOLEAN, mode: ['fixed or dynamic', (v) => v === 'fixed' || v === 'dynamic'],
  bedtime: HHMM, wake: HHMM, weekendBedtime: HHMM, weekendWake: HHMM,
  sleepMinutes: range(60, 960), leadMinutes: range(0, 480), reminderMinutes: range(0, 240),
});
const parseNotify = fields('notify', { bedtime: BOOLEAN, events: BOOLEAN, tasklists: BOOLEAN, morning: BOOLEAN, morningTime: HHMM });

/** Every preference: `default` and `parse(raw, key)` answering `{ value }` or `{ error }` (a 400's message); `merge` ones are objects merged over the current value. In `GET /api/prefs` order. */
export const PREFS = {
  labs: bool(false),
  labsViews: { default: {}, merge: true, parse: (v) => { const r = toLabsViews(v); return r ? ok(r) : { error: 'labsViews must map view ids to booleans' }; } },
  approachBar: bool(true),
  approachWindowHours: { default: 3, parse: (v) => (Number.isInteger(v) && v >= 1 && v <= 24 ? ok(v) : { error: 'approachWindowHours must be a whole number from 1 to 24' }) },
  approachingCard: bool(true),
  approachTimeLeft: bool(true),
  taskCategories: bool(true),
  tasksCalendarVisible: bool(false),
  supportCat: oneOf(['off', 'sometimes', 'always'], 'sometimes', 'Invalid support cat setting'),
  versionInCorner: bool(false),
  labsOwnThemes: bool(false),
  leftHanded: bool(false),
  showCarriedFrom: bool(true),
  navPhone: oneOf(['bottom', 'top', 'rail', 'drawer'], 'bottom'),
  navDesktop: oneOf(['bottom', 'top', 'rail'], 'rail'),
  tasksGroupBy: oneOf(['time', 'category', 'none'], 'time'),
  tasksSortBy: oneOf(['date', 'name', 'category', 'changed', 'progress'], 'date'),
  tasksSortDir: oneOf(['default', 'reversed'], 'default'),
  undatedDone: oneOf(['calendar', 'archive'], 'calendar'),
  taskOpen: oneOf(['inline', 'drawer'], 'inline'),
  tasksFilter: { default: { categories: [], when: 'all' }, parse: (v) => { const r = toTasksFilter(v); return r ? ok(r) : { error: 'Invalid tasksFilter' }; } },
  language: oneOf(['auto', ...LANGUAGE_VALUES], 'auto', 'Invalid language'),
  bedtime: { default: DEFAULT_BEDTIME, merge: true, parse: parseBedtime },
  notify: { default: DEFAULT_NOTIFY, merge: true, parse: parseNotify },
  weekTwoRow: bool(false),
  weekTwoRowTop: oneOf([3, 4], 4, 'weekTwoRowTop must be 3 or 4'),
  labsHandwriting: bool(false),
  labsDrawWithFinger: bool(false),
  minEventMinutes: oneOf([0, 15, 30], 0, 'minEventMinutes must be 0, 15 or 30'),
  daySideBySide: oneOf([2, 3, 4], 4, 'daySideBySide must be 2, 3 or 4'),
  weekSideBySide: oneOf([2, 3], 2, 'weekSideBySide must be 2 or 3'),
  streak: oneOf(['off', 'flame', 'plant'], 'off', 'streak must be off, flame or plant'),
  syncIndicator: bool(false),
  headerLayout: oneOf(['auto', 'two-rows', 'one-row'], 'auto', 'headerLayout must be auto, two-rows or one-row'),
  bottomBarSize: oneOf(['auto', 'expressive', 'compact'], 'auto', 'bottomBarSize must be auto, expressive or compact'),
  monthScroll: oneOf(['sideways', 'vertical', 'vertical-snap'], 'sideways', 'monthScroll must be sideways, vertical or vertical-snap'),
};

/** The preference names, in table order. */
export const PREF_KEYS = Object.keys(PREFS);

/** Every preference at its default, as fresh objects. */
export function defaultPrefs() {
  return structuredClone(Object.fromEntries(PREF_KEYS.map((k) => [k, PREFS[k].default])));
}

/** Fills every preference of a stored document with a valid value: anything missing or invalid takes the default. */
export function readPrefs(raw) {
  const out = defaultPrefs();
  for (const k of PREF_KEYS) {
    const r = PREFS[k].parse(raw?.[k], k);
    if ('value' in r) out[k] = PREFS[k].merge ? { ...out[k], ...r.value } : r.value;
  }
  return out;
}

/** The value after a change: a `merge` preference merges the incoming fields over the current ones, others are replaced. */
export function mergePref(key, current, incoming) {
  return PREFS[key].merge ? { ...current, ...incoming } : incoming;
}

/** Validates a `PATCH /api/prefs` body against the table: `{ patch }` (merge preferences merged over `current`), or `{ error, field }` for the first bad one. */
export function parsePrefsPatch(body, current) {
  const patch = {};
  for (const k of PREF_KEYS) {
    if (body[k] === undefined) continue;
    const r = PREFS[k].parse(body[k], k);
    if ('error' in r) return { error: r.error, field: k };
    patch[k] = mergePref(k, current[k], r.value);
  }
  return { patch };
}
