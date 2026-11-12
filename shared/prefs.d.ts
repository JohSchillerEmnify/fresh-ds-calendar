/** Types of the per-person preferences table in `prefs.js` (`GET/PATCH /api/prefs`). */

/** How often the emotional support cat comes by when a task list is finished. */
export type SupportCat = 'off' | 'sometimes' | 'always';
/** Where the view switcher sits (feature nav-position): bottom bar, tabs row under the top bar, or side rail. */
export type NavPosition = 'bottom' | 'top' | 'rail';
/** The phone's choices for the view switcher: the three positions or the side menu (drawer, feature nav-expressive). */
export type NavPhonePosition = NavPosition | 'drawer';
/** A bar size (feature nav-expressive, header-expressive): `auto` is Compact on phones, Expressive elsewhere. */
export type BarSize = 'auto' | 'expressive' | 'compact';
/** How the month view moves (feature month-vertical): sideways swipes, one list scrolling up and down, or that list snapping to one month at a time. */
export type MonthScroll = 'sideways' | 'vertical' | 'vertical-snap';
/** What the top bar shows of the check-in streak (feature plant-companion): nothing, the flame or the plant. */
export type StreakChoice = 'off' | 'flame' | 'plant';
export type WidgetCircle = 'time' | 'countdown';
export type AndroidWidgetHoursMode = 'auto' | 'fixed';
/** The iPhone Timeline's hours: `auto` fits the appointments, `fixed` shows `from` to `to`. */
export interface TimelineHours { mode: 'auto' | 'fixed'; from: string; to: string }
export type AndroidWidgetStyle = 'agenda' | 'timeline';
export type WidgetLayout = 'standard' | 'timeline';
export type WidgetTimelineDays = 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** The phone's top bar (feature header-layout): two rows (the default) or one row. A person pref, not theming. */
export type HeaderLayout = 'auto' | 'two-rows' | 'one-row';
/** How the Tasks view groups its lists (feature tasks-view). */
export type TasksGroupBy = 'time' | 'category' | 'none';
/** How the Tasks view sorts its lists. */
export type TasksSortBy = 'date' | 'name' | 'category' | 'changed' | 'progress';
/** Sort direction relative to the sort key's own default (feature tasks-view). */
export type TasksSortDir = 'default' | 'reversed';
/** The "When" choice of the Tasks filter (feature tasks-filter). */
export type TasksWhen = 'all' | 'nodate' | 'dated' | 'overdue' | 'today' | 'tomorrow' | 'week';
/** The Tasks view's filter: category ids (or `none`) combined with "or", and one When choice, combined with "and". */
export interface TasksFilter { categories: string[]; when: TasksWhen }
/** What finishing an undated task list does: show it in the calendar on that day, or keep it in the Archive only. */
export type UndatedDone = 'calendar' | 'archive';
/** What tapping a task list card does: grow it inline or open the drawer. */
export type TaskOpen = 'inline' | 'drawer';
/** How far ahead the approach bar reaches, in whole hours from 1 to 24 (3, 6 and 12 offered; feature labs-approach-bar). */
export type ApproachWindowHours = number;
/** The minimum event length choices, in minutes (0 = off). */
export type MinEventMinutes = 0 | 15 | 30;
/** How many overlapping events the day view places side by side, 1 = the start-group cascade (feature event-display). */
export type DaySideBySide = 1 | 2 | 3 | 4;
/** How many overlapping events the week view places side by side, 1 = the start-group cascade (feature event-display). */
export type WeekSideBySide = 1 | 2 | 3;

/** The languages the app is translated into. */
export declare const LANGUAGE_VALUES: readonly ['en', 'de', 'de-x-mainfr', 'de-x-coldmirror'];
/** The `language` preference: `auto` follows the device, otherwise one of {@link LANGUAGE_VALUES}. */
export type LanguagePref = 'auto' | (typeof LANGUAGE_VALUES)[number];

/** Bedtime mode (feature bedtime): fixed times, or follow the first appointment of the next day. */
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

/** Which reminders reach the person as system notifications (Android app now, Web Push once HTTPS exists); the in-app snackbars follow their own settings. */
export interface NotifyPrefs {
  /** The bedtime reminder (its lead is `bedtime.reminderMinutes`). */
  bedtime: boolean;
  /** "Dentist starts in 10 min" before timed events (lead: the reminder lists, feature reminders). */
  events: boolean;
  /** The same before task lists with a time; default off. */
  tasklists: boolean;
  /** A morning overview of the day at `morningTime`. */
  morning: boolean;
  /** `HH:MM`. */
  morningTime: string;
}

/** The per-person preferences returned by `GET /api/prefs`. */
export interface Prefs {
  /** Per Labs view id: shown in the view switcher or not; an id that is missing follows the client's registry default. */
  labsViews: Record<string, boolean>;
  /** Per main view id (`year`, `month`, `week`, `day`, `tasks`, `clock-rings`): offered in the view switcher or not; a missing id is on. */
  stableViews: Record<string, boolean>;
  labs: boolean;
  approachBar: boolean;
  approachWindowHours: ApproachWindowHours;
  /** The Approaching card above the calendar views (feature labs-approach-bar). */
  approachingCard: boolean;
  /** The running entry's "· N min left" in the Approaching card's line; off, or with the card off, the entry itself shows it. */
  approachTimeLeft: boolean;
  /** Task-list categories shown; off hides every category UI but keeps the stored ids. */
  taskCategories: boolean;
  /** "Show tasks calendar in Google": the tasks calendar's entry in Google's list is not hidden. */
  tasksCalendarVisible: boolean;
  supportCat: SupportCat;
  /** The small build-version label in the bottom-left corner of the main UI (off by default). */
  versionInCorner: boolean;
  /** Left-handed mode: the phone and touch-tablet layout is mirrored (feature left-handed-mode; off by default). */
  leftHanded: boolean;
  /** The "From Sat 10 Oct" label on task lists carried over to today (on by default). */
  showCarriedFrom: boolean;
  /** Where the view switcher sits on phones (default `bottom`) and on desktop and tablets (default `rail`). */
  navPhone: NavPhonePosition;
  navDesktop: NavPosition;
  /** Tasks view grouping and sorting, remembered per person. */
  tasksGroupBy: TasksGroupBy;
  tasksSortBy: TasksSortBy;
  /** Labs: the AI prompt and the import in the theme menu (saved own themes show either way). */
  labsOwnThemes: boolean;
  tasksSortDir: TasksSortDir;
  /** "Finished list without a date" (feature tasks-archive). */
  undatedDone: UndatedDone;
  /** Tapping a task list card: grow inline (default) or open the drawer. */
  taskOpen: TaskOpen;
  /** Several task list cards may be grown at once (default) or only one: growing another collapses the previous. */
  growSeveral: boolean;
  /** Send the device's error and crash log to the server by itself (feature device-log); off until the person turns it on. */
  sendReportsAuto: boolean;
  /** The Tasks view's filter, shared by Open, Canvas and Archive (feature tasks-filter). */
  tasksFilter: TasksFilter;
  /** The UI language: `auto` (device language) or a fixed one (feature language). */
  language: LanguagePref;
  /** Bedtime mode: the night band in the timeline views and the reminder (feature bedtime). */
  bedtime: BedtimePrefs;
  /** Which reminders become system notifications (feature reminders). */
  notify: NotifyPrefs;
  /** Labs: the week as a two-row overview that fits one screen (feature two-row-week; off by default). */
  weekTwoRow: boolean;
  /** Days on the overview's top row: 4 (Mon-Thu on top) or 3 (Mon-Wed on top). */
  weekTwoRowTop: 3 | 4;
  /** Labs: items of a task list can be written by hand with a pen (feature handwritten-lists); off, existing ink stays visible and tickable. */
  labsHandwriting: boolean;
  /** Minimum event length (min): a shorter timed entry is laid out as this long; 0 = off (feature min-event-length). */
  minEventMinutes: MinEventMinutes;
  /** Overlapping events side by side in the day view before they cascade (default 4). */
  daySideBySide: DaySideBySide;
  /** Overlapping events side by side in the week view and the phone widget's week before they cascade (default 2). */
  weekSideBySide: WeekSideBySide;
  /** The iPhone widget's lock-screen circle: the next entry's start time (the default) or a live countdown to it (feature iphone-widget). */
  widgetCircle: WidgetCircle;
  /** Not used any more: the List and the Multi-day widget are two widgets now. Still stored and readable. */
  androidWidgetStyle: AndroidWidgetStyle;
  /** How many hours of the day the Android Multi-day widget fits into its height, 4 to 24 (default 16), when `androidWidgetHoursMode` is `fixed` (feature scrolling-widget). */
  androidWidgetHours: number;
  /** The Android Multi-day widget's hours: `fixed` (the default, `androidWidgetHours` of them) or `auto` (the hours of the appointments shown, scrolling for the rest). */
  androidWidgetHoursMode: AndroidWidgetHoursMode;
  /** The days the Android Timeline widget shows as columns, 1 to 7 (default 3). */
  androidWidgetDays: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** The iPhone widget's medium and large layout: the standard views or the Timeline (feature iphone-widget). */
  widgetLayout: WidgetLayout;
  /** How many days the Timeline of the iPhone and the Android widget shows, 1 to 7; null until chosen (then `androidWidgetDays`, else 3; see `timelineDays`). */
  widgetTimelineDays: WidgetTimelineDays | null;
  /** The iPhone Timeline's hours: `auto` (the default) or a fixed range with appointments outside it marked at the edge (feature iphone-widget). */
  widgetTimelineHours: TimelineHours;
  /** The text size of the iPhone Timeline and the Android Multi-day widget in percent, 90 to 150 in steps of 5 (default 110). */
  widgetTimelineTextSize: number;
  /** What the top bar shows of the streak: off (the default), flame or plant. */
  streak: StreakChoice;
  /** The sync icon all the time (on) or only while syncing fails (off, the default; feature header-layout). */
  syncIndicator: boolean;
  /** The person said "not now" to the offer to show birthdays from Google Contacts (feature contact-birthdays); the Birthdays settings still offer it. */
  contactsOfferDismissed: boolean;
  /** The phone's top bar: Expressive (`two-rows`), Compact (`one-row`) or `auto` (the default: Compact on phones; features header-layout, header-expressive). */
  headerLayout: HeaderLayout;
  /** The bottom bar's size: Expressive 64 px or Compact 52 px (`auto`: Compact on phones, Expressive elsewhere; feature nav-expressive). */
  bottomBarSize: BarSize;
  monthScroll: MonthScroll;
  /** Width in px of the desktop open-tasks side panel, 260 to 560, default 380 (feature open-tasks-in-sight). */
  trayWidth: number;
  /** When each calendar switches off by itself (feature calendar-off-plan), by calendar id. */
  calendarPlans: Record<string, CalendarPlan>;
}

/** A point in the week: `day` 0 = Sunday, `time` HH:MM wall time in the calendar zone. */
export interface WeekPoint { day: number; time: string }
/** A calendar's plan: weekly off-windows and/or off until 00:00 of `until`; `switchedAt` is retired (accepted from old devices, ignored; ADR 0037). */
export interface CalendarPlan {
  windows?: { from: WeekPoint; to: WeekPoint }[];
  until?: string;
  since?: string;
  switchedAt?: string;
}

/** One preference of the table: its default and its validation (`{ value }`, or `{ error }` with the 400's message). */
export interface PrefDef<T> {
  default: T;
  /** An object whose valid fields are merged over the current value instead of replacing it. */
  merge?: true;
  parse(raw: unknown, key: string): { value: T | Partial<T> } | { error: string };
}

/** Every preference with its default and validation, in the order of `GET /api/prefs`. */
export declare const PREFS: { readonly [K in keyof Prefs]: PrefDef<Prefs[K]> };
/** The preference names, in table order. */
export declare const PREF_KEYS: readonly (keyof Prefs)[];
/** The bedtime preference of a person who never touched the settings: bedtime mode is off. */
export declare const DEFAULT_BEDTIME: BedtimePrefs;
/** The notification preference of a new person: everything but the morning overview. */
export declare const DEFAULT_NOTIFY: NotifyPrefs;

/** Every preference at its default, as fresh objects. */
export declare function defaultPrefs(): Prefs;
/** Fills every preference of a stored document with a valid value: anything missing or invalid takes the default. */
export declare function readPrefs(raw: Record<string, unknown> | null | undefined): Prefs;
/** The value after a change: a `merge` preference merges the incoming fields over the current ones, others are replaced. */
export declare function mergePref<K extends keyof Prefs>(key: K, current: Prefs[K], incoming: Prefs[K] | Partial<Prefs[K]>): Prefs[K];
/** Validates a `PATCH /api/prefs` body against the table: the valid fields (merge preferences merged over `current`), or the first bad field with its message. */
export declare function parsePrefsPatch(body: Record<string, unknown>, current: Prefs): { patch: Partial<Prefs> } | { error: string; field: string };

/** The one day count of the Timeline on iPhone and Android: the shared choice, else the older Android choice, else 3. */
export function timelineDays(prefs: Pick<Prefs, 'widgetTimelineDays' | 'androidWidgetDays'>): WidgetTimelineDays;
