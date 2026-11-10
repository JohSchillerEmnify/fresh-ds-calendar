import { OAuth2Client } from 'google-auth-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarProvider, ProviderCalendar } from '../src/providers/CalendarProvider.js';
import { GoogleProvider, makeApi } from '../src/providers/google/GoogleProvider.js';
import { forgetCalendarShape, logCalendarShape } from '../src/services/calendarShape.js';

const cals: ProviderCalendar[] = [
  { id: 'primary', summary: 'Me', backgroundColor: '#000', primary: true, accessRole: 'owner' },
  { id: 'work', summary: 'Work', backgroundColor: '#000', primary: false, accessRole: 'owner' },
];
beforeEach(() => forgetCalendarShape());

describe('daily calendar check', () => {
  it('reads only the next year, not the whole history', async () => {
    const listEvents = vi.fn(async () => ({ items: [] }));
    await logCalendarShape({ listEvents } as unknown as CalendarProvider, 'person', '2026-10-12', cals, () => true);
    expect(listEvents).toHaveBeenCalledTimes(2);
    for (const [p] of listEvents.mock.calls as unknown as [{ timeMin?: string; timeMax?: string }][]) {
      expect(p.timeMin).toBe('2026-10-12T00:00:00Z');
      expect(p.timeMax).toBe('2027-10-13T00:00:00Z');
    }
  });

  it('a rate-limit answer to the check does not start a cooldown', async () => {
    const clock = 1_000_000;
    const calls: string[] = [];
    const fetchImpl = (async (input: Request | URL | string) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      calls.push(url.pathname);
      return new Response(JSON.stringify({ error: { code: 403, errors: [{ reason: 'rateLimitExceeded' }], status: 'PERMISSION_DENIED' } }), { status: 403, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const auth = new OAuth2Client({ clientId: 'id', clientSecret: 'secret' });
    auth.setCredentials({ access_token: 'tok', expiry_date: Date.now() + 3_600_000 });
    const provider = new GoogleProvider({ api: makeApi(auth, fetchImpl), sub: 'person', guard: { now: () => clock } });
    await logCalendarShape(provider, 'person', '2026-10-12', cals, () => true);
    expect(provider.cooldownMs()).toBe(0);
    // the check stops at the first rate-limit answer
    expect(calls).toHaveLength(1);
    // a normal read is still answered by Google, not refused
    await provider.listEvents({ calendarId: 'primary', timeMin: 'a', timeMax: 'b' }).catch(() => undefined);
    expect(calls).toHaveLength(2);
  });
});
