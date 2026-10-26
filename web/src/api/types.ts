import type { LanguagePref } from '@/i18n/language';

/**
 * REST contract types (spec/API.md). Kept in sync by hand with `server/src/api/types.ts`.
 * If the server package exports the same module later, replace this file with a re-export.
 */
export type LocalDate = string; // 'YYYY-MM-DD'
export type LocalTime = string; // 'HH:mm'
export type DateTime = string; // RFC 3339 with offset

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'GOOGLE_REAUTH'
  | 'CALENDAR_PERMISSION_MISSING'
  | 'PRECONDITION_FAILED'
  | 'CONFLICT'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'DRIVE_PERMISSION_REQUIRED'
  | 'NO_BACKUP'
  | 'BACKUP_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; key?: string; details?: { field?: string; issue?: string }[] };
}

/** `GET /api/backup` (API.md "Backups"). */
export interface BackupStatus {
  available: boolean;
  permission: 'granted' | 'missing';
  state: 'off' | 'never' | 'ok' | 'failed';
  lastBackupAt: DateTime | null;
  error: string | null;
  keep: number;
}

/** `/api/auth/me`: both null while sign-in is off. */
export interface Me {
  email: string | null;
  name: string | null;
}

export interface Calendar {
  id: string;
  name: string;
  color: string;
  primary: boolean;
  writable: boolean;
  /** True for the person's own calendars: events go only there (feature events-readonly). */
  own: boolean;
  /** The person's choice (GET /api/calendars). */
  hidden?: boolean;
  /** Popup reminder leads of Google's calendar default, minutes, Google's order. */
  defaultReminders?: number[];
}

/**
 * An item's reminders: `minutes` is the popup lead list in effect (the calendar default while `useDefault`, else the
 * item's own list; feature reminders).
 */
export interface Reminders {
  useDefault: boolean;
  minutes: number[];
}

/** A place picked from the place search (feature event-location): its name and position (WGS 84 degrees). */
export interface Place {
  name: string;
  lat: number;
  lon: number;
}

export interface CalendarEvent {
  kind: 'event';
  id: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  /** The place picked for the location; absent for typed text (the location then shows no map). */
  place?: Place;
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
  reminders?: Reminders;
  etag: string;
  updated: DateTime;
}

export interface TaskItem {
  id: string;
  title: string;
  done: boolean;
}

export type Recurrence = 'daily' | 'weekly' | 'monthly';

/** Which occurrences of a repeating task list a change is for (feature tasklist-repeating): the shown one, or it and all later ones. */
export type ChangeScope = 'this' | 'following';

export interface TaskList {
  kind: 'tasklist';
  id: string;
  calendarId: string;
  title: string;
  /** Null = undated: the list shows only in the Tasks view, in no calendar view or tray. */
  date: LocalDate | null;
  time: LocalTime | null;
  items: TaskItem[];
  doneCount: number;
  totalCount: number;
  estimateMinutes: number | null;
  recurrence?: Recurrence | null;
  /** On an occurrence of a repeating list: the id of its series (Google `recurringEventId`); absent otherwise. */
  seriesId?: string;
  /** On an occurrence: the same for every part of a list split by a "this and following" change. */
  seriesKey?: string;
  categoryId: string | null;
  tags: string[];
  color: string;
  /** Colour of the tasks calendar: what an uncategorised list shows (used while task categories are switched off). */
  calendarColor?: string;
  /** Date the last open item was ticked (server, app clock); null/absent while an item is open. */
  completedOn?: LocalDate | null;
  /** Place on the Tasks view's Canvas (canvas units); null/absent = no place yet (Unsorted). */
  canvas?: CanvasPlace | null;
  /** Present on shared lists only (API.md "Shared task lists"). */
  shared?: SharedInfo;
  /** The owner's category look carried on a shared list (the requester's own categories may differ). */
  categoryInfo?: { name: string; color: string; icon: string | null } | null;
  /** Absent on shared lists (they live outside Google). */
  reminders?: Reminders;
  etag: string;
  updated: DateTime;
}

/** A person as the sharing controls show them. */
export interface Person {
  sub: string;
  name: string;
  email: string;
  initial: string;
}

/** Who a shared list is shared with, seen by the requester. */
export interface SharedInfo {
  owned: boolean;
  owner: Person;
  /** Everyone but the requester. */
  with: Person[];
}

/** A note's top-left corner on the Canvas, in canvas units (feature tasks-canvas). */
export interface CanvasPlace {
  x: number;
  y: number;
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
/** How often the emotional support cat comes by when a task list is finished (per person, `GET/PATCH /api/prefs`). */
export type SupportCatSetting = 'off' | 'sometimes' | 'always';

/** Where the view switcher sits: a bottom bar, a tabs row under the top bar, or a side rail (per person prefs `navPhone`, `navDesktop`). */
export type NavPosition = 'bottom' | 'top' | 'rail';

/** How the Tasks view groups its lists (per person pref). */
export type TasksGroupBy = 'time' | 'category' | 'none';
/** How the Tasks view sorts its lists (per person pref). */
export type TasksSortBy = 'date' | 'name' | 'category' | 'changed' | 'progress';

/** Tasks view sort direction relative to the sort key's own default. */
export type TasksSortDir = 'default' | 'reversed';
/** What finishing an undated task list does (per person pref `undatedDone`): show it in the calendar or archive only. */
export type UndatedDone = 'calendar' | 'archive';
/** What tapping a task list card does (per person pref `taskOpen`): grow it inline or open the drawer. */
export type TaskOpen = 'inline' | 'drawer';
/** The "When" choice of the Tasks filter (feature tasks-filter). */
export type TasksWhen = 'all' | 'nodate' | 'dated' | 'overdue' | 'today' | 'tomorrow' | 'week';
/** The Tasks view's filter (per person pref `tasksFilter`): category ids or `none` ("or"), and one When choice ("and"). */
export interface TasksFilter { categories: string[]; when: TasksWhen }

/** Approach bar window length: a whole number of hours from 1 to 24 (3, 6 and 12 offered; feature labs-approach-bar). */
export type ApproachWindowHours = number;

/**
 * Per-person preferences (`GET/PATCH /api/prefs`): Labs, the approach track and window, the Approaching card, tasks
 * calendar visibility and the support cat.
 */
export interface Prefs {
  labs: boolean;
  /** Per Labs view id: shown in the view switcher or not; a missing id follows the registry default (`LABS_VIEWS`). */
  labsViews: Record<string, boolean>;
  approachBar: boolean;
  approachWindowHours: ApproachWindowHours;
  approachingCard: boolean;
  taskCategories: boolean;
  /** "Show tasks calendar in Google": the tasks calendar is not hidden in Google's calendar list. */
  tasksCalendarVisible: boolean;
  supportCat: SupportCatSetting;
  /** Show the small build-version label in the bottom-left corner of the main UI. */
  versionInCorner: boolean;
  /** Left-handed mode: mirror the phone and touch-tablet layout (`html[data-hand="left"]`). */
  leftHanded: boolean;
  /** The "From Sat 10 Oct" label on carried-over task lists. */
  showCarriedFrom: boolean;
  /** Where the view switcher sits on phones and on desktop and tablets (feature nav-position). */
  navPhone: NavPosition;
  navDesktop: NavPosition;
  /** Tasks view grouping and sorting. */
  tasksGroupBy: TasksGroupBy;
  tasksSortBy: TasksSortBy;
  /** Labs: the AI prompt and the import in the theme menu (off by default). */
  labsOwnThemes: boolean;
  tasksSortDir: TasksSortDir;
  /** "Finished list without a date" (feature tasks-archive). */
  undatedDone: UndatedDone;
  /** Tapping a task list card: grow inline (default) or open the drawer (feature tasklists-expand-card). */
  taskOpen: TaskOpen;
  tasksFilter: TasksFilter;
  /** The UI language: `auto` follows the device (feature language). */
  language: LanguagePref;
  /** Bedtime mode: the night band in the timeline views and the reminder (feature bedtime). */
  bedtime: BedtimePrefs;
  notify: NotifyPrefs;
  /** Labs: the week as a two-row overview that fits one screen (off by default). */
  weekTwoRow: boolean;
  /** Labs: a tap on a task-list card grows it in place; off, a tap opens the list sheet. */
  labsGrowCards: boolean;
  /** Days on the overview's top row: 4 (Mon-Thu) or 3 (Mon-Wed). */
  weekTwoRowTop: 3 | 4;
  /** Minimum event length (min): a shorter timed entry is laid out as this long; 0 = off. */
  minEventMinutes: MinEventMinutes;
  /** Overlapping events side by side in the day view before they cascade (default 4). */
  daySideBySide: DaySideBySide;
  /** Overlapping events side by side in the week view (and the phone widget's week) before they cascade (default 2). */
  weekSideBySide: WeekSideBySide;
  /** What the top bar shows of the check-in streak: nothing (the default), the flame or the plant (feature plant-companion). */
  streak: StreakChoice;
  /** The sync icon all the time (on) or only while syncing fails (off, the default; feature header-layout). */
  syncIndicator: boolean;
}

/** The "Streak" choice in Settings › Focus & motivation. */
export type StreakChoice = 'off' | 'flame' | 'plant';
/** The minimum event length choices, in minutes (0 = off). */
export type MinEventMinutes = 0 | 15 | 30;
/** The "Day view: events side by side" choices. */
export type DaySideBySide = 2 | 3 | 4;
/** The "Week view: events side by side" choices. */
export type WeekSideBySide = 2 | 3;

/** Bedtime mode: fixed times, or follow the first timed appointment of the next day. */
export type BedtimeMode = 'fixed' | 'dynamic';
/** The per-person bedtime preference; times are `HH:MM`, durations whole minutes. */
export interface BedtimePrefs {
  enabled: boolean;
  mode: BedtimeMode;
  bedtime: string;
  wake: string;
  /** "Different on weekends": the nights before Saturday and Sunday use the weekend pair. */
  weekendDifferent: boolean;
  weekendBedtime: string;
  weekendWake: string;
  sleepMinutes: number;
  leadMinutes: number;
  /** Minutes before bedtime for the in-app reminder; 0 = no reminder. */
  reminderMinutes: number;
}

/** Which reminders become system notifications (Android app; Web Push once HTTPS exists). In-app snackbars are separate. */
export interface NotifyPrefs {
  bedtime: boolean;
  events: boolean;
  tasklists: boolean;
  /** A morning overview of the day at `morningTime` (`HH:MM`). */
  morning: boolean;
  morningTime: string;
}

export interface Settings {
  themeMode: ThemeMode;
  seedColor: string;
  defaultView: ViewName;
  defaultEventColorId: string | null;
  animationLevel: AnimationLevel;
  sounds: boolean;
  calmMode: boolean;
  ignoreSystemMotion: boolean;
  sunflowers: SunflowersMode;
  categories: Category[];
  updated: DateTime;
  version: number;
}

export type SettingsPatch = Partial<Omit<Settings, 'categories' | 'updated' | 'version'>>;

export interface Health {
  status: 'ok';
  provider: 'mock' | 'google';
  providerStatus: 'ok' | 'unavailable';
  version: string;
  time: DateTime;
  testMode: boolean;
}

export interface AppConfig {
  now: string;
  clockFrozen: boolean;
  timeZone: string;
  weekStartsOn: 1;
  pollIntervalMs: number;
  provider: 'mock' | 'google';
  testMode: boolean;
  publicUrl: string | null;
  version: string;
  /** The APK the server offers (`scripts/android-build.sh`), or null. */
  apk: { versionCode: number; versionName: string; certSha256?: string } | null;
  /** Names of the optional plugins this deployment turned on (ADR 0004), e.g. `door`. */
  plugins: string[];
  /** The place search (Photon) the device asks directly for location suggestions (feature event-location). */
  placeSearchUrl: string;
  /** The map picture template with `{z}`, `{x}`, `{y}` (OpenStreetMap tiles). */
  mapTileUrl: string;
}

/** One plain-English line of CHANGELOG.md (`GET /api/release-notes`). */
export interface ReleaseNote {
  id: string;
  date: string;
  text: string;
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

export interface CreateEventInput {
  calendarId?: string;
  title: string;
  description?: string;
  location?: string;
  /** The picked place; null drops it, absent keeps it (update). */
  place?: Place | null;
  allDay: boolean;
  start: DateTime | LocalDate;
  end: DateTime | LocalDate;
  colorId?: string | null;
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
  /** Null creates an undated list. */
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
  /** A date dates the list; null makes it undated (and drops its time). */
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

/** A saved task list template (API.md "Templates", feature tasklist-templates): never dated or ticked. */
export interface TaskTemplate {
  id: string;
  name: string;
  items: { title: string }[];
  estimateMinutes: number | null;
  categoryId: string | null;
}

/** `POST /api/templates` and `PUT /api/templates/:id` body. */
export interface TaskTemplateInput {
  name: string;
  items: { title: string }[];
  estimateMinutes?: number | null;
  categoryId?: string | null;
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

/** A person's Canvas document (`GET/PUT /api/canvas`). */
export interface CanvasDoc {
  version: 1;
  areas: CanvasArea[];
}

export type Density = 0 | 1 | 2 | 3;
export interface DaySummary {
  events: number;
  tasklists: number;
  openTasklists: number;
  density: Density;
}
export interface SummaryResponse {
  days: Record<LocalDate, DaySummary>;
}

export interface Motivation {
  streak: { current: number; best: number; lastCheckIn: LocalDate | null; checkedInToday: boolean };
  plant: {
    growth: number;
    stage: 'Seed' | 'Sprout' | 'Small plant' | 'Leafy' | 'Flowering';
    stageIndex: 0 | 1 | 2 | 3 | 4;
    nextStageAt: number | null;
    todayPoints: number;
    lastWatered: LocalDate | null;
    flowers: number;
    vitality: 100 | 75 | 50 | 25;
    mood: 'happy' | 'thirsty' | 'dry' | 'droopy';
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
