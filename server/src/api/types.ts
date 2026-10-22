/**
 * Shared REST API types (spec/API.md). Pure types only, no runtime code, so `web/` can copy or path-alias this file.
 */

export type LocalDate = string; // 'YYYY-MM-DD'
export type LocalTime = string; // 'HH:mm'
export type DateTime = string; // RFC 3339 with offset

export interface Calendar {
  id: string;
  name: string;
  color: string;
  primary: boolean;
  writable: boolean;
  /** True for the person's own calendars: events go only there (feature events-readonly). */
  own: boolean;
  /** Popup reminder lead times of Google's calendar default, in minutes, in Google's order. */
  defaultReminders: number[];
}

/**
 * An item's reminders (feature reminders). `minutes` is the popup lead list in effect: the
 * calendar's default while `useDefault` is true, else the item's own list. Email reminders stay in Google, untouched.
 */
export interface Reminders {
  useDefault: boolean;
  minutes: number[];
}

export interface CalendarEvent {
  kind: 'event';
  id: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: DateTime | LocalDate;
  end: DateTime | LocalDate;
  colorId: string | null;
  color: string;
  /** Set only on Google birthday entries: `anniversary` for a contact's anniversary, `birthday` for every other special date. */
  special?: 'birthday' | 'anniversary';
  /** True when the app cannot edit or delete it: not in an own calendar, an invitation, or a birthday of the contacts calendar. */
  readOnly?: true;
  /** Why `readOnly` is set (an invitation from `by`, or an event in the calendar of `by`); absent for the contacts Birthdays calendar. */
  readOnlyReason?: { kind: 'invitation' | 'calendar'; by: string };
  /** Birthdays only: true when Google keeps the date (linked to a contact, or the person's own birthday); name and colour stay editable. */
  dateLocked?: true;
  reminders: Reminders;
  etag: string;
  updated: DateTime;
}

export interface TaskItem {
  id: string;
  title: string;
  done: boolean;
}

/** A note's top-left corner on the Canvas (feature tasks-canvas). */
export interface CanvasPlace {
  x: number;
  y: number;
}

export type Recurrence = 'daily' | 'weekly' | 'monthly';

export interface TaskList {
  kind: 'tasklist';
  id: string;
  calendarId: string;
  title: string;
  /** Null = undated: the list appears only in the Tasks view (feature tasks-view). */
  date: LocalDate | null;
  time: LocalTime | null;
  items: TaskItem[];
  doneCount: number;
  totalCount: number;
  estimateMinutes: number | null;
  recurrence: Recurrence | null;
  categoryId: string | null;
  tags: string[];
  color: string;
  /** Colour of the tasks calendar (what an uncategorised list shows). */
  calendarColor: string;
  completedOn: LocalDate | null;
  /** Place on the Tasks view's Canvas in canvas units; null = no place yet (Unsorted). */
  canvas: CanvasPlace | null;
  /** Absent on shared lists (they live outside Google and have no reminders). */
  reminders?: Reminders;
  /** Present on shared lists only (API.md "Shared task lists"). */
  shared?: SharedInfo;
  /** The owner's category (name, colour, icon) carried on a shared list, whatever the requester's own categories are. */
  categoryInfo?: CategoryInfo | null;
  etag: string;
  updated: DateTime;
}

/** A person as the sharing UI shows them. */
export interface Person {
  sub: string;
  name: string;
  email: string;
  /** First letter of the name (upper case), for the badge. */
  initial: string;
}

/** What a shared list tells its requester: whether they own it and who else is on it. */
export interface SharedInfo {
  owned: boolean;
  owner: Person;
  /** Everyone but the requester (owner included when the requester is a member). */
  with: Person[];
}

/** A category's look as carried on a shared list. */
export interface CategoryInfo {
  name: string;
  color: string;
  icon: string | null;
}

export type CalendarItem = CalendarEvent | TaskList;

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  googleColorId: string;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type ViewName = 'month' | 'week' | 'day';
export type AnimationLevel = 'full' | 'reduced' | 'off';
/** How many flowers the Sunflower field scene shows: one per 40 growth points, or a fixed full field. */
export type SunflowersMode = 'grow' | 'full';

export interface Settings {
  themeMode: ThemeMode;
  seedColor: string;
  defaultView: ViewName;
  defaultEventColorId: string | null;
  animationLevel: AnimationLevel;
  sounds: boolean;
  calmMode: boolean;
  ignoreSystemMotion: boolean;
  streakFlame: boolean;
  plant: boolean;
  sunflowers: SunflowersMode;
  categories: Category[];
  updated: DateTime;
  version: number;
}

export type SettingsPatch = Partial<Omit<Settings, 'categories' | 'updated' | 'version'>>;

export interface CreateEventInput {
  calendarId?: string;
  title: string;
  description?: string;
  location?: string;
  allDay: boolean;
  start: DateTime | LocalDate;
  end: DateTime | LocalDate;
  colorId?: string | null;
  /** Absent keeps the calendar default (create) or the current reminders (update). */
  reminders?: Reminders;
}
export type UpdateEventInput = Partial<CreateEventInput>;

/** `POST /api/events` with `kind: 'birthday'`: a yearly birthday in the person's primary calendar, like Google's "Birthday" create menu. */
export interface CreateBirthdayInput {
  kind: 'birthday';
  title: string;
  date: LocalDate;
  colorId?: string | null;
}

export interface CreateTaskListInput {
  title: string;
  /** Null creates an undated list (no time, no recurrence). */
  date: LocalDate | null;
  time?: LocalTime | null;
  items?: { title: string; done?: boolean }[];
  categoryId?: string | null;
  tags?: string[];
  estimateMinutes?: number | null;
  recurrence?: Recurrence | null;
  reminders?: Reminders;
}

export interface UpdateTaskListInput {
  title?: string;
  /** A date dates the list; null makes it undated and drops its time. */
  date?: LocalDate | null;
  time?: LocalTime | null;
  items?: { id?: string; title: string; done: boolean }[];
  categoryId?: string | null;
  tags?: string[];
  estimateMinutes?: number | null;
  /** Integers 0-10000; null clears the place. */
  canvas?: CanvasPlace | null;
  reminders?: Reminders;
}

/** One labelled rectangle on the Canvas (API.md "Canvas"). */
export interface CanvasArea {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A person's Canvas document: one serialisable JSON file. */
export interface CanvasDoc {
  version: 1;
  areas: CanvasArea[];
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'GOOGLE_REAUTH'
  | 'CALENDAR_PERMISSION_MISSING'
  | 'PRECONDITION_FAILED'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'DRIVE_PERMISSION_REQUIRED'
  | 'NO_BACKUP'
  | 'BACKUP_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface ApiError {
  error: { code: ErrorCode; message: string; key?: string; details?: { field?: string; issue?: string }[] };
}

export interface HealthResponse {
  status: 'ok';
  provider: 'mock' | 'google';
  providerStatus: 'ok' | 'unavailable';
  version: string;
  time: DateTime;
  testMode: boolean;
}

export interface ConfigResponse {
  now: string;
  clockFrozen: boolean;
  timeZone: string;
  weekStartsOn: 1;
  pollIntervalMs: number;
  provider: 'mock' | 'google';
  testMode: boolean;
  publicUrl: string | null;
  version: string;
}

export interface ItemsResponse {
  items: CalendarItem[];
  from: LocalDate;
  to: LocalDate;
  /** Echo of the optional `also` range whose items are merged into `items`. */
  also?: { from: LocalDate; to: LocalDate };
  syncedAt: DateTime;
  /** Set while Google's rate limit is in force: the items come from the server's cache and may be older than the last poll. */
  stale?: true;
}

export interface SummaryDay {
  events: number;
  tasklists: number;
  openTasklists: number;
  density: 0 | 1 | 2 | 3;
}

export type PlantStage = 'Seed' | 'Sprout' | 'Small plant' | 'Leafy' | 'Flowering';
export type PlantMood = 'happy' | 'thirsty' | 'dry' | 'droopy';

export interface Motivation {
  streak: { current: number; best: number; lastCheckIn: LocalDate | null; checkedInToday: boolean };
  plant: {
    growth: number;
    stage: PlantStage;
    stageIndex: 0 | 1 | 2 | 3 | 4;
    nextStageAt: number | null;
    todayPoints: number;
    lastWatered: LocalDate | null;
    flowers: number;
    vitality: 100 | 75 | 50 | 25;
    mood: PlantMood;
    message: string;
  };
}

export interface CheckInResponse {
  current: number;
  best: number;
  checkedInToday: true;
  newToday: boolean;
  motivation: Motivation;
}
