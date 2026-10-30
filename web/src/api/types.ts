import type { ApiError, ConfigResponse, DateTime, HealthResponse, LocalDate, SummaryDay } from '@calendar/shared/api';
import type { LanguagePref } from '@/i18n/language';

/** REST contract types (spec/API.md) live in `shared/api.d.ts`; this file re-exports them plus the web-only ones below. */
export type * from '@calendar/shared/api';

export type ApiErrorBody = ApiError;

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

/** Which occurrences of a repeating task list a change is for (feature tasklist-repeating): the shown one, or it and all later ones. */
export type ChangeScope = 'this' | 'following';
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
  /** "Time left" in the Approaching card's line; off, the running entry shows it instead. */
  approachTimeLeft: boolean;
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
  /** The phone's top bar: two rows (the default) or one row (feature header-layout); not part of the theme. */
  headerLayout: HeaderLayout;
}

/** The "Header layout" choice in Settings › Calendar (phones only). */
export type HeaderLayout = 'two-rows' | 'one-row';
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

export type Health = HealthResponse;

export interface AppConfig extends ConfigResponse {
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

export type Density = SummaryDay['density'];
export type DaySummary = SummaryDay;
export interface SummaryResponse {
  days: Record<LocalDate, DaySummary>;
}
