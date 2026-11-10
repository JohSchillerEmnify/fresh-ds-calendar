import { describe, expect, it } from 'vitest';
import { ApiClient, ApiError } from '@/api/client';
import { nearestGoogleColorId } from '@/api/colors';
import { apiError, mockFetch } from './helpers';

describe('ApiClient', () => {
  it('sends If-Match and JSON bodies, encodes ids', async () => {
    const { calls } = mockFetch({ 'PATCH /api/events/a%2Fb': () => ({ id: 'a/b' }) });
    const { api } = await import('@/api/client');
    await api.updateEvent('a/b', { title: 'X' }, { ifMatch: 'etag-1' });
    expect(calls[0].headers['If-Match']).toBe('etag-1');
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(calls[0].body).toEqual({ title: 'X' });
  });
  it('maps 412 / 400 / 503 to ApiError with user messages', async () => {
    mockFetch({
      'PATCH /api/events/1': () => apiError(412, 'PRECONDITION_FAILED'),
      'POST /api/events': () => apiError(400, 'VALIDATION_ERROR', 'Title is required'),
      'GET /api/items': () => apiError(503, 'PROVIDER_UNAVAILABLE'),
    });
    const { api } = await import('@/api/client');
    const c = await api.updateEvent('1', {}).catch((e) => e);
    expect(c).toBeInstanceOf(ApiError);
    expect(c.isConflict).toBe(true);
    expect(c.userMessage).toBe('This event was changed elsewhere. Reload it and try again.');
    const v = await api.createEvent({ title: '', allDay: false, start: 'a', end: 'b' }).catch((e) => e);
    expect(v.isValidation && v.userMessage).toBe('Title is required');
    const u = await api.items('2026-10-01', '2026-10-02').catch((e) => e);
    expect(u.isUnavailable && u.userMessage).toBe('Could not save: Google Calendar is unavailable');
  });
  it('says the calendar server cannot be reached when saving fails without an answer', async () => {
    const down = new ApiClient({ fetch: (async () => { throw new TypeError('x'); }) as unknown as typeof fetch });
    const e = await down.updateEvent('1', {}).catch((x) => x);
    expect(e.userMessage).toBe("Could not save: the calendar server can't be reached");
    expect(e.userMessage).not.toContain('Google');
    const proxy = new ApiClient({ fetch: (async () => new Response('', { status: 502 })) as unknown as typeof fetch });
    expect((await proxy.updateEvent('1', {}).catch((x) => x)).userMessage).toBe("Could not save: the calendar server can't be reached");
  });
  it('turns network failures into NETWORK errors and handles 204', async () => {
    const c = new ApiClient({ fetch: (async () => { throw new TypeError('x'); }) as unknown as typeof fetch });
    const e = await c.health().catch((x) => x);
    expect(e.code).toBe('NETWORK');
    expect(e.isUnavailable).toBe(true);
    const ok = new ApiClient({ fetch: (async () => new Response(null, { status: 204 })) as unknown as typeof fetch });
    expect(await ok.deleteEvent('1')).toBeUndefined();
  });
  it('notifies listeners on X-Motivation-Changed', async () => {
    let n = 0;
    const c = new ApiClient({ fetch: (async () => new Response('{}', { status: 201, headers: { 'X-Motivation-Changed': '1' } })) as unknown as typeof fetch });
    c.onMotivationChanged(() => n++);
    await c.createEvent({ title: 'a', allDay: false, start: 'a', end: 'b' });
    expect(n).toBe(1);
  });
  it('nearest Google color ids', () => {
    expect(nearestGoogleColorId('#0a7f42')).toBe('10');
    expect(nearestGoogleColorId('#ff9800')).toBe('5');
  });
});
