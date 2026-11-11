import { calendar as makeCalendar, type calendar_v3 } from '@googleapis/calendar';
import { people as makePeople, type people_v1 } from '@googleapis/people';
import { fromPerson } from './person.js';
import type { OAuth2Client } from 'google-auth-library';
import type { CalendarColor } from '@calendar/shared/colors';
import type { AppConfig } from '../../config.js';
import {
  NotFoundError, PreconditionFailedError, ProviderError, RateLimitedError, ProviderForbiddenError, ProviderUnavailableError,
  ReauthRequiredError, CalendarPermissionMissingError, SyncTokenExpiredError, SyncTokenTooLargeError, type CalendarProvider, type GoogleEvent, type GoogleEventInput, type GoogleReminder, type GoogleEventPatch, type ListEventsParams,
  type ListEventsResult, type ProviderCalendar, type WriteOptions, type ContactsResult, type GoogleContact,
} from '../CalendarProvider.js';
import { GOOGLE_TIMEOUT_MS, calendarScopeMissing, getUserClient, hasUserToken } from './auth.js';
import { calHash, causeOf, describeGoogleError, logEvent, noteCause, subHash } from '../../lib/diag.js';
import { isRateLimit, RateGuard, retryAfterSec, type GuardOptions } from './RateGuard.js';

type Api = calendar_v3.Calendar;
type Dt = calendar_v3.Schema$EventDateTime;

export interface GoogleProviderOptions {
  api: Api;
  /** The People API client of the same person (contact birthdays, feature contact-birthdays). */
  people?: people_v1.People;
  /** Optional hook, e.g. a "not authorised" check performed before every call. */
  ready?: () => void;
  /** The person's Google `sub`; only its short hash is ever logged (diagnostics). */
  sub?: string;
  /** Cache and cooldown tuning (tests); the defaults are the production values. */
  guard?: Omit<GuardOptions, 'subHash'>;
}

/** Most events one list read collects before it gives up, and most pages of instances read for one series. */
const MAX_ITEMS = 10_000;
const MAX_INSTANCE_PAGES = 40;
/** Most pages walked for a sync token (2500 entries each). */
const MAX_TOKEN_PAGES = 200;

interface GoogleErrorBody { status?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] }

const MAX_CONTACT_PAGES = 50;

/** The People API refuses a sync token older than 7 days with HTTP 400 and the reason `EXPIRED_SYNC_TOKEN`. */
function isExpiredContactsToken(e: unknown): boolean {
  const err = e as { response?: { status?: number; data?: unknown }; status?: number };
  const status = Number(err.response?.status ?? err.status);
  return status === 400 && JSON.stringify(err.response?.data ?? '').includes('EXPIRED_SYNC_TOKEN');
}

/** Google's 403 reasons for a token that lacks the needed scope. */
function isInsufficientScope(body: string | GoogleErrorBody | undefined): boolean {
  if (!body || typeof body === 'string') return false;
  return [...(body.errors ?? []), ...(body.details ?? [])].some((x) => x.reason === 'insufficientPermissions' || x.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT');
}

/** Google's 403 reasons that mean "you may not do this on this calendar" (quota and rate reasons are not among them). */
const PERMISSION_REASONS = new Set(['forbidden', 'requiredAccessLevel', 'writerAccess']);

/** True when a 403 body names a permission reason, so only a real refusal is told apart from quota and other 403s. */
function isPermissionRefusal(body: string | GoogleErrorBody | undefined): boolean {
  if (!body || typeof body === 'string') return false;
  return [...(body.errors ?? []), ...(body.details ?? [])].some((x) => x.reason !== undefined && PERMISSION_REASONS.has(x.reason));
}

/** Maps googleapis/gaxios errors to the provider error classes and notes the cause for the `api_unavailable` log line. */
export function mapGoogleError(e: unknown): Error {
  const mapped = mapGoogleErrorInner(e);
  if (mapped !== e) noteCause(mapped, causeOf(describeGoogleError(e)));
  return mapped;
}

function mapGoogleErrorInner(e: unknown): Error {
  if (e instanceof ProviderError || e instanceof ProviderUnavailableError || e instanceof ReauthRequiredError || e instanceof CalendarPermissionMissingError || e instanceof NotFoundError || e instanceof PreconditionFailedError || e instanceof SyncTokenExpiredError) return e;
  const err = e as { code?: number | string; status?: number; response?: { status?: number; data?: { error?: string | GoogleErrorBody } }; message?: string };
  // Google refuses the stored refresh token: only signing in again helps
  if (err.response?.data?.error === 'invalid_grant' || err.message === 'invalid_grant') return new ReauthRequiredError('invalid_grant');
  // 403 because the calendar scope was not granted (not a quota or sharing problem)
  if (isInsufficientScope(err.response?.data?.error)) return new CalendarPermissionMissingError(err.message ?? 'insufficient scope');
  const status = Number(err.response?.status ?? err.status ?? (typeof err.code === 'number' ? err.code : NaN));
  const msg = err.message ?? 'Google API error';
  if (status === 403 && isPermissionRefusal(err.response?.data?.error)) return new ProviderForbiddenError(msg);
  if (status === 401 || status === 403 || status === 429) return new ProviderUnavailableError(msg);
  if (status === 404 || status === 410) return new NotFoundError(msg);
  if (status === 412) return new PreconditionFailedError(msg);
  if (status >= 500) return new ProviderUnavailableError(msg);
  if (Number.isNaN(status)) return new ProviderUnavailableError(msg); // network error, invalid_grant, DNS ...
  return new ProviderError(msg);
}

/** One `calendarList` entry as the provider's calendar. */
function fromListEntry(c: calendar_v3.Schema$CalendarListEntry): ProviderCalendar {
  // the primary calendar's id is the person's address; a secondary one names its owner in `dataOwner`
  const owner = c.primary ? c.id : c.dataOwner;
  return {
    id: c.primary ? 'primary' : c.id!,
    summary: c.summaryOverride ?? c.summary ?? c.id!,
    backgroundColor: (c.backgroundColor ?? '#039be5').toLowerCase(),
    primary: !!c.primary,
    accessRole: (c.accessRole as ProviderCalendar['accessRole']) ?? 'reader',
    hidden: !!c.hidden,
    ...(owner ? { owner } : {}),
    defaultReminders: (c.defaultReminders ?? []).map((r) => ({ method: r.method ?? 'popup', minutes: r.minutes ?? 0 })),
  };
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
   * Runs one Google API call; a failure is logged as one `google_error` line (op, status, reason or network code, hashed
   * calendar id, duration) and mapped. During a rate-limit cooldown no call is made; a rate-limit answer starts the
   * cooldown. `write` calls invalidate cached reads.
   */
  private async call<T>(op: string, fn: () => Promise<T>, write = false, calendarId?: string, background = false): Promise<T> {
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
      // an error rewrapped inside `fn` (the 410 of a sync token) is described by Google's own answer it carries
      const { status, reason, code, retry, field, message } = describeGoogleError(e instanceof SyncTokenExpiredError && e.cause ? e.cause : e);
      logEvent('google_error', { subHash: subHash(this.o.sub), op, calHash: calHash(calendarId), status, reason, code, retry, field, message, durationMs: Date.now() - started });
      if (isRateLimit(status, reason)) {
        // a background read's rate limit must not pause the person's syncing
        if (background) throw new RateLimitedError(retryAfterSec(e) ?? 1);
        throw this.guard.noteRateLimited(op, retryAfterSec(e));
      }
      throw mapGoogleError(e);
    }
  }

  async ping(): Promise<void> {
    await this.call('calendarList.list', () => this.o.api.calendarList.list({ maxResults: 1 }));
  }

  async listCalendars(): Promise<ProviderCalendar[]> {
    // hidden entries too: the person's tasks calendar is hidden in Google's list (ADR 0006)
    return this.guard.cached('calendarList', async () => {
      const res = await this.call('calendarList.list', () => this.o.api.calendarList.list({ maxResults: 250, showHidden: true }));
      return (res.data.items ?? []).map(fromListEntry);
    });
  }

  async insertCalendar(summary: string): Promise<ProviderCalendar> {
    const res = await this.call('calendars.insert', () => this.o.api.calendars.insert({ requestBody: { summary } }), true);
    return { id: res.data.id!, summary: res.data.summary ?? summary, backgroundColor: '#039be5', primary: false, accessRole: 'owner', hidden: false };
  }

  async publicCalendarExists(calendarId: string): Promise<boolean> {
    try {
      await this.call('calendars.get', () => this.o.api.calendars.get({ calendarId }), false, calendarId);
      return true;
    } catch (e) {
      if (!(e instanceof NotFoundError || e instanceof ProviderForbiddenError)) throw e;
    }
    // a public calendar the person has not added may be unreadable by calendars.get but still listable
    try {
      await this.call('events.list', () => this.o.api.events.list({ calendarId, maxResults: 1 }), false, calendarId);
      return true;
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof ProviderForbiddenError) return false;
      throw e;
    }
  }

  async subscribeCalendar(calendarId: string): Promise<ProviderCalendar> {
    const res = await this.call('calendarList.insert', () => this.o.api.calendarList.insert({ requestBody: { id: calendarId, selected: true } }), true, calendarId);
    return fromListEntry(res.data);
  }

  async unsubscribeCalendar(calendarId: string): Promise<void> {
    await this.call('calendarList.delete', () => this.o.api.calendarList.delete({ calendarId }), true, calendarId);
  }

  /** The id a calendarList write needs: Google refuses the `primary` keyword there ("Invalid resource id value"). */
  private async listEntryId(calendarId: string): Promise<string> {
    if (calendarId !== 'primary') return calendarId;
    return (await this.listCalendars()).find((c) => c.primary)?.owner ?? calendarId;
  }

  async setCalendarHidden(calendarId: string, hidden: boolean): Promise<void> {
    const id = await this.listEntryId(calendarId);
    await this.call('calendarList.patch', () => this.o.api.calendarList.patch({ calendarId: id, requestBody: { hidden } }), true, calendarId);
  }

  async setCalendarDefaultReminders(calendarId: string, reminders: GoogleReminder[]): Promise<void> {
    const id = await this.listEntryId(calendarId);
    await this.call('calendarList.patch', () => this.o.api.calendarList.patch({ calendarId: id, requestBody: { defaultReminders: reminders } }), true, calendarId);
  }

  async setCalendarColor(calendarId: string, color: { colorId: string } | { backgroundColor: string; foregroundColor: string }): Promise<void> {
    // a palette id is written as such; RGB needs colorRgbFormat (Google then picks the nearest colorId itself)
    const rgb = 'backgroundColor' in color;
    const id = await this.listEntryId(calendarId);
    await this.call('calendarList.patch', () => this.o.api.calendarList.patch({ calendarId: id, ...(rgb ? { colorRgbFormat: true } : {}), requestBody: color }), true, calendarId);
  }

  async calendarColors(): Promise<CalendarColor[]> {
    const res = await this.call('colors.get', () => this.o.api.colors.get());
    return Object.entries(res.data.calendar ?? {}).map(([id, c]) => ({ id, background: c.background!, foreground: c.foreground! }));
  }

  async listEvents(p: ListEventsParams): Promise<ListEventsResult> {
    const key = `events|${p.calendarId}|${p.timeMin ?? ''}|${p.timeMax ?? ''}|${p.showDeleted ? 1 : 0}|${p.singleEvents === false ? 0 : 1}|${(p.privateExtendedProperty ?? []).join('&')}|${(p.eventTypes ?? []).join(',')}`;
    return this.guard.cached(key, () => this.fetchEvents(p));
  }

  private async fetchEvents(p: ListEventsParams): Promise<ListEventsResult> {
    const items: GoogleEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    do {
      const res = await this.call('events.list', () =>
        this.o.api.events.list({
          calendarId: p.calendarId, timeMin: p.timeMin, timeMax: p.timeMax, singleEvents: p.singleEvents ?? true, showDeleted: p.showDeleted ?? false,
          privateExtendedProperty: p.privateExtendedProperty, eventTypes: p.eventTypes, maxResults: 2500, pageToken,
        }),
        false, p.calendarId, p.background,
      );
      for (const e of res.data.items ?? []) items.push(fromApi(e, p.calendarId));
      pageToken = res.data.nextPageToken ?? undefined;
      nextSyncToken = res.data.nextSyncToken ?? undefined;
    } while (pageToken && items.length < MAX_ITEMS);
    // a read that stops early must fail, not pass as the whole answer
    if (pageToken) throw new ProviderError('Too many events in one read');
    return { items, nextSyncToken };
  }

  async getEvent(calendarId: string, eventId: string): Promise<GoogleEvent> {
    const res = await this.call('events.get', () => this.o.api.events.get({ calendarId, eventId }), false, calendarId);
    return fromApi(res.data, calendarId);
  }

  async insertEvent(calendarId: string, ev: GoogleEventInput): Promise<GoogleEvent> {
    const res = await this.call('events.insert', () => this.o.api.events.insert({ calendarId, requestBody: toApi(ev) }), true, calendarId);
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
      true, calendarId,
    );
    return fromApi(res.data, calendarId);
  }

  async deleteEvent(calendarId: string, eventId: string, o?: WriteOptions): Promise<void> {
    await this.call('events.delete', () => this.o.api.events.delete({ calendarId, eventId }, o?.ifMatch ? { headers: { 'If-Match': o.ifMatch } } : undefined), true, calendarId);
  }

  async moveEvent(calendarId: string, eventId: string, destinationCalendarId: string): Promise<GoogleEvent> {
    const res = await this.call('events.move', () => this.o.api.events.move({ calendarId, eventId, destination: destinationCalendarId }), true, calendarId);
    return fromApi(res.data, destinationCalendarId);
  }

  async listChanges(calendarId: string, syncToken: string): Promise<ListEventsResult> {
    const items: GoogleEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    // every page repeats the same token and the parameters of the initial read (Google "Synchronize resources efficiently")
    do {
      const res = await this.call('events.list', async () => {
        try {
          return await this.o.api.events.list({ calendarId, syncToken, singleEvents: false, showDeleted: true, maxResults: 2500, pageToken });
        } catch (e) {
          if (Number((e as { response?: { status?: number }; status?: number }).response?.status ?? (e as { status?: number }).status) === 410) throw new SyncTokenExpiredError('Sync token expired', { cause: e });
          throw e;
        }
      }, false, calendarId);
      for (const e of res.data.items ?? []) items.push(fromApi(e, calendarId));
      pageToken = res.data.nextPageToken ?? undefined;
      nextSyncToken = res.data.nextSyncToken ?? undefined;
    } while (pageToken && items.length < MAX_ITEMS);
    // a stream we could not read to its end gives no new token: keeping the old one would repeat this forever, so list again in full
    if (pageToken || !nextSyncToken) throw new SyncTokenExpiredError('Change stream too large or without a new token');
    return { items, nextSyncToken };
  }

  async listSyncToken(calendarId: string): Promise<string | undefined> {
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    let pages = 0;
    do {
      const res = await this.call('events.list', () => this.o.api.events.list({ calendarId, singleEvents: false, showDeleted: true, maxResults: 2500, pageToken }), false, calendarId);
      pageToken = res.data.nextPageToken ?? undefined;
      nextSyncToken = res.data.nextSyncToken ?? undefined;
      pages++;
    } while (pageToken && pages < MAX_TOKEN_PAGES);
    if (pageToken) throw new SyncTokenTooLargeError('Calendar too large to walk for a sync token');
    return nextSyncToken;
  }

  async listContacts(syncToken?: string): Promise<ContactsResult> {
    const people = this.o.people;
    if (!people) throw new ProviderError('No People API client');
    const items: GoogleContact[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    let pages = 0;
    // every page repeats the parameters of the first call, the sync token included (People API `connections.list`)
    do {
      const res = await this.call('people.connections.list', async () => {
        try {
          return await people.people.connections.list({
            resourceName: 'people/me', personFields: 'names,birthdays,events', pageSize: 1000, requestSyncToken: true, ...(syncToken ? { syncToken } : {}), pageToken,
          });
        } catch (e) {
          if (isExpiredContactsToken(e)) throw new SyncTokenExpiredError('Contacts sync token expired', { cause: e });
          throw e;
        }
      });
      for (const p of res.data.connections ?? []) items.push(fromPerson(p));
      pageToken = res.data.nextPageToken ?? undefined;
      nextSyncToken = res.data.nextSyncToken ?? undefined;
      pages++;
    } while (pageToken && pages < MAX_CONTACT_PAGES);
    if (pageToken || !nextSyncToken) throw new ProviderError('Contacts too many to read');
    return { items, nextSyncToken };
  }

  async listInstances(calendarId: string, seriesId: string, timeMin: string, timeMax: string): Promise<GoogleEvent[]> {
    const items: GoogleEvent[] = [];
    let pageToken: string | undefined;
    let pages = 0;
    do {
      const res = await this.call('events.instances', () => this.o.api.events.instances({ calendarId, eventId: seriesId, timeMin, timeMax, maxResults: 2500, pageToken }), false, calendarId);
      for (const e of res.data.items ?? []) items.push(fromApi(e, calendarId));
      pageToken = res.data.nextPageToken ?? undefined;
      pages++;
    } while (pageToken && pages < MAX_INSTANCE_PAGES);
    // a partial series must never pass as complete
    if (pageToken) throw new ProviderError('Too many instances of one repeating event');
    return items.filter((e) => e.status !== 'cancelled');
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
  if (e.originalStartTime) ev.originalStartTime = dt(e.originalStartTime);
  if (e.eventType) ev.eventType = e.eventType;
  if (e.visibility) ev.visibility = e.visibility;
  if (e.transparency) ev.transparency = e.transparency;
  if (e.organizer) ev.organizer = { ...(e.organizer.email ? { email: e.organizer.email } : {}), ...(e.organizer.displayName ? { displayName: e.organizer.displayName } : {}), ...(e.organizer.self ? { self: true } : {}) };
  if (e.guestsCanModify) ev.guestsCanModify = true;
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
  const { recurringEventId: _r, originalStartTime: _o, ...rest } = x as Record<string, unknown>;
  return structuredClone(rest) as calendar_v3.Schema$Event;
}

/** Builds the Google Calendar API client for an OAuth client. */
export function makeApi(auth: OAuth2Client, fetchImplementation?: typeof fetch): Api {
  return makeCalendar({ version: 'v3', auth, timeout: GOOGLE_TIMEOUT_MS, ...(fetchImplementation ? { fetchImplementation } : {}) } as Parameters<typeof makeCalendar>[0]);
}

/** Builds one person's provider for PROVIDER=google; fails fast when the OAuth client is not configured. */
export function createGoogleProvider(config: AppConfig, sub: string, fetchImplementation?: typeof fetch): GoogleProvider {
  const g = config.google;
  if (!g.clientId || !g.clientSecret) throw new Error('PROVIDER=google requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  const auth: OAuth2Client = getUserClient(config, sub);
  return new GoogleProvider({
    sub,
    api: makeApi(auth, fetchImplementation),
    people: makePeople({ version: 'v1', auth, timeout: GOOGLE_TIMEOUT_MS, ...(fetchImplementation ? { fetchImplementation } : {}) } as Parameters<typeof makePeople>[0]),
    ready: () => {
      if (!hasUserToken(config, sub) && !auth.credentials.refresh_token && !auth.credentials.access_token) {
        throw new ReauthRequiredError('No Google access stored for this person');
      }
      if (calendarScopeMissing(config, sub)) throw new CalendarPermissionMissingError('Calendar scope not granted');
    },
  });
}
