import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { freeze, makeApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(() => { t = makeApp(); });
afterAll(() => t.cleanup());
beforeEach(async () => { await t.req('POST', '/api/__test/reset'); });

describe('prefs (Labs switches)', () => {
  it('defaults to Labs off with the approach track and Approaching card on, merges patches and survives a calendar visibility change', async () => {
    const rest = { labsViews: {}, stableViews: {}, tasksCalendarVisible: false, approachWindowHours: 3, approachingCard: true, taskCategories: true, supportCat: 'sometimes', versionInCorner: false, labsOwnThemes: false, leftHanded: false, showCarriedFrom: true, navPhone: 'bottom', navDesktop: 'rail', tasksGroupBy: 'time', tasksSortBy: 'date', tasksSortDir: 'default', undatedDone: 'calendar', taskOpen: 'inline', growSeveral: true, tasksFilter: { categories: [], when: 'all' }, language: 'auto', bedtime: { enabled: false, mode: 'fixed', bedtime: '23:00', wake: '07:00', weekendDifferent: false, weekendBedtime: '00:00', weekendWake: '09:00', sleepMinutes: 480, leadMinutes: 60, reminderMinutes: 30 }, notify: { bedtime: true, events: true, tasklists: false, morning: false, morningTime: '08:00' }, weekTwoRow: false, weekTwoRowTop: 4, labsHandwriting: false, minEventMinutes: 0, daySideBySide: 4, weekSideBySide: 2, streak: 'off', widgetCircle: 'time', androidWidgetStyle: 'agenda', androidWidgetDays: 3, widgetLayout: 'standard', widgetTimelineDays: 3, syncIndicator: false, headerLayout: 'auto', bottomBarSize: 'auto', approachTimeLeft: false, monthScroll: 'sideways', trayWidth: 380, calendarPlans: {}, contactsOfferDismissed: false };
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: false, approachBar: true, ...rest });
    expect((await t.json('PATCH', '/api/prefs', { labs: true })).body).toEqual({ labs: true, approachBar: true, ...rest });
    expect((await t.json('PATCH', '/api/prefs', { approachBar: false, approachWindowHours: 3 })).body).toEqual({ labs: true, approachBar: false, ...rest });
    const { body } = await t.json('GET', '/api/calendars');
    await t.json('PATCH', `/api/calendars/${body.calendars[0].id}`, { hidden: true });
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: true, approachBar: false, ...rest });
  });

  it('keeps the Labs view choices per id, merged, and refuses anything but ids mapped to booleans', async () => {
    expect((await t.json('GET', '/api/prefs')).body.labsViews).toEqual({});
    expect((await t.json('PATCH', '/api/prefs', { labsViews: { strip: true } })).body.labsViews).toEqual({ strip: true });
    expect((await t.json('PATCH', '/api/prefs', { labsViews: { clock: false } })).body.labsViews).toEqual({ strip: true, clock: false });
    for (const bad of [[], 'x', { clock: 'no' }, { 'Bad Id': true }, null]) expect((await t.json('PATCH', '/api/prefs', { labsViews: bad })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.labsViews).toEqual({ strip: true, clock: false });
  });

  it('switches the Approaching card off and back on with the test reset', async () => {
    expect((await t.json('PATCH', '/api/prefs', { approachingCard: false })).body.approachingCard).toBe(false);
    expect((await t.json('GET', '/api/prefs')).body.approachingCard).toBe(false);
    expect((await t.json('PATCH', '/api/prefs', { approachingCard: 'no' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { taskCategories: 'no' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { taskCategories: false })).body.taskCategories).toBe(false);
    expect((await t.json('GET', '/api/prefs')).body.taskCategories).toBe(false);
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ approachingCard: true, approachBar: true, taskCategories: true });
  });

  it('keeps the version-in-the-corner switch per person, off by default, boolean only', async () => {
    expect((await t.json('GET', '/api/prefs')).body.versionInCorner).toBe(false);
    expect((await t.json('PATCH', '/api/prefs', { versionInCorner: true })).body.versionInCorner).toBe(true);
    expect((await t.json('PATCH', '/api/prefs', { versionInCorner: 'yes' })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.labsOwnThemes).toBe(false);
    expect((await t.json('PATCH', '/api/prefs', { labsOwnThemes: true })).body.labsOwnThemes).toBe(true);
    expect((await t.json('PATCH', '/api/prefs', { labsOwnThemes: 1 })).status).toBe(400);
    await t.json('PATCH', '/api/prefs', { labsOwnThemes: false });
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.versionInCorner).toBe(false);
  });

  it('keeps the notification choices: all but the morning overview on by default, partial patches merge, bad values are refused', async () => {
    expect((await t.json('GET', '/api/prefs')).body.notify).toEqual({ bedtime: true, events: true, tasklists: false, morning: false, morningTime: '08:00' });
    expect((await t.json('PATCH', '/api/prefs', { notify: { events: false, morning: true, morningTime: '07:15' } })).body.notify)
      .toEqual({ bedtime: true, events: false, tasklists: false, morning: true, morningTime: '07:15' });
    expect((await t.json('PATCH', '/api/prefs', { notify: { morningTime: '7:15' } })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { notify: { events: 'no' } })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.notify.morningTime).toBe('07:15');
  });

  it('keeps the bedtime preference per person: off by default, partial patches merge, bad values are refused', async () => {
    const get = async () => (await t.json('GET', '/api/prefs')).body.bedtime;
    expect((await get()).enabled).toBe(false);
    expect((await t.json('PATCH', '/api/prefs', { bedtime: { enabled: true, mode: 'dynamic', sleepMinutes: 420 } })).body.bedtime).toMatchObject({ enabled: true, mode: 'dynamic', sleepMinutes: 420, bedtime: '23:00', reminderMinutes: 30 });
    expect((await t.json('PATCH', '/api/prefs', { bedtime: { bedtime: '22:15' } })).body.bedtime).toMatchObject({ enabled: true, mode: 'dynamic', bedtime: '22:15' });
    for (const bad of ['x', null, [], { enabled: 'yes' }, { mode: 'sometimes' }, { bedtime: '25:00' }, { wake: '7:00' }, { sleepMinutes: 5 }, { leadMinutes: 1.5 }, { reminderMinutes: 999 }]) {
      const r = await t.json('PATCH', '/api/prefs', { bedtime: bad });
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
    expect((await get()).bedtime).toBe('22:15');
    await t.req('POST', '/api/__test/reset');
    expect((await get()).enabled).toBe(false);
  });

  it('keeps the left-handed switch per person, off by default, boolean only', async () => {
    expect((await t.json('GET', '/api/prefs')).body.leftHanded).toBe(false);
    expect((await t.json('PATCH', '/api/prefs', { leftHanded: true })).body.leftHanded).toBe(true);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ leftHanded: true, versionInCorner: false });
    expect((await t.json('PATCH', '/api/prefs', { leftHanded: 'yes' })).status).toBe(400);
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.leftHanded).toBe(false);
  });

  it('keeps the Tasks view grouping and sorting per person, time and date by default, whitelisted', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ tasksGroupBy: 'time', tasksSortBy: 'date', tasksSortDir: 'default' });
    expect((await t.json('PATCH', '/api/prefs', { tasksGroupBy: 'category', tasksSortBy: 'progress' })).body).toMatchObject({ tasksGroupBy: 'category', tasksSortBy: 'progress' });
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ tasksGroupBy: 'category', tasksSortBy: 'progress' });
    expect((await t.json('PATCH', '/api/prefs', { tasksGroupBy: 'week' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { tasksSortBy: 'size' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { tasksSortDir: 'reversed' })).body.tasksSortDir).toBe('reversed');
    expect((await t.json('PATCH', '/api/prefs', { tasksSortDir: 'desc' })).status).toBe(400);
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ tasksGroupBy: 'time', tasksSortBy: 'date' });
  });

  it('keeps the approach window per person, 3 hours by default, any whole number from 1 to 24', async () => {
    expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: 6 })).body.approachWindowHours).toBe(6);
    expect((await t.json('GET', '/api/prefs')).body.approachWindowHours).toBe(6);
    expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: 5 })).body.approachWindowHours).toBe(5);
    expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: 1 })).body.approachWindowHours).toBe(1);
    expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: 24 })).body.approachWindowHours).toBe(24);
    for (const bad of [0, 25, 2.5, '6']) {
      expect((await t.json('PATCH', '/api/prefs', { approachWindowHours: bad })).status).toBe(400);
    }
    expect((await t.json('GET', '/api/prefs')).body.approachWindowHours).toBe(24);
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.approachWindowHours).toBe(3);
  });

  it('rejects non-boolean values and resets with the test reset', async () => {
    expect((await t.json('PATCH', '/api/prefs', { labs: 'yes' })).status).toBe(400);
    await t.json('PATCH', '/api/prefs', { labs: true });
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.labs).toBe(false);
  });

  it('shows where carried-over lists come from unless switched off', async () => {
    expect((await t.json('GET', '/api/prefs')).body.showCarriedFrom).toBe(true);
    expect((await t.json('PATCH', '/api/prefs', { showCarriedFrom: false })).body.showCarriedFrom).toBe(false);
    expect((await t.json('PATCH', '/api/prefs', { showCarriedFrom: 'no' })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.showCarriedFrom).toBe(false);
  });

  it('ignores the retired labsDrawWithFinger pref', async () => {
    const r = await t.json('PATCH', '/api/prefs', { labsDrawWithFinger: true });
    expect(r.status).toBe(200);
    expect(r.body).not.toHaveProperty('labsDrawWithFinger');
    expect((await t.json('GET', '/api/prefs')).body).not.toHaveProperty('labsDrawWithFinger');
  });

  it('keeps the support cat setting per person, independent of the theme', async () => {
    expect((await t.json('PATCH', '/api/prefs', { supportCat: 'always' })).body.supportCat).toBe('always');
    await t.json('PATCH', '/api/prefs/theme', { preset: 'Mordor', overrides: { glow: 'neon' } });
    expect((await t.json('GET', '/api/prefs')).body).toEqual({ labs: false, labsViews: {}, stableViews: {}, approachBar: true, approachWindowHours: 3, approachingCard: true, taskCategories: true, tasksCalendarVisible: false, supportCat: 'always', versionInCorner: false, labsOwnThemes: false, leftHanded: false, showCarriedFrom: true, navPhone: 'bottom', navDesktop: 'rail', tasksGroupBy: 'time', tasksSortBy: 'date', tasksSortDir: 'default', undatedDone: 'calendar', taskOpen: 'inline', growSeveral: true, tasksFilter: { categories: [], when: 'all' }, language: 'auto', bedtime: { enabled: false, mode: 'fixed', bedtime: '23:00', wake: '07:00', weekendDifferent: false, weekendBedtime: '00:00', weekendWake: '09:00', sleepMinutes: 480, leadMinutes: 60, reminderMinutes: 30 }, notify: { bedtime: true, events: true, tasklists: false, morning: false, morningTime: '08:00' }, weekTwoRow: false, weekTwoRowTop: 4, labsHandwriting: false, minEventMinutes: 0, daySideBySide: 4, weekSideBySide: 2, streak: 'off', widgetCircle: 'time', androidWidgetStyle: 'agenda', androidWidgetDays: 3, widgetLayout: 'standard', widgetTimelineDays: 3, syncIndicator: false, headerLayout: 'auto', bottomBarSize: 'auto', approachTimeLeft: false, monthScroll: 'sideways', trayWidth: 380, calendarPlans: {}, contactsOfferDismissed: false });
    expect((await t.json('PATCH', '/api/prefs', { supportCat: 'off' })).body.supportCat).toBe('off');
  });

  it('keeps stableViews per view id, merged, and refuses anything but ids mapped to booleans', async () => {
    expect((await t.json('GET', '/api/prefs')).body.stableViews).toEqual({});
    expect((await t.json('PATCH', '/api/prefs', { stableViews: { year: false } })).body.stableViews).toEqual({ year: false });
    expect((await t.json('PATCH', '/api/prefs', { stableViews: { 'clock-rings': false } })).body.stableViews).toEqual({ year: false, 'clock-rings': false });
    for (const bad of [[], 'x', { year: 'no' }, { 'Bad Id': true }, null]) expect((await t.json('PATCH', '/api/prefs', { stableViews: bad })).status).toBe(400);
  });

  it('keeps taskOpen, inline by default, only the known values', async () => {
    expect((await t.json('GET', '/api/prefs')).body.taskOpen).toBe('inline');
    expect((await t.json('PATCH', '/api/prefs', { taskOpen: 'drawer' })).body.taskOpen).toBe('drawer');
    expect((await t.json('PATCH', '/api/prefs', { taskOpen: 'sheet' })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.taskOpen).toBe('drawer');
  });
  it('keeps undatedDone, calendar by default, only the known values', async () => {
    expect((await t.json('GET', '/api/prefs')).body.undatedDone).toBe('calendar');
    expect((await t.json('PATCH', '/api/prefs', { undatedDone: 'archive' })).body.undatedDone).toBe('archive');
    expect((await t.json('PATCH', '/api/prefs', { undatedDone: 'trash' })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.undatedDone).toBe('archive');
  });

  it('keeps the bottom bar size per person: auto by default, then auto, expressive or compact only', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ bottomBarSize: 'auto' });
    expect((await t.json('PATCH', '/api/prefs', { bottomBarSize: 'compact' })).body).toMatchObject({ bottomBarSize: 'compact' });
    for (const bad of ['Compact', 'big', true, null, 1]) expect((await t.json('PATCH', '/api/prefs', { bottomBarSize: bad })).status, JSON.stringify(bad)).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ bottomBarSize: 'compact' });
  });

  it('keeps how the month view scrolls per person: sideways by default, then sideways, vertical or vertical-snap only', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ monthScroll: 'sideways' });
    for (const ok of ['vertical', 'vertical-snap', 'sideways']) expect((await t.json('PATCH', '/api/prefs', { monthScroll: ok })).body, ok).toMatchObject({ monthScroll: ok });
    for (const bad of ['Vertical', 'horizontal', true, null, 1]) expect((await t.json('PATCH', '/api/prefs', { monthScroll: bad })).status, JSON.stringify(bad)).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ monthScroll: 'sideways' });
  });

  it('offers the side menu (drawer) as a phone view switcher position only', async () => {
    expect((await t.json('PATCH', '/api/prefs', { navPhone: 'drawer' })).body).toMatchObject({ navPhone: 'drawer' });
    expect((await t.json('PATCH', '/api/prefs', { navDesktop: 'drawer' })).status).toBe(400);
  });

  it('keeps the view switcher position per device type, bottom on phones and rail on desktop by default, only the known values', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ navPhone: 'bottom', navDesktop: 'rail' });
    expect((await t.json('PATCH', '/api/prefs', { navPhone: 'top' })).body).toMatchObject({ navPhone: 'top', navDesktop: 'rail' });
    expect((await t.json('PATCH', '/api/prefs', { navDesktop: 'bottom' })).body).toMatchObject({ navPhone: 'top', navDesktop: 'bottom' });
    expect((await t.json('PATCH', '/api/prefs', { navPhone: 'rail' })).body).toMatchObject({ navPhone: 'rail', navDesktop: 'bottom' });
    for (const bad of ['left', '', 3, null]) {
      expect((await t.json('PATCH', '/api/prefs', { navPhone: bad })).status).toBe(400);
      expect((await t.json('PATCH', '/api/prefs', { navDesktop: bad })).status).toBe(400);
    }
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ navPhone: 'rail', navDesktop: 'bottom' });
  });

  it('keeps the minimum event length per person: off (0) by default, 0, 15 or 30 only', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ minEventMinutes: 0 });
    expect((await t.json('PATCH', '/api/prefs', { minEventMinutes: 30 })).body).toMatchObject({ minEventMinutes: 30 });
    for (const bad of [10, 45, '30', null, -15]) expect((await t.json('PATCH', '/api/prefs', { minEventMinutes: bad })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ minEventMinutes: 30 });
  });

  it('keeps the tray width per person: 380 by default, whole px from 260 to 560 only', async () => {
    expect((await t.json('PATCH', '/api/prefs', { trayWidth: 300 })).body).toMatchObject({ trayWidth: 300 });
    for (const bad of [259, 561, 300.5, '300', null]) expect((await t.json('PATCH', '/api/prefs', { trayWidth: bad })).status).toBe(400);
  });

  it('keeps the streak choice per person: off by default, off, flame or plant only', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ streak: 'off' });
    expect((await t.json('PATCH', '/api/prefs', { streak: 'plant' })).body).toMatchObject({ streak: 'plant' });
    for (const bad of ['Flame', 'both', true, null, 1]) expect((await t.json('PATCH', '/api/prefs', { streak: bad })).status, JSON.stringify(bad)).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { streak: 'flame' })).body).toMatchObject({ streak: 'flame' });
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ streak: 'flame' });
  });

  it('keeps the header layout per person: two rows by default, two-rows or one-row only, never through the theme', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ headerLayout: 'auto', bottomBarSize: 'auto', approachTimeLeft: false });
    expect((await t.json('PATCH', '/api/prefs', { headerLayout: 'one-row' })).body).toMatchObject({ headerLayout: 'one-row' });
    for (const bad of ['One row', 'three-rows', true, null, 1]) expect((await t.json('PATCH', '/api/prefs', { headerLayout: bad })).status, JSON.stringify(bad)).toBe(400);
    // not theming: the theme route refuses it, and choosing a theme keeps it
    expect((await t.json('PATCH', '/api/prefs/theme', { headerLayout: 'auto', bottomBarSize: 'auto', approachTimeLeft: true })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs/theme', { preset: 'Spring' })).status).toBe(200);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ headerLayout: 'one-row' });
    expect((await t.json('GET', '/api/prefs/theme')).body).not.toHaveProperty('headerLayout');
  });

  it('keeps the sync indicator switch per person: off by default, boolean only', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ syncIndicator: false });
    expect((await t.json('PATCH', '/api/prefs', { syncIndicator: true })).body).toMatchObject({ syncIndicator: true });
    for (const bad of ['yes', 1, null]) expect((await t.json('PATCH', '/api/prefs', { syncIndicator: bad })).status, JSON.stringify(bad)).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ syncIndicator: true });
    expect((await t.json('PATCH', '/api/prefs', { contactsOfferDismissed: true })).body).toMatchObject({ contactsOfferDismissed: true });
    for (const bad of ['yes', 1, null]) expect((await t.json('PATCH', '/api/prefs', { contactsOfferDismissed: bad })).status, JSON.stringify(bad)).toBe(400);
  });

  it('keeps the time-left switch of the Approaching card per person: off by default, boolean only', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ approachTimeLeft: false });
    expect((await t.json('PATCH', '/api/prefs', { approachTimeLeft: true })).body).toMatchObject({ approachTimeLeft: true });
    for (const bad of ['yes', 1, null]) expect((await t.json('PATCH', '/api/prefs', { approachTimeLeft: bad })).status, JSON.stringify(bad)).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ approachTimeLeft: true });
  });

  it('keeps how many events sit side by side per person: day 1 to 4 (default 4), week 1 to 3 (default 2); 1 is "Only 1"', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ daySideBySide: 4, weekSideBySide: 2 });
    expect((await t.json('PATCH', '/api/prefs', { daySideBySide: 2, weekSideBySide: 3 })).body).toMatchObject({ daySideBySide: 2, weekSideBySide: 3 });
    expect((await t.json('PATCH', '/api/prefs', { daySideBySide: 1, weekSideBySide: 1 })).body).toMatchObject({ daySideBySide: 1, weekSideBySide: 1 });
    await t.json('PATCH', '/api/prefs', { daySideBySide: 2, weekSideBySide: 3 });
    for (const bad of [5, '3', null, 0]) expect((await t.json('PATCH', '/api/prefs', { daySideBySide: bad })).status).toBe(400);
    for (const bad of [0, 4, '2', null]) expect((await t.json('PATCH', '/api/prefs', { weekSideBySide: bad })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ daySideBySide: 2, weekSideBySide: 3 });
  });

  it('keeps the iPhone widget layout (standard) and the timeline days (3) per person; timeline days 1 to 7 only', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ widgetLayout: 'standard', widgetTimelineDays: 3 });
    expect((await t.json('PATCH', '/api/prefs', { widgetLayout: 'timeline', widgetTimelineDays: 7 })).body).toMatchObject({ widgetLayout: 'timeline', widgetTimelineDays: 7 });
    for (const bad of [0, 8, '3', null]) expect((await t.json('PATCH', '/api/prefs', { widgetTimelineDays: bad })).status, JSON.stringify(bad)).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { widgetLayout: 'week' })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ widgetLayout: 'timeline', widgetTimelineDays: 7 });
  });

  it('keeps the two-row week switch (off) and its split (4 on top) per person, boolean and 3 or 4 only', async () => {
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ weekTwoRow: false, weekTwoRowTop: 4 });
    expect((await t.json('PATCH', '/api/prefs', { weekTwoRow: true, weekTwoRowTop: 3 })).body).toMatchObject({ weekTwoRow: true, weekTwoRowTop: 3 });
    expect((await t.json('PATCH', '/api/prefs', { weekTwoRow: 'yes' })).status).toBe(400);
    for (const bad of [5, 2, '3', null]) expect((await t.json('PATCH', '/api/prefs', { weekTwoRowTop: bad })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ weekTwoRow: true, weekTwoRowTop: 3 });
  });

  it('keeps the language per person, auto by default, only the known languages', async () => {
    expect((await t.json('GET', '/api/prefs')).body.language).toBe('auto');
    for (const l of ['en', 'de', 'de-x-mainfr', 'de-x-coldmirror', 'auto']) {
      expect((await t.json('PATCH', '/api/prefs', { language: l })).body.language).toBe(l);
    }
    await t.json('PATCH', '/api/prefs', { language: 'de' });
    for (const bad of ['fr', 'DE', '', 1, null]) expect((await t.json('PATCH', '/api/prefs', { language: bad })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.language).toBe('de');
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.language).toBe('auto');
  });

  it('rejects an unknown support cat value', async () => {
    expect((await t.json('PATCH', '/api/prefs', { supportCat: 'maybe' })).status).toBe(400);
    expect((await t.json('PATCH', '/api/prefs', { supportCat: true })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body.supportCat).toBe('sometimes');
  });

  it('validates the whole patch before changing Google or the stored prefs', async () => {
    expect((await t.json('PATCH', '/api/prefs', { tasksCalendarVisible: true, labs: true, supportCat: 'maybe' })).status).toBe(400);
    expect((await t.json('GET', '/api/prefs')).body).toMatchObject({ labs: false, tasksCalendarVisible: false });
  });
});

describe('prefs: Tasks filter', () => {
  it('defaults to no filter, replaces the whole filter and survives a reset only as the default', async () => {
    expect((await t.json('GET', '/api/prefs')).body.tasksFilter).toEqual({ categories: [], when: 'all' });
    const f = { categories: ['shopping', 'none'], when: 'week' };
    expect((await t.json('PATCH', '/api/prefs', { tasksFilter: f })).body.tasksFilter).toEqual(f);
    expect((await t.json('GET', '/api/prefs')).body.tasksFilter).toEqual(f);
    expect((await t.json('PATCH', '/api/prefs', { tasksFilter: { categories: [], when: 'all' } })).body.tasksFilter).toEqual({ categories: [], when: 'all' });
    await t.json('PATCH', '/api/prefs', { tasksFilter: f });
    await t.req('POST', '/api/__test/reset');
    expect((await t.json('GET', '/api/prefs')).body.tasksFilter).toEqual({ categories: [], when: 'all' });
  });

  it.each([
    ['an unknown when', { categories: [], when: 'soon' }],
    ['a missing when', { categories: [] }],
    ['a missing list', { when: 'all' }],
    ['a non-text id', { categories: [1], when: 'all' }],
    ['an empty id', { categories: [''], when: 'all' }],
    ['a long id', { categories: ['x'.repeat(65)], when: 'all' }],
    ['a duplicate id', { categories: ['a', 'a'], when: 'all' }],
    ['too many ids', { categories: Array.from({ length: 51 }, (_, i) => `c${i}`), when: 'all' }],
    ['an extra field', { categories: [], when: 'all', x: 1 }],
    ['a string', 'week'],
    ['null', null],
  ])('rejects %s and changes nothing', async (_n, tasksFilter) => {
    await t.json('PATCH', '/api/prefs', { tasksFilter: { categories: ['a'], when: 'today' } });
    const r = await t.json('PATCH', '/api/prefs', { tasksFilter });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
    expect((await t.json('GET', '/api/prefs')).body.tasksFilter).toEqual({ categories: ['a'], when: 'today' });
  });
});

describe('GET /api/items excludeHidden (the Android widget fetches with it)', () => {
  it('leaves out the events of calendars the person switched off, only when asked', async () => {
    await freeze(t);
    const cal = (await t.json('POST', '/api/__test/remote/calendars', { summary: 'Work' })).body;
    const ev = { allDay: false, start: '2026-10-14T09:00:00+02:00', end: '2026-10-14T09:30:00+02:00' };
    await t.json('POST', '/api/events', { ...ev, title: 'Mine' });
    await t.json('POST', '/api/events', { ...ev, title: 'Work thing', calendarId: cal.id });
    await t.json('PATCH', `/api/calendars/${cal.id}`, { hidden: true });
    const titles = async (q: string) => ((await t.json('GET', `/api/items?from=2026-10-12&to=2026-10-19${q}`)).body.items as { title: string }[]).map((i) => i.title).sort();
    expect(await titles('')).toEqual(['Mine', 'Work thing']);
    expect(await titles('&excludeHidden=1')).toEqual(['Mine']);
  });
});

describe('prefs (Android list widget)', () => {
  it('keeps the style and the number of days per person, with the Agenda and 3 days by default, and refuses anything else', async () => {
    const { body } = await t.json('GET', '/api/prefs');
    expect(body.androidWidgetStyle).toBe('agenda');
    expect(body.androidWidgetDays).toBe(3);
    const set = (await t.json('PATCH', '/api/prefs', { androidWidgetStyle: 'timeline', androidWidgetDays: 5 })).body;
    expect([set.androidWidgetStyle, set.androidWidgetDays]).toEqual(['timeline', 5]);
    for (const bad of [{ androidWidgetStyle: 'carousel' }, { androidWidgetDays: 0 }, { androidWidgetDays: 8 }, { androidWidgetDays: '3' }]) {
      expect((await t.json('PATCH', '/api/prefs', bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });
});
