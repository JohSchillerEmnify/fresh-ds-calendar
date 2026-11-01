import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError, setApi } from '@/api/client';
import {
  clearDeviceLog, DEVICE_LOG_KEY, deviceLog, exportDeviceLog, installDeviceLog, logDevice, MAX_ENTRIES, reloadDeviceLog, routeOf, scrub, shareDeviceLog,
} from '@/lib/deviceLog';

describe('device log redaction', () => {
  it('replaces every id in an API route by :id and drops the query', () => {
    expect(routeOf('/api/events/abc123def')).toBe('/api/events/:id');
    expect(routeOf('/api/tasklists/shared%3Axy/items/i-9/ink?scope=following')).toBe('/api/tasklists/:id/items/:id/ink');
    expect(routeOf('/api/items?from=2026-10-12&to=2026-10-18')).toBe('/api/items');
    expect(routeOf('/api/tasklists/all-open?today=2026-10-12')).toBe('/api/tasklists/all-open');
    expect(routeOf('/api/categories/Dentist/share')).toBe('/api/categories/:id/share');
  });

  it('removes e-mail addresses, tokens, host names and quoted text', () => {
    expect(scrub('signed in as anna@example.test')).toBe('signed in as <email>');
    expect(scrub('Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123456')).not.toContain('eyJ');
    expect(scrub('at https://cal.example.org/api/events/abc123?x=1')).toBe('at /api/events/:id');
    expect(scrub('at https://cal.example.org/assets/index-Ab12.js:3:9')).toBe('at /assets/index-Ab12.js:3:9');
    expect(scrub('Unexpected token, "Dentist Meyer" is not valid JSON')).toBe('Unexpected token, "…" is not valid JSON');
    expect(scrub("cannot read 'Dentist'")).toBe("cannot read '…'");
  });

  it('keeps the code path a browser names in its message', () => {
    expect(scrub("undefined is not an object (evaluating 'e.change.id')")).toBe("undefined is not an object (evaluating 'e.change.id')");
  });

  it('cuts very long text', () => {
    expect(scrub('x '.repeat(1000)).length).toBeLessThanOrEqual(300);
  });
});

describe('device log', () => {
  beforeEach(() => { localStorage.clear(); clearDeviceLog(); });

  it('keeps the newest entries, at most MAX_ENTRIES, and survives a reload', () => {
    for (let i = 0; i < MAX_ENTRIES + 3; i++) logDevice('error', { name: 'Error', message: `n${i}` });
    expect(deviceLog.value).toHaveLength(MAX_ENTRIES);
    expect(deviceLog.value[0]!.summary).toBe('Error: n3');
    reloadDeviceLog();
    expect(deviceLog.value).toHaveLength(MAX_ENTRIES);
    expect(JSON.parse(localStorage.getItem(DEVICE_LOG_KEY)!)).toHaveLength(MAX_ENTRIES);
  });

  it('stamps time, app version and platform, and scrubs every text field', () => {
    logDevice('error', { name: 'TypeError', message: 'mail anna@example.test' });
    const e = deviceLog.value[0]!;
    expect(e.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(e.app).toBeTypeOf('string');
    expect(['ios', 'android', 'desktop']).toContain(e.platform);
    expect(e.standalone).toBeTypeOf('boolean');
    expect(JSON.stringify(e)).not.toContain('anna@');
  });

  it('keeps the steps of the delete trace on the device too', async () => {
    const { trace } = await import('@/lib/trace');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    trace('menu.choose', 'delete');
    vi.unstubAllGlobals();
    expect(deviceLog.value.at(-1)).toMatchObject({ kind: 'trace', summary: 'menu.choose delete' });
  });

  it('exports the log as JSON with its entries', () => {
    logDevice('error', { name: 'Error', message: 'one' });
    expect(JSON.parse(exportDeviceLog()).entries).toHaveLength(1);
  });

  it('catches uncaught errors and unhandled rejections', () => {
    const target = new EventTarget();
    const stop = installDeviceLog(target);
    target.dispatchEvent(Object.assign(new Event('error'), { error: new TypeError('boom'), message: 'Uncaught TypeError: boom' }));
    target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new RangeError('bad range') }));
    stop();
    target.dispatchEvent(Object.assign(new Event('error'), { error: new Error('after stop') }));
    expect(deviceLog.value.map((e) => e.summary)).toEqual(['TypeError: boom', 'unhandled RangeError: bad range']);
  });

  describe('share', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('shares a file where the device can', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
      expect(await shareDeviceLog()).toBe('shared');
      expect((share.mock.calls[0]![0] as { files: File[] }).files[0]!.name).toMatch(/^calendar-error-log.*\.json$/);
    });

    it('downloads where the device cannot share files', async () => {
      vi.stubGlobal('navigator', { ...navigator, share: undefined, canShare: undefined });
      URL.createObjectURL = vi.fn(() => 'blob:x');
      URL.revokeObjectURL = vi.fn();
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      expect(await shareDeviceLog()).toBe('downloaded');
      expect(click).toHaveBeenCalled();
    });
  });
});

describe('what the API client saw', () => {
  beforeEach(() => { localStorage.clear(); clearDeviceLog(); });
  afterEach(() => setApi(new ApiClient()));

  it('logs status, headers that matter, an empty body and the code of a failed request, no body', async () => {
    const res = new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Title "Dentist" too long' } }), { status: 400, headers: { 'Content-Type': 'application/json', 'Content-Length': '70' } });
    const client = new ApiClient({ fetch: async () => res });
    await expect(client.deleteEvent('ev-secret-id')).rejects.toBeInstanceOf(ApiError);
    const e = deviceLog.value[0]!;
    expect(e.summary).toBe('DELETE /api/events/:id 400 VALIDATION_ERROR');
    expect(e.data).toMatchObject({ method: 'DELETE', route: '/api/events/:id', status: 400, code: 'VALIDATION_ERROR', contentType: 'application/json', contentLength: '70', bodyEmpty: false });
    expect(JSON.stringify(e)).not.toContain('Dentist');
    expect(JSON.stringify(e)).not.toContain('ev-secret-id');
  });

  it('logs the thrown error of a request that never got an answer', async () => {
    const client = new ApiClient({ fetch: async () => { throw new TypeError('Load failed'); } });
    await expect(client.deleteEvent('x')).rejects.toBeInstanceOf(ApiError);
    expect(deviceLog.value[0]!.data).toMatchObject({ method: 'DELETE', route: '/api/events/:id', status: 0, code: 'NETWORK', errorName: 'TypeError', errorMessage: 'Load failed' });
  });

  it('logs a body that could not be read and passes the error on', async () => {
    const res = new Response(null, { status: 200 });
    vi.spyOn(res, 'text').mockRejectedValue(new TypeError('Body stream lost'));
    const client = new ApiClient({ fetch: async () => res });
    await expect(client.getEvent('x')).rejects.toThrow('Body stream lost');
    expect(deviceLog.value[0]!.data).toMatchObject({ status: 200, errorName: 'TypeError', errorMessage: 'Body stream lost' });
  });

  it('does not log a successful request', async () => {
    const client = new ApiClient({ fetch: async () => new Response(null, { status: 204 }) });
    await client.deleteEvent('x');
    expect(deviceLog.value).toHaveLength(0);
  });

  it('attaches what it saw to the ApiError, for the outbox entry', async () => {
    const client = new ApiClient({ fetch: async () => new Response('', { status: 403 }) });
    const err = await client.deleteEvent('x').catch((e: ApiError) => e);
    expect((err as ApiError).seen).toMatchObject({ method: 'DELETE', route: '/api/events/:id', status: 403, bodyEmpty: true });
  });
});
