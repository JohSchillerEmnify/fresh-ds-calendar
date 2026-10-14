import { calendar as makeCalendar, type calendar_v3 } from '@googleapis/calendar';
import type { OAuth2Client } from 'google-auth-library';
import type { AppConfig } from '../../config.js';
import {
  NotFoundError, PreconditionFailedError, ProviderError, ProviderUnavailableError,
  ReauthRequiredError, CalendarPermissionMissingError, type CalendarProvider, type GoogleEvent, type GoogleEventInput, type GoogleReminder, type GoogleEventPatch, type ListEventsParams,
  type ListEventsResult, type ProviderCalendar, type WriteOptions,
} from '../CalendarProvider.js';
import { calendarScopeMissing, getUserClient, hasUserToken } from './auth.js';
import { causeOf, describeGoogleError, logEvent, noteCause, subHash } from '../../lib/diag.js';
import { isRateLimit, RateGuard, retryAfterSec, type GuardOptions } from './RateGuard.js';

type Api = calendar_v3.Calendar;
type Dt = calendar_v3.Schema$EventDateTime;

export interface GoogleProviderOptions {
  api: Api;
  /** Optional hook, e.g. a "not authorised" check performed before every call. */
  ready?: () => void;
  /** The person's Google `sub`; only its short hash is ever logged (diagnostics). */
  sub?: string;
  /** Cache and cooldown tuning (tests); the defaults are the production values. */
  guard?: Omit<GuardOptions, 'subHash'>;
}

interface GoogleErrorBody { status?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] }

/** Google's 403 reasons for a token that lacks the needed scope. */
function isInsufficientScope(body: string | GoogleErrorBody | undefined): boolean {
  if (!body || typeof body === 'string') return false;
  return [...(body.errors ?? []), ...(body.details ?? [])].some((x) => x.reason === 'insufficientPermissions' || x.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT');
}

/** Maps googleapis/gaxios errors to the provider error classes (ARCHITECTURE §2) and notes the cause for the `api_unavailable` log line. */
export function mapGoogleError(e: unknown): Error {
  const mapped = mapGoogleErrorInner(e);
  if (mapped !== e) noteCause(mapped, causeOf(describeGoogleError(e)));
  return mapped;
}

function mapGoogleErrorInner(e: unknown): Error {
  if (e instanceof ProviderError || e instanceof ProviderUnavailableError || e instanceof ReauthRequiredError || e instanceof CalendarPermissionMissingError || e instanceof NotFoundError || e instanceof PreconditionFailedError) return e;
  const err = e as { code?: number | string; status?: number; response?: { status?: number; data?: { error?: string | GoogleErrorBody } }; message?: string };
  // Google refuses the stored refresh token: only signing in again helps
  if (err.response?.data?.error === 'invalid_grant' || err.message === 'invalid_grant') return new ReauthRequiredError('invalid_grant');
  // 403 because the calendar scope was not granted (not a quota or sharing problem)
  if (isInsufficientScope(err.response?.data?.error)) return new CalendarPermissionMissingError(err.message ?? 'insufficient scope');
  const status = Number(err.response?.status ?? err.status ?? (typeof err.code === 'number' ? err.code : NaN));
  const msg = err.message ?? 'Google API error';
  if (status === 401 || status === 403 || status === 429) return new ProviderUnavailableError(msg);
  if (status === 404 || status === 410) return new NotFoundError(msg);
  if (status === 412) return new PreconditionFailedError(msg);
  if (status >= 500) return new ProviderUnavailableError(msg);
  if (Number.isNaN(status)) return new ProviderUnavailableError(msg); // network error, invalid_grant, DNS ...
  return new ProviderError(msg);
}

export class GoogleProvider implements CalendarProvider {
  readonly name = 'google' as const;
  private readonly guard: RateGuard;
  constructor(private readonly o: GoogleProviderOptions) {
    this.guard = new RateGuard({ ...o.guard, subHash: subHash(o.sub) });
  }

  cooldownMs(): number {
    return this.guard.cooldownMs();
  }

  /**
   * Runs one Google API call; a failure is logged as one `google_error` line (op, status, reason or network code, duration) and mapped.
   * During a rate-limit cooldown no call is made; a rate-limit answer starts the cooldown. `write` calls invalidate cached reads.
   */
  private async call<T>(op: string, fn: () => Promise<T>, write = false): Promise<T> {
    try {
      this.o.ready?.();
    } catch (e) {
      throw mapGoogleError(e);
    }
    this.guard.assertOpen();
    const started = Date.now();
    try {
      const r = await fn();
      this.guard.noteSuccess();
      if (write) this.guard.invalidate();
      return r;
    } catch (e) {
      const { status, reason, code, retry } = describeGoogleError(e);
      logEvent('google_error', { subHash: subHash(this.o.sub), op, status, reason, code, retry, durationMs: Date.now() - started });
      if (isRateLimit(status, reason)) throw this.guard.noteRateLimited(op, retryAfterSec(e));
      throw mapGoogleError(e);
    }
  }

  async ping(): Promise<void> {
    await this.call('calendarList.list', () => this.o.api.calendarList.list({ maxResults: 1 }));
  }

  async listCalendars(): Promise<ProviderCalendar[]> {
    // hidden entries too: the person's tasks calendar is hidden in Google's list (ARCHITECTURE §3)
    return this.guard.cached('calendarList', async () => {
      const res = await this.call('calendarList.list', () => this.o.api.calendarList.list({ maxResults: 250, showHidden: true }));
      const out: ProviderCalendar[] = [];
      for (const c of res.data.items ?? []) {
        out.push({
          id: c.primary ? 'primary' : c.id!,
          summary: c.summaryOverride ?? c.summary ?? c.id!,
          backgroundColor: (c.backgroundColor ?? '#039be5').toLowerCase(),
          primary: !!c.primary,
          accessRole: (c.accessRole as ProviderCalendar['accessRole']) ?? 'reader',
          hidden: !!c.hidden,
          defaultReminders: (c.defaultReminders ?? []).map((r) => ({ method: r.method ?? 'popup', minutes: r.minutes ?? 0 })),
        });
      }
      return out;
    });
  }

  async insertCalendar(summary: string): Promise<ProviderCalendar> {
    const res = await this.call('calendars.insert', () => this.o.api.calendars.insert({ requestBody: { summary } }), true);
    return { id: res.data.id!, summary: res.data.summary ?? summary, backgroundColor: '#039be5', primary: false, accessRole: 'owner', hidden: false };
  }

  async setCalendarHidden(calendarId: string, hidden: boolean): Promise<void> {
    await this.call('calendarList.patch', () => this.o.api.calendarList.patch({ calendarId, requestBody: { hidden } }), true);
  }

  async setCalendarDefaultReminders(calendarId: string, reminders: GoogleReminder[]): Promise<void> {
    await this.call('calendarList.patch', () => this.o.api.calendarList.patch({ calendarId, requestBody: { defaultReminders: reminders } }), true);
  }

  async listEvents(p: ListEventsParams): Promise<ListEventsResult> {
    const key = `events|${p.calendarId}|${p.timeMin ?? ''}|${p.timeMax ?? ''}|${p.showDeleted ? 1 : 0}|${(p.privateExtendedProperty ?? []).join('&')}`;
    return this.guard.cached(key, () => this.fetchEvents(p));
  }

  private async fetchEvents(p: ListEventsParams): Promise<ListEventsResult> {
    const items: GoogleEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    do {
      const res = await this.call('events.list', () =>
        this.o.api.events.list({
          calendarId: p.calendarId, timeMin: p.timeMin, timeMax: p.timeMax, singleEvents: true, showDeleted: p.showDeleted ?? false,
          privateExtendedProperty: p.privateExtendedProperty, maxResults: 2500, pageToken,
        }),
      );
      for (const e of res.data.items ?? []) items.push(fromApi(e, p.calendarId));
      pageToken = res.data.nextPageToken ?? undefined;
      nextSyncToken = res.data.nextSyncToken ?? undefined;
    } while (pageToken && items.length < 10_000);
    return { items, nextSyncToken };
  }

  async getEvent(calendarId: string, eventId: string): Promise<GoogleEvent> {
    const res = await this.call('events.get', () => this.o.api.events.get({ calendarId, eventId }));
    return fromApi(res.data, calendarId);
  }

  async insertEvent(calendarId: string, ev: GoogleEventInput): Promise<GoogleEvent> {
    const res = await this.call('events.insert', () => this.o.api.events.insert({ calendarId, requestBody: toApi(ev) }), true);
    return fromApi(res.data, calendarId);
  }

  async patchEvent(calendarId: string, eventId: string, patch: GoogleEventPatch, o?: WriteOptions): Promise<GoogleEvent> {
    const requestBody = toApi(patch);
    // Google merges nested objects on PATCH: switching date <-> dateTime needs the other field nulled.
    for (const k of ['start', 'end'] as const) {
      const v = requestBody[k] as (Dt & Record<string, unknown>) | undefined;
      if (v) {
        if (v.date && !v.dateTime) v.dateTime = null as unknown as string;
        if (v.dateTime && !v.date) v.date = null as unknown as string;
      }
    }
    const res = await this.call('events.patch', () =>
      this.o.api.events.patch({ calendarId, eventId, requestBody }, o?.ifMatch ? { headers: { 'If-Match': o.ifMatch } } : undefined),
      true,
    );
    return fromApi(res.data, calendarId);
  }

  async deleteEvent(calendarId: string, eventId: string, o?: WriteOptions): Promise<void> {
    await this.call('events.delete', () => this.o.api.events.delete({ calendarId, eventId }, o?.ifMatch ? { headers: { 'If-Match': o.ifMatch } } : undefined), true);
  }

  async moveEvent(calendarId: string, eventId: string, destinationCalendarId: string): Promise<GoogleEvent> {
    const res = await this.call('events.move', () => this.o.api.events.move({ calendarId, eventId, destination: destinationCalendarId }), true);
    return fromApi(res.data, destinationCalendarId);
  }

  async listChanges(calendarId: string, syncToken: string): Promise<ListEventsResult> {
    const res = await this.call('events.list', () => this.o.api.events.list({ calendarId, syncToken, showDeleted: true, maxResults: 2500 }));
    return { items: (res.data.items ?? []).map((e) => fromApi(e, calendarId)), nextSyncToken: res.data.nextSyncToken ?? undefined };
  }
}

function fromApi(e: calendar_v3.Schema$Event, calendarId: string): GoogleEvent {
  const dt = (d: Dt | undefined) => {
    const o: GoogleEvent['start'] = {};
    if (d?.date) o.date = d.date;
    if (d?.dateTime) o.dateTime = d.dateTime;
    if (d?.timeZone) o.timeZone = d.timeZone;
    return o;
  };
  const ev: GoogleEvent = {
    id: e.id!, calendarId, etag: e.etag ?? '', status: (e.status as GoogleEvent['status']) ?? 'confirmed',
    start: dt(e.start), end: dt(e.end), created: e.created ?? '', updated: e.updated ?? '',
  };
  if (e.summary != null) ev.summary = e.summary;
  if (e.description != null) ev.description = e.description;
  if (e.location != null) ev.location = e.location;
  if (e.colorId != null) ev.colorId = e.colorId;
  if (e.iCalUID) ev.iCalUID = e.iCalUID;
  if (e.sequence != null) ev.sequence = e.sequence;
  if (e.recurrence) ev.recurrence = e.recurrence;
  if (e.recurringEventId) ev.recurringEventId = e.recurringEventId;
  if (e.eventType) ev.eventType = e.eventType;
  if (e.visibility) ev.visibility = e.visibility;
  if (e.transparency) ev.transparency = e.transparency;
  if (e.birthdayProperties) ev.birthdayProperties = { ...e.birthdayProperties } as NonNullable<GoogleEvent['birthdayProperties']>;
  if (e.reminders) {
    ev.reminders = { useDefault: !!e.reminders.useDefault };
    if (e.reminders.overrides) ev.reminders.overrides = e.reminders.overrides.map((r) => ({ method: r.method ?? 'popup', minutes: r.minutes ?? 0 }));
  }
  if (e.extendedProperties) {
    ev.extendedProperties = {};
    if (e.extendedProperties.private) ev.extendedProperties.private = { ...e.extendedProperties.private };
    if (e.extendedProperties.shared) ev.extendedProperties.shared = { ...e.extendedProperties.shared };
  }
  return ev;
}

function toApi(x: GoogleEventInput | GoogleEventPatch): calendar_v3.Schema$Event {
  const { recurringEventId: _r, ...rest } = x as Record<string, unknown>;
  return structuredClone(rest) as calendar_v3.Schema$Event;
}

/** Builds the Google Calendar API client for an OAuth client. */
export function makeApi(auth: OAuth2Client, fetchImplementation?: typeof fetch): Api {
  return makeCalendar({ version: 'v3', auth, ...(fetchImplementation ? { fetchImplementation } : {}) } as Parameters<typeof makeCalendar>[0]);
}

/** Builds one person's provider for PROVIDER=google; fails fast when the OAuth client is not configured. */
export function createGoogleProvider(config: AppConfig, sub: string, fetchImplementation?: typeof fetch): GoogleProvider {
  const g = config.google;
  if (!g.clientId || !g.clientSecret) throw new Error('PROVIDER=google requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  const auth: OAuth2Client = getUserClient(config, sub);
  return new GoogleProvider({
    sub,
    api: makeApi(auth, fetchImplementation),
    ready: () => {
      if (!hasUserToken(config, sub) && !auth.credentials.refresh_token && !auth.credentials.access_token) {
        throw new ReauthRequiredError('No Google access stored for this person');
      }
      if (calendarScopeMissing(config, sub)) throw new CalendarPermissionMissingError('Calendar scope not granted');
    },
  });
}
