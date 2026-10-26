import * as v from 'valibot';
import { ApiException, type ErrorDetail } from './errors.js';
import { GOOGLE_COLOR_IDS } from './colors.js';

const TITLE_REQ = 'Title is required';
const TITLE_MAX = 'Title must be at most 200 characters';
const HEX_MSG = 'Enter a color like #1a73e8';

const title = v.pipe(v.string(TITLE_REQ), v.trim(), v.minLength(1, TITLE_REQ), v.maxLength(200, TITLE_MAX));
/** Task list titles may be empty when the list has an item; the service checks "Add a title or an item". */
const listTitle = v.pipe(v.string(TITLE_REQ), v.trim(), v.maxLength(200, TITLE_MAX));
const str = (max: number, label: string) => v.pipe(v.string(`${label} must be a string`), v.maxLength(max, `${label} must be at most ${max} characters`));
const localDate = v.pipe(v.string('Date must be YYYY-MM-DD'), v.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'));
const localTime = v.pipe(v.string('Time must be HH:mm'), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm'));
const hex = v.pipe(v.string(HEX_MSG), v.regex(/^#[0-9a-fA-F]{6}$/, HEX_MSG));
const colorId = v.nullable(v.picklist(GOOGLE_COLOR_IDS, 'Color must be a Google color id (1-11)'));
const tags = v.pipe(
  v.array(v.pipe(v.string('Tag must be text'), v.trim(), v.minLength(1, 'Tag is required'), v.maxLength(30, 'Tag must be at most 30 characters'), v.regex(/^[^,]*$/, 'Tag must not contain commas'))),
  v.maxLength(10, 'At most 10 tags'),
);
const estimate = v.nullable(v.pipe(v.number('Estimate must be a number'), v.integer('Estimate must be a whole number'), v.minValue(5, 'Estimate must be 5-720 minutes'), v.maxValue(720, 'Estimate must be 5-720 minutes')));
const recurrence = v.nullable(v.picklist(['daily', 'weekly', 'monthly'], 'Recurrence must be daily, weekly or monthly'));
const itemTitle = v.pipe(v.string('Item title is required'), v.trim(), v.minLength(1, 'Item title is required'), v.maxLength(200, 'Item title must be at most 200 characters'));

const strict = v.strictObject;
const so = <T extends v.ObjectEntries>(e: T) => strict(e);
const LAT_MSG = 'Latitude must be a number from -90 to 90';
const LON_MSG = 'Longitude must be a number from -180 to 180';
/** A picked place (feature event-location): its name and position; null drops it. */
const place = v.nullable(so({
  name: v.pipe(v.string('Place name is required'), v.trim(), v.minLength(1, 'Place name is required'), v.maxLength(200, 'Place name must be at most 200 characters')),
  lat: v.pipe(v.number(LAT_MSG), v.minValue(-90, LAT_MSG), v.maxValue(90, LAT_MSG)),
  lon: v.pipe(v.number(LON_MSG), v.minValue(-180, LON_MSG), v.maxValue(180, LON_MSG)),
}));
/** Popup lead times in minutes: whole numbers up to Google's 4 weeks, at most 5, all different. */
const leadMinutes = v.pipe(
  v.array(v.pipe(v.number('Reminder must be a number of minutes'), v.integer('Reminder must be a whole number of minutes'), v.minValue(0, 'Reminder must be 0-40320 minutes'), v.maxValue(40_320, 'Reminder must be 0-40320 minutes'))),
  v.maxLength(5, 'At most 5 reminders'),
  v.check((a) => new Set(a).size === a.length, 'Reminders must be different'),
);
const reminders = so({ useDefault: v.boolean('useDefault must be a boolean'), minutes: leadMinutes });
/** `PATCH /api/calendars/:id` and `PATCH /api/reminders/tasks-calendar`: the new popup default list. */
export const defaultRemindersSchema = leadMinutes;
/** A whole number of canvas units (feature tasks-canvas). */
const canvasInt = (min: number, max: number, msg: string) => v.pipe(v.number(msg), v.integer(msg), v.minValue(min, msg), v.maxValue(max, msg));
const canvasPlace = v.nullable(so({ x: canvasInt(0, 10_000, 'Canvas x must be a whole number from 0 to 10000'), y: canvasInt(0, 10_000, 'Canvas y must be a whole number from 0 to 10000') }));
const canvasId = v.pipe(v.string('Area id must be text'), v.regex(/^[A-Za-z0-9_-]{1,32}$/, 'Area id must be 1-32 characters of A-Z a-z 0-9 _ -'));
const canvasArea = so({
  id: canvasId,
  name: v.pipe(v.string('Area name is required'), v.trim(), v.minLength(1, 'Area name is required'), v.maxLength(60, 'Area name must be at most 60 characters')),
  color: hex,
  x: canvasInt(0, 10_000, 'Area x must be a whole number from 0 to 10000'),
  y: canvasInt(0, 10_000, 'Area y must be a whole number from 0 to 10000'),
  w: canvasInt(160, 4000, 'Area width must be a whole number from 160 to 4000'),
  h: canvasInt(120, 4000, 'Area height must be a whole number from 120 to 4000'),
});
/** `PUT /api/canvas` (API.md "Canvas"): the whole list of areas. */
export const canvasDocSchema = v.pipe(
  so({ areas: v.pipe(v.array(canvasArea), v.maxLength(50, 'At most 50 areas')) }),
  v.check((d) => new Set(d.areas.map((a) => a.id)).size === d.areas.length, 'Area ids must be unique'),
);

/** `POST /api/templates`, `PUT /api/templates/:id` (feature tasklist-templates): a name, item titles, estimate, category. */
export const templateSchema = so({
  name: v.pipe(v.string('Name is required'), v.trim(), v.minLength(1, 'Name is required'), v.maxLength(80, 'Name must be at most 80 characters')),
  items: v.pipe(v.array(so({ title: v.pipe(v.string('Item title must be text'), v.maxLength(200, 'Item title must be at most 200 characters')) })), v.maxLength(200, 'At most 200 items')),
  estimateMinutes: v.optional(estimate),
  categoryId: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(64)))),
});

/** {@link templateSchema} with a translatable error for a too long name (the app limits the field, an old one may not). */
export function parseTemplate(data: unknown): v.InferOutput<typeof templateSchema> {
  const name = (data as { name?: unknown } | null)?.name;
  if (typeof name === 'string' && name.trim().length > 80) throw new ApiException('VALIDATION_ERROR', 400, 'Name must be at most 80 characters', [{ field: 'name', issue: 'Name must be at most 80 characters' }], 'tasks.templates.nameTooLong');
  return parse(templateSchema, data);
}

const REQUIRED: Record<string, string> = {
  title: TITLE_REQ, name: 'Name is required', start: 'Start is required', end: 'End is required', date: 'Date is required',
  allDay: 'allDay is required', color: HEX_MSG, now: 'now is required', down: 'down is required',
};

/** Strict-object issues carry no custom text: unknown keys and missing keys are described here. */
function describe(i: v.BaseIssue<unknown>): string {
  if (i.type !== 'strict_object') return i.message;
  const key = i.path?.at(-1)?.key;
  if (i.expected === 'never') return 'Unknown field';
  return REQUIRED[String(key)] ?? `${String(key)} is required`;
}

export const createEventSchema = so({
  calendarId: v.optional(v.string()),
  title,
  description: v.optional(str(8000, 'Description')),
  location: v.optional(str(500, 'Location')),
  place: v.optional(place),
  allDay: v.boolean('allDay must be a boolean'),
  start: v.string('Start is required'),
  end: v.string('End is required'),
  colorId: v.optional(colorId),
  reminders: v.optional(reminders),
});
/** `POST /api/events` with `kind: 'birthday'` (API.md "Birthdays"): the name, the day and an optional colour. */
export const createBirthdaySchema = so({
  kind: v.literal('birthday'),
  title,
  date: localDate,
  colorId: v.optional(colorId),
});
export const updateEventSchema = so({
  calendarId: v.optional(v.string()),
  title: v.optional(title),
  description: v.optional(str(8000, 'Description')),
  location: v.optional(str(500, 'Location')),
  place: v.optional(place),
  allDay: v.optional(v.boolean('allDay must be a boolean')),
  start: v.optional(v.string('Start is required')),
  end: v.optional(v.string('End is required')),
  colorId: v.optional(colorId),
  reminders: v.optional(reminders),
});

export const createTaskListSchema = so({
  title: listTitle,
  date: v.nullable(localDate),
  time: v.optional(v.nullable(localTime)),
  items: v.optional(v.pipe(v.array(so({ title: v.pipe(v.string(), v.trim(), v.maxLength(200, 'Item title must be at most 200 characters')), done: v.optional(v.boolean()) })), v.maxLength(200, 'At most 200 items'))),
  categoryId: v.optional(v.nullable(v.string())),
  tags: v.optional(tags),
  estimateMinutes: v.optional(estimate),
  recurrence: v.optional(recurrence),
  reminders: v.optional(reminders),
});
export const updateTaskListSchema = so({
  title: v.optional(listTitle),
  date: v.optional(v.nullable(localDate)),
  time: v.optional(v.nullable(localTime)),
  items: v.optional(v.pipe(v.array(so({ id: v.optional(v.string()), title: v.pipe(v.string(), v.trim(), v.maxLength(200, 'Item title must be at most 200 characters')), done: v.boolean() })), v.maxLength(200, 'At most 200 items'))),
  categoryId: v.optional(v.nullable(v.string())),
  tags: v.optional(tags),
  estimateMinutes: v.optional(estimate),
  canvas: v.optional(canvasPlace),
  reminders: v.optional(reminders),
});
export const addItemSchema = so({ id: v.optional(v.pipe(v.string('id must be text'), v.regex(/^[A-Za-z0-9_-]{8,21}$/, 'id must be 8-21 letters, digits, - or _'))), title: itemTitle, done: v.optional(v.boolean()), index: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))) });
export const patchItemSchema = so({ title: v.optional(itemTitle), done: v.optional(v.boolean()) });
/** `POST /api/tasklists/:id/share`: the person (their `sub`) to add. */
export const shareSchema = so({ person: v.pipe(v.string('person is required'), v.minLength(1, 'person is required'), v.maxLength(64, 'person is too long')) });
/** `PUT /api/categories/:id/share`: the person to share the category with, or null to stop. */
export const categoryShareSchema = so({ person: v.nullable(v.pipe(v.string('person must be text'), v.minLength(1, 'person is required'), v.maxLength(64, 'person is too long'))) });
export const orderSchema = so({ itemIds: v.array(v.string()) });

export const settingsPatchSchema = so({
  themeMode: v.optional(v.picklist(['system', 'light', 'dark'], 'Invalid theme mode')),
  seedColor: v.optional(hex),
  defaultView: v.optional(v.picklist(['month', 'week', 'day'], 'Invalid default view')),
  defaultEventColorId: v.optional(colorId),
  animationLevel: v.optional(v.picklist(['full', 'reduced', 'off'], 'Invalid animation level')),
  sounds: v.optional(v.boolean()),
  calmMode: v.optional(v.boolean()),
  ignoreSystemMotion: v.optional(v.boolean()),
  streakFlame: v.optional(v.boolean()),
  plant: v.optional(v.boolean()),
  sunflowers: v.optional(v.picklist(['grow', 'full'], 'Invalid sunflowers setting')),
});
/** A whole number in a range (the theme sliders). */
const int = (min: number, max: number, msg: string) => v.pipe(v.number(msg), v.integer(msg), v.minValue(min, msg), v.maxValue(max, msg));
const themeOverrides = so({
  glow: v.optional(v.picklist(['off', 'soft', 'neon'], 'Invalid glow')),
  entries: v.optional(v.picklist(['solid', 'tinted', 'outline'], 'Invalid entries style')),
  corners: v.optional(v.picklist(['square', 'round', 'pill'], 'Invalid corners')),
  scene: v.optional(v.picklist(['none', 'sunflowers', 'mordor', 'spring', 'easter', 'summer', 'summerholidays', 'fall', 'halloween', 'christmas', 'newyearseve', 'newyear', 'winter'], 'Invalid scene')),
  seed: v.optional(hex),
  glowStrength: v.optional(int(0, 150, 'Invalid glow strength')),
  radius: v.optional(int(0, 28, 'Invalid corner radius')),
  tint: v.optional(int(5, 60, 'Invalid entry tint')),
  density: v.optional(v.picklist(['compact', 'comfortable', 'airy'], 'Invalid density')),
  checkbox: v.optional(v.picklist(['round', 'square', 'rounded'], 'Invalid checkbox shape')),
  checkFill: v.optional(v.picklist(['filled', 'outline'], 'Invalid checkbox fill')),
  check: v.optional(v.picklist(['tick', 'bold', 'cross', 'dot'], 'Invalid check mark')),
  icons: v.optional(v.picklist(['outlined', 'rounded', 'sharp'], 'Invalid icon set')),
});
const presetName = v.picklist([
  'Default', 'Neon', 'Spring', 'Easter', 'Summer', 'Summer holidays', 'Fall', 'Halloween', 'Christmas', 'New Year\'s Eve', 'New Year', 'Winter', 'Mordor',
]);
// an imported theme: `theme:<id>` (GET /api/themes)
const importedTheme = v.pipe(v.string(), v.regex(/^theme:[A-Za-z0-9_-]{1,32}$/));
export const themePatchSchema = so({
  preset: v.optional(v.union([presetName, importedTheme], 'Invalid theme')),
  overrides: v.optional(themeOverrides),
  seasonal: v.optional(v.picklist(['off', 'header', 'all'], 'Invalid seasons & holidays setting')),
});
const catName = v.pipe(v.string('Name is required'), v.trim(), v.minLength(1, 'Name is required'), v.maxLength(40, 'Name must be at most 40 characters'));
const icon = v.nullable(v.pipe(v.string(), v.maxLength(8, 'Icon must be a single emoji')));
export const categoryCreateSchema = so({ name: catName, color: hex, icon: v.optional(icon) });
export const categoryPatchSchema = so({ name: v.optional(catName), color: v.optional(hex), icon: v.optional(icon) });
export const categoryOrderSchema = so({ categoryIds: v.array(v.string()) });

export const resetSchema = so({
  seed: v.optional(v.boolean()),
  fixture: v.optional(so({
    events: v.optional(v.array(so({ ...createEventSchema.entries, id: v.optional(v.string()) }))),
    tasklists: v.optional(v.array(so({ ...createTaskListSchema.entries, id: v.optional(v.string()) }))),
  })),
});
export const clockSchema = so({ now: v.nullable(v.string()), frozen: v.optional(v.boolean()) });
export const testMotivationSchema = so({
  checkIns: v.optional(v.array(localDate)),
  plant: v.optional(so({ growth: v.number(), lastWatered: v.nullable(localDate), todayPoints: v.optional(v.number()) })),
});
export const testApkSchema = so({ versionCode: v.pipe(v.number(), v.integer(), v.minValue(1)), versionName: v.string(), certSha256: v.optional(v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))) });
/** `POST /api/__test/slow`: every later non-test `/api` answer waits this long (feature last-known-state). */
export const testSlowSchema = so({ ms: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(60_000)) });
export const testVersionSchema = so({ version: v.pipe(v.string(), v.minLength(1)) });
export const testReleaseNotesSchema = so({ notes: v.array(so({ date: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)), text: v.pipe(v.string(), v.minLength(1)) })) });
export const testConfigSchema = so({ pollIntervalMs: v.optional(v.pipe(v.number(), v.minValue(0))) });
export const rateLimitSchema = so({ retryAfterSec: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(600)) });
export const outageSchema = so({ down: v.boolean(), status: v.optional(v.picklist([500, 503])) });

/** Parses with a schema; throws VALIDATION_ERROR with the first message and per-field details. */
export function parse<S extends v.GenericSchema>(schema: S, data: unknown): v.InferOutput<S> {
  const r = v.safeParse(schema, data);
  if (r.success) return r.output;
  const details: ErrorDetail[] = r.issues.map((i) => ({ field: i.path?.map((p) => String(p.key)).join('.') || undefined, issue: describe(i) }));
  const bad = r.issues.find((i) => i.type === 'object' || i.type === 'strict_object');
  const message = bad && !bad.path ? 'Request body must be a JSON object' : describe(r.issues[0]!);
  throw new ApiException('VALIDATION_ERROR', 400, message, details);
}

const endpoint = v.pipe(v.string('endpoint must be a URL'), v.url('endpoint must be a URL'), v.startsWith('https://', 'endpoint must be https'), v.maxLength(2048, 'endpoint is too long'));
/** `POST /api/push/subscriptions`: a browser's `PushSubscription.toJSON()`. */
export const pushSubscribeSchema = so({ endpoint, keys: so({ p256dh: str(256, 'p256dh'), auth: str(64, 'auth') }) });
/** `DELETE /api/push/subscriptions`. */
export const pushUnsubscribeSchema = so({ endpoint });
/** `PUT /api/reminders/plan`: the browser's endpoint and the pushes it wants, soonest first. */
export const reminderPlanSchema = so({
  endpoint,
  plan: v.pipe(v.array(so({ at: v.pipe(v.number('at must be a number'), v.integer('at must be whole ms')), title: str(300, 'title'), body: str(300, 'body'), key: str(200, 'key'), kind: v.optional(v.picklist(['event', 'tasklist', 'summary', 'bedtime'], 'Invalid kind')) })), v.maxLength(500, 'At most 500 reminders')),
});
