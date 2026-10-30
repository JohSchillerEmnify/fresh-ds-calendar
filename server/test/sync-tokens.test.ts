import { OAuth2Client } from 'google-auth-library';
import { describe, expect, it } from 'vitest';
import { Clock } from '../src/lib/clock.js';
import { SyncTokenExpiredError } from '../src/providers/CalendarProvider.js';
import { GoogleProvider, makeApi } from '../src/providers/google/GoogleProvider.js';
import { MockGoogleProvider } from '../src/providers/mock/MockGoogleProvider.js';

const day = (d: string, n = 1) => ({ start: { date: d }, end: { date: `2026-10-${String(Number(d.slice(8)) + n).padStart(2, '0')}` } });
const mock = () => new MockGoogleProvider({ dataDir: null, tz: 'Europe/Berlin', clock: new Clock() });

describe('MockGoogleProvider sync tokens', () => {
  it('hands out a token on a list read and answers only what changed since it', async () => {
    const m = mock();
    const a = m.remote.insert('primary', { summary: 'A', ...day('2026-10-12') });
    const first = await m.listEvents({ calendarId: 'primary', singleEvents: false, showDeleted: true });
    expect(first.items.map((e) => e.id)).toEqual([a.id]);
    const none = await m.listChanges('primary', first.nextSyncToken!);
    expect(none.items).toEqual([]);
    const b = m.remote.insert('primary', { summary: 'B', ...day('2026-10-13') });
    m.remote.patch('primary', a.id, { summary: 'A2' });
    const r = await m.listChanges('primary', first.nextSyncToken!);
    expect(r.items.map((e) => e.id).sort()).toEqual([a.id, b.id].sort());
    expect((await m.listChanges('primary', r.nextSyncToken!)).items).toEqual([]);
  });

  it('reports a deletion as a cancelled entry and keeps calendars apart', async () => {
    const m = mock();
    const a = m.remote.insert('primary', { summary: 'A', ...day('2026-10-12') });
    m.remote.insert('work', { summary: 'W', ...day('2026-10-12') });
    const { nextSyncToken } = await m.listEvents({ calendarId: 'primary', singleEvents: false });
    m.remote.delete('primary', a.id);
    const r = await m.listChanges('primary', nextSyncToken!);
    expect(r.items.map((e) => [e.id, e.status])).toEqual([[a.id, 'cancelled']]);
  });

  it('reports a moved event as cancelled in the old calendar and changed in the new one', async () => {
    const m = mock();
    const a = m.remote.insert('primary', { summary: 'A', ...day('2026-10-12') });
    const t1 = (await m.listEvents({ calendarId: 'primary' })).nextSyncToken!;
    const t2 = (await m.listEvents({ calendarId: 'work' })).nextSyncToken!;
    await m.moveEvent('primary', a.id, 'work');
    expect((await m.listChanges('primary', t1)).items.map((e) => [e.id, e.status])).toEqual([[a.id, 'cancelled']]);
    expect((await m.listChanges('work', t2)).items.map((e) => [e.id, e.status])).toEqual([[a.id, 'confirmed']]);
  });

  it('answers 410 for an expired or unknown token', async () => {
    const m = mock();
    const { nextSyncToken } = await m.listEvents({ calendarId: 'primary' });
    m.expireSyncTokens();
    await expect(m.listChanges('primary', nextSyncToken!)).rejects.toBeInstanceOf(SyncTokenExpiredError);
    await expect(m.listChanges('primary', 'garbage')).rejects.toBeInstanceOf(SyncTokenExpiredError);
    const fresh = (await m.listEvents({ calendarId: 'primary' })).nextSyncToken!;
    await expect(m.listChanges('primary', fresh)).resolves.toMatchObject({ items: [] });
  });

  it('lists the instances of one series in a window, exceptions applied, and none for a missing series', async () => {
    const m = mock();
    const s = m.remote.insert('primary', { summary: 'Weekly', ...day('2026-10-05'), recurrence: ['RRULE:FREQ=WEEKLY'] });
    const other = m.remote.insert('primary', { summary: 'Other', ...day('2026-10-06'), recurrence: ['RRULE:FREQ=WEEKLY'] });
    await m.patchEvent('primary', `${s.id}_20261012`, { summary: 'Moved' });
    await m.deleteEvent('primary', `${s.id}_20261019`);
    const r = await m.listInstances('primary', s.id, '2026-10-01T00:00:00+02:00', '2026-10-27T00:00:00+01:00');
    expect(r.map((e) => [e.id, e.summary])).toEqual(expect.arrayContaining([[`${s.id}_20261005`, 'Weekly'], [`${s.id}_20261012`, 'Moved'], [`${s.id}_20261026`, 'Weekly']]));
    expect(r.some((e) => e.id === `${s.id}_20261019` || e.recurringEventId === other.id)).toBe(false);
    expect(await m.listInstances('primary', 'nope', '2026-10-01T00:00:00+02:00', '2026-10-27T00:00:00+01:00')).toEqual([]);
  });
});

interface Call { url: URL }
function google(handler: (c: Call) => { status?: number; json?: unknown }) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: any, init?: any) => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input?.url ?? input));
    void init;
    calls.push({ url });
    const r = handler({ url });
    return new Response(r.json === undefined ? null : JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const auth = new OAuth2Client({ clientId: 'id', clientSecret: 'secret' });
  auth.setCredentials({ access_token: 'tok', expiry_date: Date.now() + 3_600_000 });
  return { provider: new GoogleProvider({ api: makeApi(auth, fetchImpl) }), calls };
}
const gev = (o: object = {}) => ({ id: 'e1', etag: '"e"', status: 'confirmed', start: { date: '2026-10-12' }, end: { date: '2026-10-13' }, created: '2026-10-01T00:00:00Z', updated: '2026-10-01T00:00:00Z', ...o });

describe('GoogleProvider sync tokens (mocked HTTP)', () => {
  it('follows every page with the same token and the initial parameters, and returns the last page\'s next token', async () => {
    const { provider, calls } = google((c) => (c.url.searchParams.get('pageToken')
      ? { json: { items: [gev({ id: 'e2', status: 'cancelled' })], nextSyncToken: 'T2' } }
      : { json: { items: [gev()], nextPageToken: 'P2' } }));
    const r = await provider.listChanges('primary', 'T1');
    expect(r.items.map((e) => [e.id, e.status])).toEqual([['e1', 'confirmed'], ['e2', 'cancelled']]);
    expect(r.nextSyncToken).toBe('T2');
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.url.searchParams.get('syncToken')).toBe('T1');
      expect(c.url.searchParams.get('singleEvents')).toBe('false');
      expect(c.url.searchParams.get('showDeleted')).toBe('true');
      for (const banned of ['timeMin', 'timeMax', 'privateExtendedProperty', 'q', 'updatedMin', 'orderBy']) expect(c.url.searchParams.has(banned)).toBe(false);
    }
    expect(calls[1]!.url.searchParams.get('pageToken')).toBe('P2');
  });

  it('turns a 410 into SyncTokenExpiredError', async () => {
    const { provider } = google(() => ({ status: 410, json: { error: { code: 410, message: 'Sync token is no longer valid, a full sync is required.', errors: [{ reason: 'fullSyncRequired' }] } } }));
    await expect(provider.listChanges('primary', 'old')).rejects.toBeInstanceOf(SyncTokenExpiredError);
  });

  it('lists the instances of a series over events.instances and drops cancelled ones', async () => {
    const { provider, calls } = google(() => ({ json: { items: [gev({ id: 'm_1', recurringEventId: 'm' }), gev({ id: 'm_2', recurringEventId: 'm', status: 'cancelled' })] } }));
    const r = await provider.listInstances('primary', 'm', '2026-10-01T00:00:00+02:00', '2026-11-01T00:00:00+01:00');
    expect(r.map((e) => e.id)).toEqual(['m_1']);
    expect(calls[0]!.url.pathname).toBe('/calendar/v3/calendars/primary/events/m/instances');
    expect(calls[0]!.url.searchParams.get('timeMin')).toBe('2026-10-01T00:00:00+02:00');
  });
});
