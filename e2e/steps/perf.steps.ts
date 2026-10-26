/** @perf steps (STEPS.md "Performance"): browser memory via CDP, request counting, budgets, Lighthouse, server RSS. */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, chromium, type CDPSession, type Page } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { detachedNodes, measureMemory } from './support/cdp.js';
import { addDays, berlinIso } from './support/dates.js';
import { isTaskList, readItems } from './support/google.js';
import { expandTaskList } from './support/tasklist.js';
import { goToPeriod } from './support/ui.js';
import type { World } from './support/world.js';

const MB = 1024 * 1024;

// --- workloads -------------------------------------------------------------------------------------------------

When('I cycle through the month, week and day views {int} times', async function (this: World, n: number) {
  this.extendTimeout(n * 1_500);
  for (let i = 0; i < n; i++) {
    for (const view of ['week', 'day', 'month']) {
      await this.page.getByTestId(`view-switch-${view}`).click();
      await expect(this.page.getByTestId(`${view}-view`)).toBeVisible();
    }
  }
});

When('I open and close the event dialog {int} times', async function (this: World, n: number) {
  this.extendTimeout(n * 1_000);
  const dialog = this.page.getByTestId('event-dialog');
  for (let i = 0; i < n; i++) {
    await this.page.getByTestId('create-button').click();
    await this.page.getByTestId('new-kind-event').click();
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('event-cancel').click();
    await expect(dialog).toHaveCount(0);
  }
});

When('I expand and collapse the task list {string} {int} times', async function (this: World, title: string, n: number) {
  this.extendTimeout(n * 1_000);
  for (let i = 0; i < n; i++) {
    await expandTaskList(this, title);
    await this.expanded.getByTestId('tasklist-close').click();
    await expect(this.expanded).toHaveCount(0);
  }
});

When('I go to the next period {int} times', async function (this: World, n: number) {
  for (let i = 0; i < n; i++) await goToPeriod(this.page, 'next');
});

// --- browser memory --------------------------------------------------------------------------------------------

When('I record the browser memory after garbage collection', async function (this: World) {
  this.browserMemory = await measureMemory(this.page);
});

function recorded(world: World) {
  if (!world.browserMemory) throw new Error('No "I record the browser memory" step before');
  return world.browserMemory;
}

async function expectGrowth(world: World, key: 'heap' | 'nodes' | 'listeners', percent: number) {
  const before = recorded(world)[key];
  const after = (await measureMemory(world.page))[key];
  const growth = before > 0 ? ((after - before) / before) * 100 : 0;
  world.testInfo.annotations.push({ type: `memory ${key}`, description: `${before} -> ${after} (${growth.toFixed(1)} %)` });
  expect(growth, `${key} growth % (${before} -> ${after})`).toBeLessThan(percent);
}

Then('the JS heap has grown by less than {int} percent since the recording', async function (this: World, p: number) {
  await expectGrowth(this, 'heap', p);
});

Then('the DOM node count has grown by less than {int} percent since the recording', async function (this: World, p: number) {
  await expectGrowth(this, 'nodes', p);
});

Then('the event listener count has grown by less than {int} percent since the recording', async function (this: World, p: number) {
  await expectGrowth(this, 'listeners', p);
});

Then('there are no detached DOM nodes from closed dialogs', async function (this: World) {
  const report = await detachedNodes(this.page, ['event-dialog', 'tasklist-dialog', 'tasklist-expanded', 'confirm-dialog']);
  this.testInfo.annotations.push({ type: 'detached DOM', description: `${report.total} elements (${report.method})` });
  expect(report.fromDialogs, 'detached dialog elements').toEqual([]);
  expect(report.total, 'detached HTML elements overall').toBeLessThanOrEqual(50);
});

// --- request counting ------------------------------------------------------------------------------------------

When('I count requests to {string} for {int} seconds', async function (this: World, prefix: string, seconds: number) {
  this.extendTimeout(seconds * 1000);
  let count = 0;
  const onRequest = (r: { url(): string }) => {
    if (new URL(r.url()).pathname.startsWith(prefix)) count++;
  };
  this.page.on('request', onRequest);
  await this.page.waitForTimeout(seconds * 1000);
  this.page.off('request', onRequest);
  this.requestCount = count;
});

function counted(world: World) {
  if (world.requestCount === undefined) throw new Error('No "I count requests" step before');
  return world.requestCount;
}

Then('at most {int} requests to {string} were counted', async function (this: World, max: number, _prefix: string) {
  expect(counted(this)).toBeLessThanOrEqual(max);
});

Then('at least {int} requests to {string} were counted', async function (this: World, min: number, _prefix: string) {
  expect(counted(this)).toBeGreaterThanOrEqual(min);
});

// --- first load budgets ----------------------------------------------------------------------------------------

Then(
  'the JavaScript downloaded for the first load is at most {int} KB compressed',
  async function (this: World, kb: number) {
    await this.page.waitForLoadState('load');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2_000);
    const bytes = await this.page.evaluate(() =>
      (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .filter((e) => e.initiatorType === 'script' || /\.m?js(\?|$)/.test(new URL(e.name).pathname))
        .reduce((sum, e) => sum + e.transferSize, 0),
    );
    this.testInfo.annotations.push({ type: 'first-load JS', description: `${(bytes / 1024).toFixed(1)} KB` });
    expect(bytes / 1024, 'compressed JS KB').toBeLessThanOrEqual(kb);
  },
);

Then('the month view was rendered within {int} ms of navigation start', async function (this: World, ms: number) {
  await expect(this.page.getByTestId('month-cell').first()).toBeVisible();
  const at = await this.page.evaluate(() => (window as unknown as { __monthRenderedAt?: number }).__monthRenderedAt);
  expect(at, 'month cell render time recorded').toBeDefined();
  this.testInfo.annotations.push({ type: 'month rendered', description: `${Math.round(at!)} ms` });
  expect(at!).toBeLessThanOrEqual(ms);
});

// --- busy month ------------------------------------------------------------------------------------------------

const BUSY_TITLES = ['Standup', 'Dentist appointment', 'Lunch with Anna', 'Team retro', 'Gym', 'Call mum', 'Pick up kids', 'Doctor',
  'Project sync with design team', 'Haircut', 'Yoga class', '1:1 Manager', 'Groceries run', 'Coffee', 'Piano lesson',
  'Parents evening at school', 'Car service', 'Swimming', 'Book club', 'Dinner'];
const BIRTHDAYS_ID = 'addressbook#contacts@group.v.calendar.google.com';

/**
 * About 500 entries over the six weeks of the month grid (STEPS.md "Performance"), the same every run (seeded random):
 * 6-15 timed events a day, a task list every other day, an all-day event every fifth day, six multi-day events, six birthdays.
 */
Given('the calendar contains a busy month around {month}', async function (this: World, month: string) {
  this.extendTimeout(60_000);
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const first = `${month}-01`;
  // the Monday on or before the 1st: the grid's first day
  const start = addDays(first, -((new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7));
  const calls: Array<[string, Record<string, unknown>]> = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i);
    for (let k = 6 + Math.floor(rnd() * 10); k > 0; k--) {
      const from = (7 + Math.floor(rnd() * 13)) * 60 + pick([0, 15, 30, 45]);
      const to = Math.min(23 * 60 + 59, from + pick([15, 30, 45, 60, 90]));
      calls.push(['/api/events', { title: pick(BUSY_TITLES), allDay: false, start: berlinIso(date, hhmm(from)), end: berlinIso(date, hhmm(to)) }]);
    }
    if (i % 2 === 0) {
      const items = Array.from({ length: 2 + Math.floor(rnd() * 5) }, (_, j) => ({ title: `Item ${j + 1}`, done: rnd() < 0.3 }));
      calls.push(['/api/tasklists', { title: pick(['Groceries', 'Chores', 'Work todo', 'Packing']), date, time: null, items }]);
    }
    if (i % 5 === 0) calls.push(['/api/events', { title: 'Holiday', allDay: true, start: date, end: addDays(date, 1) }]);
  }
  for (const [offset, days] of [[4, 3], [8, 5], [16, 4], [21, 9], [29, 3], [31, 6]]) {
    const from = addDays(start, offset);
    calls.push(['/api/events', { title: `Trip ${from}`, allDay: true, start: from, end: addDays(from, days) }]);
  }
  await this.api.post('/api/__test/remote/calendars', { summary: 'Birthdays', id: BIRTHDAYS_ID, color: '#9fc6e7', readOnly: true });
  for (const offset of [5, 11, 17, 23, 30, 37]) {
    const date = addDays(start, offset);
    calls.push(['/api/__test/remote/events', {
      calendarId: BIRTHDAYS_ID, summary: 'Birthday Bob', start: { date }, end: { date: addDays(date, 1) }, eventType: 'birthday',
      birthdayProperties: { type: 'birthday', contact: 'people/c1' }, recurrence: ['RRULE:FREQ=YEARLY'],
    }]);
  }
  for (let i = 0; i < calls.length; i += 8) await Promise.all(calls.slice(i, i + 8).map(([path, body]) => this.api.post(path, body)));
});

// --- main thread under a slow processor -------------------------------------------------------------------------

/** The DevTools session that holds the CPU slowdown: it lasts as long as the session stays attached. */
const throttles = new WeakMap<Page, CDPSession>();

When('the phone\'s processor is {int} times slower', async function (this: World, rate: number) {
  const cdp = await this.page.context().newCDPSession(this.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  throttles.set(this.page, cdp);
});

When('I start measuring long tasks', async function (this: World) {
  await this.page.evaluate(() => {
    const w = window as unknown as { __longTasks: number[] };
    w.__longTasks = [];
    new PerformanceObserver((list) => { for (const e of list.getEntries()) w.__longTasks.push(e.duration); }).observe({ type: 'longtask' });
  });
});

/** The long tasks (> 50 ms) since "I start measuring long tasks", once the page has been quiet for a moment. */
async function longTasks(world: World): Promise<number[]> {
  await world.page.waitForTimeout(1_500);
  const tasks = await world.page.evaluate(() => (window as unknown as { __longTasks?: number[] }).__longTasks);
  if (!tasks) throw new Error('No "I start measuring long tasks" step before');
  world.testInfo.annotations.push({ type: 'long tasks', description: `${tasks.length}: ${tasks.map(Math.round).join(', ')} ms` });
  return tasks;
}

Then('no task blocked the page for more than {int} ms', async function (this: World, ms: number) {
  expect(Math.max(0, ...(await longTasks(this))), 'longest task (ms)').toBeLessThanOrEqual(ms);
});

Then('the long tasks took at most {int} ms together', async function (this: World, ms: number) {
  expect((await longTasks(this)).reduce((a, b) => a + b, 0), 'long tasks together (ms)').toBeLessThanOrEqual(ms);
});

/** Processor time (ms) the renderer and GPU processes use over `seconds` of real time (STEPS.md "@perf" notes). */
Then('the browser uses at most {int} ms of processor time in {int} seconds', async function (this: World, ms: number, seconds: number) {
  const browser = this.page.context().browser();
  if (!browser) throw new Error('no browser');
  const cdp = await browser.newBrowserCDPSession();
  const cpuSeconds = async () => (await cdp.send('SystemInfo.getProcessInfo')).processInfo
    .filter((p) => p.type === 'renderer' || p.type === 'GPU').reduce((sum, p) => sum + p.cpuTime, 0);
  let used: number;
  try {
    await this.page.waitForTimeout(1_000);
    const before = await cpuSeconds();
    await this.page.waitForTimeout(seconds * 1_000);
    used = Math.round((await cpuSeconds() - before) * 1_000);
  } finally {
    await cdp.detach();
  }
  this.testInfo.annotations.push({ type: 'processor time', description: `${used} ms in ${seconds} s` });
  expect(used, `processor time in ${seconds} s (ms)`).toBeLessThanOrEqual(ms);
});

// --- Lighthouse ------------------------------------------------------------------------------------------------

/** One Lighthouse run (mobile preset, simulated throttling) in a fresh browser; the performance score x 100. */
async function auditOnce(world: World): Promise<number> {
  const port = 9222 + Math.floor(Math.random() * 500);
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
  try {
    const { default: lighthouse } = await import('lighthouse');
    const result = await lighthouse(`${world.baseURL}/`, { port, onlyCategories: ['performance'], logLevel: 'error', output: 'json' });
    const score = result?.lhr.categories.performance.score;
    if (score == null) throw new Error(`Lighthouse returned no performance score: ${result?.lhr.runtimeError?.message ?? ''}`);
    if (typeof result?.report === 'string') {
      await world.testInfo.attach('lighthouse.json', { body: result.report, contentType: 'application/json' });
    }
    return Math.round(score * 100);
  } finally {
    await browser.close();
  }
}

When('I run a phone performance audit of the app {int} times', async function (this: World, runs: number) {
  this.extendTimeout(180_000 * runs);
  const scores: number[] = [];
  // one after the other: parallel runs would disturb each other's timings
  for (let i = 0; i < runs; i++) scores.push(await auditOnce(this));
  const sorted = [...scores].sort((a, b) => a - b);
  this.lighthouseScore = sorted[Math.floor(sorted.length / 2)];
  this.testInfo.annotations.push({ type: 'lighthouse performance', description: `median ${this.lighthouseScore} of ${scores.join(', ')}` });
});

Then('the median performance score is at least {int}', async function (this: World, min: number) {
  if (this.lighthouseScore === undefined) throw new Error('No performance audit ran');
  expect(this.lighthouseScore).toBeGreaterThanOrEqual(min);
});

// --- server memory ---------------------------------------------------------------------------------------------

Then('the server resident memory is below {int} MB', async function (this: World, mb: number) {
  const rss = (this.lastResponse?.json as { rss?: number } | undefined)?.rss;
  if (typeof rss !== 'number') throw new Error('The last response has no "rss" field');
  this.testInfo.annotations.push({ type: 'server rss', description: `${(rss / MB).toFixed(1)} MB` });
  expect(rss / MB).toBeLessThan(mb);
});

/** Free loopback port, as e2e/run.sh picks it. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

// Idle RSS is measured on a server of its own: the shared one has served the whole suite by now (feature resource-efficiency).
When('I request {string} on a fresh server', async function (this: World, spec: string) {
  this.extendTimeout(60_000);
  const [method, ...rest] = spec.trim().split(/\s+/);
  const path = rest.join(' ');
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'calendar-e2e-fresh-'));
  // same env as e2e/run.sh start_server, only port and DATA_DIR differ
  const child = spawn('node', ['--expose-gc', resolve(process.cwd(), '../server/dist/index.js')], {
    env: {
      ...process.env,
      HOST: '127.0.0.1', PORT: String(port), TEST_MODE: 'true', PROVIDER: 'mock', SEED: 'false', DATA_DIR: dataDir,
      POLL_INTERVAL_MS: '30000', TZ: 'Europe/Berlin', NODE_ENV: 'production', ALLOW_INSECURE_MOCK: '1',
    },
    stdio: 'ignore',
  });
  const exited = new Promise<void>((r) => child.once('exit', () => r()));
  try {
    const base = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 30_000;
    for (;;) {
      if (child.exitCode !== null) throw new Error('The fresh server exited before it became healthy');
      if (Date.now() > deadline) throw new Error('The fresh server did not become healthy within 30 s');
      const ok = await fetch(`${base}/api/health`).then((r) => r.ok, () => false);
      if (ok) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const res = await fetch(base + path, { method });
    const body = await res.text();
    let json: unknown;
    try { json = JSON.parse(body); } catch { json = undefined; }
    this.lastResponse = { status: res.status, json, url: res.url };
  } finally {
    child.kill();
    await exited;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

/** Run `n` jobs sequentially per lane with concurrency 10. */
async function inParallel(n: number, job: (i: number) => Promise<void>) {
  let next = 0;
  const lane = async () => {
    while (next < n) await job(next++);
  };
  await Promise.all(Array.from({ length: Math.min(10, n) }, lane));
}

async function sendRequests(world: World, n: number, spec: string) {
  world.extendTimeout(n * 20);
  const [method, path] = spec.trim().split(/\s+/, 2);
  await inParallel(n, async () => {
    const res = await world.request.fetch(path, { method, failOnStatusCode: false });
    if (!res.ok()) throw new Error(`${method} ${path} -> ${res.status()}`);
    await res.dispose();
  });
}

When('I send {int} warm-up requests to {string}', async function (this: World, n: number, spec: string) {
  await sendRequests(this, n, spec);
});

When('I send {int} requests to {string}', async function (this: World, n: number, spec: string) {
  await sendRequests(this, n, spec);
});

When(
  'I send {int} requests to {string} the item {string} of the task list {string} alternating done and not done',
  async function (this: World, n: number, method: string, item: string, list: string) {
    this.extendTimeout(n * 40);
    const ev = (await this.api.remoteEvents(list)).find((e) => e.summary === list && isTaskList(e));
    if (!ev) throw new Error(`No task list "${list}"`);
    const target = readItems(ev).find((i) => i.t === item);
    if (!target) throw new Error(`Task list "${list}" has no item "${item}"`);
    const path = `/api/tasklists/${encodeURIComponent(ev.id)}/items/${encodeURIComponent(target.id)}`;
    await inParallel(n, async (i) => {
      const res = await this.request.fetch(path, { method, data: { done: i % 2 === 0 }, failOnStatusCode: false });
      if (!res.ok()) throw new Error(`${method} ${path} -> ${res.status()}`);
      await res.dispose();
    });
  },
);

When('I record the server memory after garbage collection', async function (this: World) {
  this.serverRss = (await this.api.memory()).rss;
});

Then('the server memory has grown by less than {int} MB since the recording', async function (this: World, mb: number) {
  if (this.serverRss === undefined) throw new Error('No "I record the server memory" step before');
  const after = (await this.api.memory()).rss;
  const growth = (after - this.serverRss) / MB;
  this.testInfo.annotations.push({ type: 'server rss growth', description: `${growth.toFixed(1)} MB` });
  expect(growth).toBeLessThan(mb);
});
