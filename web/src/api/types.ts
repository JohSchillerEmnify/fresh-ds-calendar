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
  | 'GOOGLE_REAUTH'
  | 'PRECONDITION_FAILED'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'INTERNAL';

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: { field?: string; issue?: string }[] };
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
  /** The person's choice (GET /api/calendars). */
  hidden?: boolean;
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
  etag: string;
  updated: DateTime;
}

export interface TaskItem {
  id: string;
  title: string;
  done: boolean;
}

export type Recurrence = 'daily' | 'weekly' | 'monthly';

export interface TaskList {
  kind: 'tasklist';
  id: string;
  calendarId: string;
  title: string;
  date: LocalDate;
  time: LocalTime | null;
  items: TaskItem[];
  doneCount: number;
  totalCount: number;
  estimateMinutes: number | null;
  recurrence?: Recurrence | null;
  categoryId: string | null;
  tags: string[];
  color: string;
  /** Date the last open item was ticked (server, app clock); null/absent while an item is open. */
  completedOn?: LocalDate | null;
  etag: string;
  updated: DateTime;
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
export type GardenStyle = 'plant' | 'sunflowers' | 'off';
/** Top app bar background scene (owner addition, not yet in API.md; see web/README.md). */
export type SceneName = 'sunflowers' | 'mordor' | 'none';
/** How often the emotional support cat comes by when a task list is finished (per person, `GET/PATCH /api/prefs`). */
export type SupportCatSetting = 'off' | 'sometimes' | 'always';

/** Per-person preferences (`GET/PATCH /api/prefs`): Labs switches and the support cat. */
export interface Prefs {
  labs: boolean;
  approachBar: boolean;
  supportCat: SupportCatSetting;
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
  transitionWarningMinutes: 0 | 5 | 10 | 15;
  streakFlame: boolean;
  garden: GardenStyle;
  /** Optional until the server stores it; the web app falls back to localStorage. */
  scene?: SceneName;
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
}

export interface ItemsResponse {
  items: CalendarItem[];
  from: LocalDate;
  to: LocalDate;
  syncedAt: DateTime;
}

export interface CreateEventInput {
  calendarId?: string;
  title: string;
  description?: string;
  location?: string;
  allDay: boolean;
  start: DateTime | LocalDate;
  end: DateTime | LocalDate;
  colorId?: string | null;
}
export type UpdateEventInput = Partial<CreateEventInput>;

export interface CreateTaskListInput {
  calendarId?: string;
  title: string;
  date: LocalDate;
  time?: LocalTime | null;
  items?: { title: string; done?: boolean }[];
  categoryId?: string | null;
  tags?: string[];
  estimateMinutes?: number | null;
  recurrence?: Recurrence | null;
}
export interface UpdateTaskListInput {
  title?: string;
  date?: LocalDate;
  time?: LocalTime | null;
  items?: { id?: string; title: string; done: boolean }[];
  categoryId?: string | null;
  tags?: string[];
  estimateMinutes?: number | null;
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
