/** Setup, clock and data fixtures (STEPS.md "Setup and clock", "Data fixtures"). */
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given } from './fixtures.js';
import { addDays, berlinIso } from './support/dates.js';
import { itemsFrom } from './support/tables.js';
import type { World } from './support/world.js';

// --- setup and clock -------------------------------------------------------------------------------------------

Given('the calendar is empty', async function (this: World) {
  await this.api.reset({ seed: false });
  this.pollIntervalMs = 30_000;
});

Given('today is {date}', async function (this: World, date: string) {
  await this.api.setClock(berlinIso(date, '08:00'));
});

Given('the time is {date} {time}', async function (this: World, date: string, time: string) {
  await this.api.setClock(berlinIso(date, time));
});

Given('automatic sync runs every {int} seconds', async function (this: World, seconds: number) {
  this.pollIntervalMs = seconds * 1000;
  await this.api.setConfig({ pollIntervalMs: this.pollIntervalMs });
});

Given('automatic sync is disabled', async function (this: World) {
  this.pollIntervalMs = 0;
  await this.api.setConfig({ pollIntervalMs: 0 });
});

Given('I am using a phone', async function (this: World) {
  const use = this.testInfo.project.use;
  const width = this.page.viewportSize()?.width ?? Infinity;
  expect(width, 'phone viewport width').toBeLessThanOrEqual(430);
  expect(use.hasTouch, 'touch enabled').toBe(true);
});

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

Given('I am using Safari on an iPhone', async function (this: World) {
  await this.context.addInitScript((ua) => {
    const nav = Navigator.prototype;
    Object.defineProperty(nav, 'userAgent', { get: () => ua, configurable: true });
    Object.defineProperty(nav, 'vendor', { get: () => 'Apple Computer, Inc.', configurable: true });
    Object.defineProperty(nav, 'platform', { get: () => 'iPhone', configurable: true });
  }, IPHONE_UA);
});

Given('the app runs as an installed app', async function (this: World) {
  await this.context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true });
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const mql = original(query);
      if (!/display-mode:\s*standalone/.test(query)) return mql;
      return new Proxy(mql, {
        get: (target, prop) => {
          if (prop === 'matches') return true;
          const v = Reflect.get(target, prop, target);
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
    };
  });
});

// --- data fixtures (public API) ---------------------------------------------------------------------------------

/**
 * Fixtures go through the public API, which awards plant points for creates (API.md). A fixture is not user activity,
 * so the plant state is restored afterwards: scenarios then count only the points they earn themselves.
 */
async function createFixture(world: World, path: string, body: Record<string, unknown>) {
  const before = (await world.api.get<{ plant: { growth: number; lastWatered: string | null; todayPoints: number } }>('/api/motivation')).plant;
  await world.api.post(path, body);
  await world.api.setMotivation({ plant: { growth: before.growth, lastWatered: before.lastWatered, todayPoints: before.todayPoints } });
}

async function createEvent(world: World, body: Record<string, unknown>) {
  await createFixture(world, '/api/events', body);
}

async function createTaskList(world: World, body: Record<string, unknown>) {
  await createFixture(world, '/api/tasklists', body);
}

Given(
  'the calendar contains an event {string} on {date} from {time} to {time}',
  async function (this: World, title: string, date: string, from: string, to: string) {
    await createEvent(this, { title, allDay: false, start: berlinIso(date, from), end: berlinIso(date, to) });
  },
);

Given(
  'the calendar contains an event {string} on {date} from {time} to {time} at {string}',
  async function (this: World, title: string, date: string, from: string, to: string, location: string) {
    await createEvent(this, { title, allDay: false, start: berlinIso(date, from), end: berlinIso(date, to), location });
  },
);

Given(
  'the calendar contains an event {string} in the calendar {string} on {date} from {time} to {time}',
  async function (this: World, title: string, calendar: string, date: string, from: string, to: string) {
    const calendarId = await this.api.calendarId(calendar);
    await createEvent(this, { title, calendarId, allDay: false, start: berlinIso(date, from), end: berlinIso(date, to) });
  },
);

Given(
  'the calendar contains an event {string} from {date} {time} to {date} {time}',
  async function (this: World, title: string, d1: string, t1: string, d2: string, t2: string) {
    await createEvent(this, { title, allDay: false, start: berlinIso(d1, t1), end: berlinIso(d2, t2) });
  },
);

Given('the calendar contains an all-day event {string} on {date}', async function (this: World, title: string, date: string) {
  await createEvent(this, { title, allDay: true, start: date, end: addDays(date, 1) });
});

Given(
  'the calendar contains an all-day event {string} from {date} to {date}',
  async function (this: World, title: string, from: string, to: string) {
    // Steps use inclusive ranges, the API an exclusive end.
    await createEvent(this, { title, allDay: true, start: from, end: addDays(to, 1) });
  },
);

Given(
  'the calendar contains a task list {string} on {date} with items:',
  async function (this: World, title: string, date: string, table: DataTable) {
    await createTaskList(this, { title, date, time: null, items: itemsFrom(table) });
  },
);

Given(
  'the calendar contains a task list {string} on {date} at {time} with items:',
  async function (this: World, title: string, date: string, time: string, table: DataTable) {
    await createTaskList(this, { title, date, time, items: itemsFrom(table) });
  },
);

Given(
  'the calendar contains a task list {string} on {date} at {time} for {int} minutes with items:',
  async function (this: World, title: string, date: string, time: string, minutes: number, table: DataTable) {
    await createTaskList(this, { title, date, time, estimateMinutes: minutes, items: itemsFrom(table) });
  },
);

Given(
  'the calendar contains a task list {string} on {date} at {time} for {int} minutes',
  async function (this: World, title: string, date: string, time: string, minutes: number) {
    await createTaskList(this, { title, date, time, estimateMinutes: minutes, items: [] });
  },
);

Given('the calendar contains an empty task list {string} on {date}', async function (this: World, title: string, date: string) {
  await createTaskList(this, { title, date, time: null, items: [] });
});

Given(
  'the calendar contains a task list {string} on {date} with {int} generated items',
  async function (this: World, title: string, date: string, count: number) {
    const items = Array.from({ length: count }, (_, i) => ({ title: `Generated item ${i + 1}`, done: false }));
    await createTaskList(this, { title, date, time: null, items });
  },
);

Given(
  'the calendar contains a task list {string} in the category {string} on {date}',
  async function (this: World, title: string, category: string, date: string) {
    const categoryId = await this.api.categoryId(category);
    await createTaskList(this, { title, date, time: null, items: [], categoryId });
  },
);

Given(
  'the calendar contains a task list {string} in the category {string} with the tags {string} on {date}',
  async function (this: World, title: string, category: string, tags: string, date: string) {
    const categoryId = await this.api.categoryId(category);
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    await createTaskList(this, { title, date, time: null, items: [], categoryId, tags: tagList });
  },
);

Given(
  'Google contains a raw task list event {string} on {date} with the description:',
  async function (this: World, title: string, date: string, description: string) {
    await this.api.remoteInsert({
      calendarId: await this.api.tasksCalendarId(),
      summary: title,
      description,
      start: { date },
      end: { date: addDays(date, 1) },
      extendedProperties: { private: { kind: 'tasklist' } },
    });
  },
);
