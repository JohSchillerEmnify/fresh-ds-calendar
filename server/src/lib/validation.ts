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
  allDay: v.boolean('allDay must be a boolean'),
  start: v.string('Start is required'),
  end: v.string('End is required'),
  colorId: v.optional(colorId),
});
export const updateEventSchema = so({
  calendarId: v.optional(v.string()),
  title: v.optional(title),
  description: v.optional(str(8000, 'Description')),
  location: v.optional(str(500, 'Location')),
  allDay: v.optional(v.boolean('allDay must be a boolean')),
  start: v.optional(v.string('Start is required')),
  end: v.optional(v.string('End is required')),
  colorId: v.optional(colorId),
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
});
export const updateTaskListSchema = so({
  title: v.optional(listTitle),
  date: v.optional(v.nullable(localDate)),
  time: v.optional(v.nullable(localTime)),
  items: v.optional(v.pipe(v.array(so({ id: v.optional(v.string()), title: v.pipe(v.string(), v.trim(), v.maxLength(200, 'Item title must be at most 200 characters')), done: v.boolean() })), v.maxLength(200, 'At most 200 items'))),
  categoryId: v.optional(v.nullable(v.string())),
  tags: v.optional(tags),
  estimateMinutes: v.optional(estimate),
});
export const addItemSchema = so({ title: itemTitle, done: v.optional(v.boolean()), index: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))) });
export const patchItemSchema = so({ title: v.optional(itemTitle), done: v.optional(v.boolean()) });
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
  transitionWarningMinutes: v.optional(v.picklist([0, 5, 10, 15], 'Invalid warning time')),
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
export const testVersionSchema = so({ version: v.pipe(v.string(), v.minLength(1)) });
export const testConfigSchema = so({ pollIntervalMs: v.optional(v.pipe(v.number(), v.minValue(0))) });
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
