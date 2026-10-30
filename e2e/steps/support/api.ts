import type { APIRequestContext, APIResponse } from '@playwright/test';

/** Raw Google Calendar v3 event subset returned by /api/__test/remote/events (API.md). */
export interface GoogleEvent {
  id: string;
  calendarId: string;
  etag: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> };
  [key: string]: unknown;
}

export interface Category { id: string; name: string; color: string; icon: string | null }
export interface Settings { categories: Category[]; version: number; [key: string]: unknown }
export interface Calendar { id: string; name: string }
/** Raw Google calendar list entry of the mock account (/api/__test/remote/calendars). */
export interface RemoteCalendar { id: string; summary: string; primary: boolean; accessRole: string; hidden?: boolean }

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Thin JSON client for the public API and the TEST_MODE endpoints. Any non-2xx response throws with the body, so a
 * failing fixture never silently produces a misleading UI failure later.
 */
export class Api {
  /** Set once any /api/__test/* endpoint was used, so the world can reset state after the scenario. */
  usedTestApi = false;

  constructor(private readonly request: APIRequestContext) {}

  async call<T = unknown>(method: Method, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    if (path.startsWith('/api/__test/')) this.usedTestApi = true;
    const res = await this.request.fetch(path, {
      method,
      data: body === undefined ? undefined : body,
      headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
      failOnStatusCode: false,
    });
    if (!res.ok()) {
      throw new Error(`${method} ${path} -> ${res.status()} ${await safeText(res)}`);
    }
    return (res.status() === 204 ? undefined : await res.json().catch(() => undefined)) as T;
  }

  /** The HTTP status of a call, whatever it is (for scenarios that expect a refusal). */
  async status(method: Method, path: string, body?: unknown): Promise<number> {
    const res = await this.request.fetch(path, {
      method, data: body, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, failOnStatusCode: false,
    });
    return res.status();
  }

  get<T = unknown>(path: string) { return this.call<T>('GET', path); }
  post<T = unknown>(path: string, body?: unknown) { return this.call<T>('POST', path, body ?? {}); }
  patch<T = unknown>(path: string, body: unknown) { return this.call<T>('PATCH', path, body); }
  put<T = unknown>(path: string, body: unknown) { return this.call<T>('PUT', path, body); }
  delete(path: string) { return this.call('DELETE', path); }

  // --- test endpoints ------------------------------------------------------------------------------------------
  reset(body: unknown = { seed: false }) { return this.setup('/api/__test/reset', body); }
  setClock(now: string | null, frozen?: boolean) {
    return this.setup('/api/__test/clock', frozen === undefined ? { now } : { now, frozen });
  }
  setMotivation(body: { checkIns?: string[]; plant?: { growth: number; lastWatered: string | null; todayPoints?: number } }) {
    return this.setup('/api/__test/motivation', body);
  }
  setConfig(cfg: { pollIntervalMs?: number; googlePollMs?: number }) { return this.setup('/api/__test/config', cfg); }
  /** A task list in one person's mock calendar (undated unless `date` is given), as a fixture. */
  createOwnedList(body: { owner: string; title: string; items?: string[]; category?: string; date?: string; tags?: string[] }) {
    return this.setup('/api/__test/tasklists', body);
  }
  /** Turns sign-in on with this allow-list (it is off with the mock provider otherwise; reset turns it off). */
  setAuth(allowedEmails: string[]) { return this.setup('/api/__test/auth', { allowedEmails }); }
  /** Sets the calendar list of one person's mock Google account (`shared`: read-only, not their primary). */
  setCalendars(owner: string, calendars: Array<{ id: string; name: string; color: string; primary?: boolean; shared?: boolean }>) {
    return this.setup('/api/__test/calendars', { owner, calendars });
  }
  /** The Google account the OAuth test double's consent screen signs in next. */
  chooseGoogleAccount(email: string, driveScope = true) { return this.setup('/api/__test/oauth/account', { email, driveScope }); }
  /** Google answers this person's token refresh with invalid_grant from now on. */
  revokeGoogleAccess(email: string) { return this.setup('/api/__test/oauth/revoke', { email }); }
  /** The fake consent screen grants the calendar scope (true) or leaves the checkbox unticked (false). */
  setCalendarGranted(granted: boolean) { return this.setup('/api/__test/oauth/calendar-access', { granted }); }
  setOutage(down: boolean) { return this.setup('/api/__test/outage', down ? { down, status: 503 } : { down }); }
  /** The next provider call answers "rate limited" with this `Retry-After` (seconds), as Google does (ADR 0007). */
  rateLimitNext(retryAfterSec: number) { return this.setup('/api/__test/rate-limit', { retryAfterSec }); }

  /**
   * Setup-only test endpoint call. With E2E_SOFT_TEST_API=1 a failure is logged instead of thrown: a diagnostic
   * mode for running the suite against a server that does not implement the test endpoints yet.
   */
  private async setup(path: string, body: unknown): Promise<void> {
    try {
      await this.post(path, body);
    } catch (e) {
      if (process.env.E2E_SOFT_TEST_API !== '1') throw e;
      console.warn(`[soft test api] ${(e as Error).message.slice(0, 120)}`);
    }
  }

  /** `owner`: the Google address whose (mock) calendar is read; omitted = the shared calendar. */
  async remoteEvents(q?: string, owner?: string): Promise<GoogleEvent[]> {
    const qs = new URLSearchParams({ ...(q === undefined ? {} : { q }), ...(owner === undefined ? {} : { owner }) }).toString();
    return (await this.get<{ items: GoogleEvent[] }>(`/api/__test/remote/events${qs ? `?${qs}` : ''}`)).items;
  }
  /** `owner`: the Google address whose (mock) calendar receives the event; omitted = the shared calendar. */
  remoteInsert(ev: Partial<GoogleEvent> & { calendarId?: string; owner?: string }) {
    return this.post<GoogleEvent>('/api/__test/remote/events', ev);
  }
  remotePatch(id: string, patch: Partial<GoogleEvent>) {
    return this.patch<GoogleEvent>(`/api/__test/remote/events/${encodeURIComponent(id)}`, patch);
  }
  /** The mock account's calendar list, hidden entries included; `owner` as for `remoteInsert`. */
  async remoteCalendars(owner?: string): Promise<RemoteCalendar[]> {
    const qs = owner === undefined ? '' : `?owner=${encodeURIComponent(owner)}`;
    return (await this.get<{ calendars: RemoteCalendar[] }>(`/api/__test/remote/calendars${qs}`)).calendars;
  }
  /** Adds a calendar to the mock account's list as another Google client would. */
  remoteInsertCalendar(summary: string, hidden: boolean, owner?: string, extra: { id?: string; accessRole?: string; ownerEmail?: string } = {}) {
    return this.post<RemoteCalendar>('/api/__test/remote/calendars', { summary, hidden, owner, ...extra });
  }
  /** The id of the person's "Calendar app: tasks" calendar (found or created like the app does on first use). */
  async tasksCalendarId(owner?: string): Promise<string> {
    const qs = owner === undefined ? '' : `?owner=${encodeURIComponent(owner)}`;
    return (await this.get<{ id: string }>(`/api/__test/tasks-calendar${qs}`)).id;
  }
  remoteDelete(id: string) { return this.delete(`/api/__test/remote/events/${encodeURIComponent(id)}`); }
  memory() { return this.get<{ rss: number; heapUsed: number }>('/api/__test/memory?gc=true'); }

  // --- public API helpers ----------------------------------------------------------------------------------------
  settings() { return this.get<Settings>('/api/settings'); }

  async categoryId(name: string): Promise<string> {
    const cat = (await this.settings()).categories.find((c) => c.name === name);
    if (!cat) throw new Error(`No category named "${name}"`);
    return cat.id;
  }

  async calendarId(name: string): Promise<string> {
    const { calendars } = await this.get<{ calendars: Calendar[] }>('/api/calendars');
    const cal = calendars.find((c) => c.name === name);
    if (!cal) throw new Error(`No calendar named "${name}" (have: ${calendars.map((c) => c.name).join(', ')})`);
    return cal.id;
  }
}

async function safeText(res: APIResponse): Promise<string> {
  try { return (await res.text()).slice(0, 500); } catch { return ''; }
}
