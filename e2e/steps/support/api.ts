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

  get<T = unknown>(path: string) { return this.call<T>('GET', path); }
  post<T = unknown>(path: string, body?: unknown) { return this.call<T>('POST', path, body ?? {}); }
  patch<T = unknown>(path: string, body: unknown) { return this.call<T>('PATCH', path, body); }
  delete(path: string) { return this.call('DELETE', path); }

  // --- test endpoints ------------------------------------------------------------------------------------------
  reset(body: unknown = { seed: false }) { return this.setup('/api/__test/reset', body); }
  setClock(now: string | null, frozen?: boolean) {
    return this.setup('/api/__test/clock', frozen === undefined ? { now } : { now, frozen });
  }
  setMotivation(body: { checkIns?: string[]; plant?: { growth: number; lastWatered: string | null; todayPoints?: number } }) {
    return this.setup('/api/__test/motivation', body);
  }
  setConfig(cfg: { pollIntervalMs?: number }) { return this.setup('/api/__test/config', cfg); }
  setOutage(down: boolean) { return this.setup('/api/__test/outage', down ? { down, status: 503 } : { down }); }

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

  async remoteEvents(q?: string): Promise<GoogleEvent[]> {
    const qs = q === undefined ? '' : `?q=${encodeURIComponent(q)}`;
    return (await this.get<{ items: GoogleEvent[] }>(`/api/__test/remote/events${qs}`)).items;
  }
  remoteInsert(ev: Partial<GoogleEvent> & { calendarId?: string }) {
    return this.post<GoogleEvent>('/api/__test/remote/events', ev);
  }
  remotePatch(id: string, patch: Partial<GoogleEvent>) {
    return this.patch<GoogleEvent>(`/api/__test/remote/events/${encodeURIComponent(id)}`, patch);
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
