/**
 * Typed client for every endpoint in spec/API.md. Plain `fetch`, no dependencies.
 *
 * - Errors are thrown as `ApiError` (HTTP errors carry the server `code`; network failures use code `NETWORK`).
 * - Etags: pass `ifMatch` to send `If-Match` (events, task list details, settings version).
 * - Every call accepts an optional `AbortSignal`.
 * - Mutation responses with `X-Motivation-Changed: 1` notify `onMotivationChanged` listeners.
 * - 401 `UNAUTHENTICATED` / `GOOGLE_REAUTH` responses notify `onAuthError` listeners (sign-in, API.md "Sign-in").
 */
import type {
  AppConfig, Calendar, CalendarEvent, CheckInResponse, CreateEventInput, CreateTaskListInput, ErrorCode, Health,
  ItemsResponse, LocalDate, Me, Motivation, Settings, SettingsPatch, SummaryResponse, TaskList, UpdateEventInput,
  UpdateTaskListInput,
} from './types';

export type ClientErrorCode = ErrorCode | 'NETWORK' | 'ABORTED' | 'HTTP';

export const MSG_UNAVAILABLE = 'Could not save: Google Calendar is unavailable';
export const MSG_CONFLICT = 'This event was changed elsewhere. Reload it and try again.';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;
  readonly details: { field?: string; issue?: string }[];
  constructor(status: number, code: ClientErrorCode, message: string, details: { field?: string; issue?: string }[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
  /** Network failure, 502 or 503: Google (or the server) cannot be reached. Drives the sync error banner. */
  get isUnavailable(): boolean {
    return this.code === 'NETWORK' || this.status === 502 || this.status === 503;
  }
  get isConflict(): boolean {
    return this.status === 412;
  }
  get isValidation(): boolean {
    return this.status === 400;
  }
  get isAbort(): boolean {
    return this.code === 'ABORTED';
  }
  /** The message the UI shows for a failed save (API.md "Error format"). */
  get userMessage(): string {
    if (this.isUnavailable) return MSG_UNAVAILABLE;
    if (this.isConflict) return MSG_CONFLICT;
    return this.message;
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
  ifMatch?: string | number;
}

type Fetch = typeof fetch;

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: Fetch;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: Fetch;
  private readonly motivationListeners = new Set<() => void>();
  private readonly authListeners = new Set<(code: ErrorCode) => void>();

  constructor(opts: ApiClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? '';
    this.fetchImpl = opts.fetch ?? ((...a) => globalThis.fetch(...a));
  }

  /** Called after a mutation response carries `X-Motivation-Changed: 1`. Returns an unsubscribe function. */
  onMotivationChanged(fn: () => void): () => void {
    this.motivationListeners.add(fn);
    return () => this.motivationListeners.delete(fn);
  }

  /** Called when a response says the person must sign in (again). Returns an unsubscribe function. */
  onAuthError(fn: (code: ErrorCode) => void): () => void {
    this.authListeners.add(fn);
    return () => this.authListeners.delete(fn);
  }

  async request<T>(method: string, path: string, body?: unknown, o: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (o.ifMatch !== undefined && o.ifMatch !== null) headers['If-Match'] = String(o.ifMatch);
    let res: Response;
    try {
      res = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: o.signal,
        cache: 'no-store',
      });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw new ApiError(0, 'ABORTED', 'Request aborted');
      throw new ApiError(0, 'NETWORK', 'Network error');
    }
    if (res.headers.get('X-Motivation-Changed') === '1') {
      for (const fn of this.motivationListeners) fn();
    }
    if (res.status === 204) return undefined as T;
    let data: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      const err = (data as { error?: { code?: ErrorCode; message?: string; details?: [] } } | null)?.error;
      if (res.status === 401 && (err?.code === 'UNAUTHENTICATED' || err?.code === 'GOOGLE_REAUTH')) {
        for (const fn of this.authListeners) fn(err.code);
      }
      throw new ApiError(res.status, err?.code ?? 'HTTP', err?.message ?? `HTTP ${res.status}`, err?.details ?? []);
    }
    return data as T;
  }

  // --- sign-in ----------------------------------------------------------------
  me(o?: RequestOptions) {
    return this.request<Me>('GET', '/api/auth/me', undefined, o);
  }
  signOut(o?: RequestOptions) {
    return this.request<void>('POST', '/api/auth/signout', undefined, o);
  }

  // --- health & config ----------------------------------------------------
  health(o?: RequestOptions) {
    return this.request<Health>('GET', '/api/health', undefined, o);
  }
  config(o?: RequestOptions) {
    return this.request<AppConfig>('GET', '/api/config', undefined, o);
  }
  calendars(o?: RequestOptions) {
    return this.request<{ calendars: Calendar[] }>('GET', '/api/calendars', undefined, o);
  }

  prefs(o?: RequestOptions) {
    return this.request<{ labs: boolean; approachBar: boolean }>('GET', '/api/prefs', undefined, o);
  }
  patchPrefs(p: { labs?: boolean; approachBar?: boolean }, o?: RequestOptions) {
    return this.request<{ labs: boolean; approachBar: boolean }>('PATCH', '/api/prefs', p, o);
  }

  setCalendarHidden(id: string, hidden: boolean, o?: RequestOptions) {
    return this.request<Calendar>('PATCH', `/api/calendars/${encodeURIComponent(id)}`, { hidden }, o);
  }

  // --- items ----------------------------------------------------------------
  items(from: LocalDate, to: LocalDate, calendarIds?: string[], o?: RequestOptions) {
    const q = new URLSearchParams({ from, to });
    if (calendarIds?.length) q.set('calendarIds', calendarIds.join(','));
    return this.request<ItemsResponse>('GET', `/api/items?${q}`, undefined, o);
  }
  summary(from: LocalDate, to: LocalDate, o?: RequestOptions) {
    return this.request<SummaryResponse>('GET', `/api/summary?${new URLSearchParams({ from, to })}`, undefined, o);
  }

  // --- events ---------------------------------------------------------------
  createEvent(input: CreateEventInput, o?: RequestOptions) {
    return this.request<CalendarEvent>('POST', '/api/events', input, o);
  }
  getEvent(id: string, o?: RequestOptions) {
    return this.request<CalendarEvent>('GET', `/api/events/${enc(id)}`, undefined, o);
  }
  updateEvent(id: string, patch: UpdateEventInput, o?: RequestOptions) {
    return this.request<CalendarEvent>('PATCH', `/api/events/${enc(id)}`, patch, o);
  }
  deleteEvent(id: string, o?: RequestOptions) {
    return this.request<void>('DELETE', `/api/events/${enc(id)}`, undefined, o);
  }

  // --- task lists -------------------------------------------------------------
  createTaskList(input: CreateTaskListInput, o?: RequestOptions) {
    return this.request<TaskList>('POST', '/api/tasklists', input, o);
  }
  getTaskList(id: string, o?: RequestOptions) {
    return this.request<TaskList>('GET', `/api/tasklists/${enc(id)}`, undefined, o);
  }
  updateTaskList(id: string, patch: UpdateTaskListInput, o?: RequestOptions) {
    return this.request<TaskList>('PATCH', `/api/tasklists/${enc(id)}`, patch, o);
  }
  deleteTaskList(id: string, o?: RequestOptions) {
    return this.request<void>('DELETE', `/api/tasklists/${enc(id)}`, undefined, o);
  }
  addTaskItem(id: string, item: { title: string; done?: boolean; index?: number }, o?: RequestOptions) {
    return this.request<TaskList>('POST', `/api/tasklists/${enc(id)}/items`, item, o);
  }
  updateTaskItem(id: string, itemId: string, patch: { title?: string; done?: boolean }, o?: RequestOptions) {
    return this.request<TaskList>('PATCH', `/api/tasklists/${enc(id)}/items/${enc(itemId)}`, patch, o);
  }
  deleteTaskItem(id: string, itemId: string, o?: RequestOptions) {
    return this.request<TaskList>('DELETE', `/api/tasklists/${enc(id)}/items/${enc(itemId)}`, undefined, o);
  }
  reorderTaskItems(id: string, itemIds: string[], o?: RequestOptions) {
    return this.request<TaskList>('PUT', `/api/tasklists/${enc(id)}/items/order`, { itemIds }, o);
  }
  openTaskLists(today: LocalDate, days = 30, o?: RequestOptions) {
    const q = new URLSearchParams({ today, days: String(days) });
    return this.request<{ items: TaskList[]; finishedToday: TaskList[] }>('GET', `/api/tasklists/open?${q}`, undefined, o);
  }

  // --- settings & categories ----------------------------------------------------
  settings(o?: RequestOptions) {
    return this.request<Settings>('GET', '/api/settings', undefined, o);
  }
  /** `ifMatch` = the settings `version` the patch is based on (412 if stale). */
  patchSettings(patch: SettingsPatch, o?: RequestOptions) {
    return this.request<Settings>('PATCH', '/api/settings', patch, o);
  }
  createCategory(input: { name: string; color: string; icon?: string | null }, o?: RequestOptions) {
    return this.request<Settings>('POST', '/api/categories', input, o);
  }
  updateCategory(id: string, patch: { name?: string; color?: string; icon?: string | null }, o?: RequestOptions) {
    return this.request<Settings>('PATCH', `/api/categories/${enc(id)}`, patch, o);
  }
  deleteCategory(id: string, o?: RequestOptions) {
    return this.request<Settings>('DELETE', `/api/categories/${enc(id)}`, undefined, o);
  }
  reorderCategories(categoryIds: string[], o?: RequestOptions) {
    return this.request<Settings>('PUT', '/api/categories/order', { categoryIds }, o);
  }

  // --- motivation -------------------------------------------------------------------
  motivation(o?: RequestOptions) {
    return this.request<Motivation>('GET', '/api/motivation', undefined, o);
  }
  checkIn(o?: RequestOptions) {
    return this.request<CheckInResponse>('POST', '/api/streak/checkin', undefined, o);
  }

  // --- demo data (mock provider only; endpoint not yet in API.md, see web/README.md) --------
  resetDemoData(o?: RequestOptions) {
    return this.request<unknown>('POST', '/api/demo/reset', undefined, o);
  }
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

/** App-wide client instance. Tests construct their own `ApiClient` with a mocked `fetch`, or call `setApi`. */
export let api = new ApiClient();
export function setApi(client: ApiClient): void {
  api = client;
}
