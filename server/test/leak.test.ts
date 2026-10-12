import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeApp, type TestApp } from './helpers.js';

const gc = (globalThis as { gc?: () => void }).gc;
const heap = () => { gc!(); gc!(); return process.memoryUsage().heapUsed; };

describe('soak: 5000 in-process requests', () => {
  let t: TestApp;
  beforeAll(() => { t = makeApp(); });
  afterAll(() => t.cleanup());

  it('runs with --expose-gc', () => { expect(typeof gc).toBe('function'); });

  it('heap growth stays bounded', async () => {
    await t.req('POST', '/api/__test/reset', { fixture: { tasklists: [{ title: 'Soak', date: '2026-10-12', items: [{ title: 'a' }, { title: 'b' }] }] } });
    await t.req('POST', '/api/__test/clock', { now: '2026-10-12T08:00:00+02:00' });
    const ev = await (await t.req('POST', '/api/events', { title: 'e', allDay: false, start: '2026-10-12T09:00:00+02:00', end: '2026-10-12T10:00:00+02:00' })).json();
    const list = (await (await t.req('GET', '/api/items?from=2026-10-12&to=2026-10-13')).json()).items.find((i: any) => i.kind === 'tasklist');
    const itemId = list.items[0].id;
    const run = async (n: number) => {
      for (let i = 0; i < n; i++) {
        switch (i % 10) {
          case 0: await t.req('GET', '/api/items?from=2026-10-01&to=2026-11-01'); break;
          case 1: await t.req('GET', '/api/health'); break;
          case 2: await t.req('GET', '/api/config'); break;
          case 3: await t.req('GET', '/api/motivation'); break;
          case 4: await t.req('PATCH', `/api/tasklists/${list.id}/items/${itemId}`, { done: i % 20 === 4 }); break;
          case 5: await t.req('GET', '/api/summary?from=2026-10-01&to=2026-12-01'); break;
          case 6: await t.req('GET', `/api/events/${ev.id}`); break;
          case 7: await t.req('POST', '/api/streak/checkin'); break;
          case 8: await t.req('GET', '/api/tasklists/open?today=2026-10-12'); break;
          default: await t.req('POST', '/api/events', { title: '' }); // validation errors must not leak either
        }
      }
    };
    await run(1000); // warm-up (JIT, caches)
    const before = heap();
    await run(5000);
    const after = heap();
    const growthMb = (after - before) / 1024 / 1024;
    console.log(`heap growth over 5000 requests: ${growthMb.toFixed(2)} MB`);
    expect(growthMb).toBeLessThan(10);
  });
});
