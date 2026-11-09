import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { hasPlan, planOff } from '../src/lib/planEdges.js';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

// Fri 17:00 -> Sun 16:00 every week; 2026-11-06 is a Friday (Berlin is UTC+1 then)
const weekend = { windows: [{ from: { day: 5, time: '17:00' }, to: { day: 0, time: '16:00' } }] };
const at = (wall: string) => `${wall}:00+01:00`;

/** Creates the Work calendar with one event on Monday 2026-11-09 and returns its id. */
async function workCalendar(): Promise<string> {
  const cal = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Work' })).body;
  await t.json('POST', '/api/events', { allDay: false, start: '2026-11-09T09:00:00+01:00', end: '2026-11-09T09:30:00+01:00', title: 'Work thing', calendarId: cal.id });
  return cal.id;
}
const isHidden = async (id: string) => (await t.json('GET', '/api/calendars')).body.calendars.find((c: { id: string }) => c.id === id).hidden as boolean;
const widgetTitles = async () => ((await t.json('GET', '/api/items?from=2026-11-09&to=2026-11-16&excludeHidden=1')).body.items as { title: string }[]).map((i) => i.title);
const setPlan = (id: string, plan: object) => t.json('PATCH', '/api/prefs', { calendarPlans: { [id]: plan } });
const setClock = (wall: string) => freeze(t, at(wall));

describe('calendar plan rule', () => {
  it('is off inside the weekly window, on outside it, also across the week end', () => {
    expect(planOff(weekend, '2026-11-06T16:59')).toBe(false);
    expect(planOff(weekend, '2026-11-06T17:00')).toBe(true);
    expect(planOff(weekend, '2026-11-08T15:59')).toBe(true);
    expect(planOff(weekend, '2026-11-08T16:00')).toBe(false);
  });

  it('handles a window inside one day and Mon-Fri as Sat 00:00 to Mon 00:00', () => {
    const wed = { windows: [{ from: { day: 3, time: '08:00' }, to: { day: 3, time: '20:00' } }] };
    expect(planOff(wed, '2026-11-04T08:00')).toBe(true);
    expect(planOff(wed, '2026-11-04T20:00')).toBe(false);
    const weekdays = { windows: [{ from: { day: 6, time: '00:00' }, to: { day: 1, time: '00:00' } }] };
    expect(planOff(weekdays, '2026-11-08T23:59')).toBe(true);
    expect(planOff(weekdays, '2026-11-09T00:00')).toBe(false);
  });

  it('is off for a while from when it was set until 00:00 of the day it is back, and when either part says so', () => {
    const p = { until: '2026-11-06', since: '2026-11-04T08:00' };
    expect(planOff(p, '2026-11-04T08:00')).toBe(true);
    expect(planOff(p, '2026-11-06T00:00')).toBe(false);
    expect(planOff({ ...weekend, until: '2026-11-10', since: '2026-11-07T10:00' }, '2026-11-08T17:00')).toBe(true);
    expect(hasPlan({})).toBe(false);
  });
});

describe('calendar plan scheduler (feature calendar-off-plan)', () => {
  it('sets hidden at the window start and clears it at the window end', async () => {
    const id = await workCalendar();
    await setClock('2026-11-06T16:59');
    await setPlan(id, weekend);
    expect(await isHidden(id)).toBe(false);
    await setClock('2026-11-06T17:00');
    expect(await isHidden(id)).toBe(true);
    await setClock('2026-11-08T16:00');
    expect(await isHidden(id)).toBe(false);
  });

  it('the widget fetch leaves the calendar out while its plan has it off, and has it back after', async () => {
    const id = await workCalendar();
    await setClock('2026-11-06T10:00');
    await setPlan(id, weekend);
    expect(await widgetTitles()).toEqual(['Work thing']);
    await setClock('2026-11-07T10:00');
    expect(await widgetTitles()).toEqual([]);
    await setClock('2026-11-09T10:00');
    expect(await widgetTitles()).toEqual(['Work thing']);
  });

  it('off until a day hides now and shows again at 00:00 of that day', async () => {
    const id = await workCalendar();
    await setClock('2026-11-09T10:00');
    await setPlan(id, { until: '2026-11-12', since: '2026-11-09T10:00' });
    expect(await isHidden(id)).toBe(true);
    expect(await widgetTitles()).toEqual([]);
    await setClock('2026-11-11T23:59');
    expect(await isHidden(id)).toBe(true);
    await setClock('2026-11-12T00:00');
    expect(await isHidden(id)).toBe(false);
  });

  it('a manual switch holds until the next edge, which sets the flag again', async () => {
    const id = await workCalendar();
    await setClock('2026-11-07T10:00');
    await setPlan(id, weekend);
    expect(await isHidden(id)).toBe(true);
    await t.json('PATCH', `/api/calendars/${id}`, { hidden: false });
    await setClock('2026-11-07T12:00');
    expect(await isHidden(id)).toBe(false);
    await setClock('2026-11-13T17:00');
    expect(await isHidden(id)).toBe(true);
  });

  it('a restart applies an edge that passed while the server was down, and keeps a tap made before', async () => {
    const id = await workCalendar();
    await setClock('2026-11-07T10:00');
    await setPlan(id, weekend);
    await t.json('PATCH', `/api/calendars/${id}`, { hidden: false });
    const boot = (nowMs: number) => {
      const app = buildApp({ ...loadConfig({ TEST_MODE: 'true', DATA_DIR: t.dir }), webDist: null });
      app.ctx.clock.set(nowMs);
      app.ctx.planScheduler.start();
      app.close();
      return app;
    };
    // same edge as before: the tap stays
    boot(Date.parse(at('2026-11-07T12:00')));
    expect(await isHidden(id)).toBe(false);
    // the window ended meanwhile, then the next one began
    boot(Date.parse(at('2026-11-13T18:00')));
    expect(await isHidden(id)).toBe(true);
  });

  it('a plan that is removed stops switching, and the calendar keeps its flag', async () => {
    const id = await workCalendar();
    await setClock('2026-11-07T10:00');
    await setPlan(id, weekend);
    await t.json('PATCH', '/api/prefs', { calendarPlans: {} });
    await setClock('2026-11-09T10:00');
    expect(await isHidden(id)).toBe(true);
  });
});
