/** @perf steps (STEPS.md "Performance"): browser memory via CDP, request counting, budgets, Lighthouse, server RSS. */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, chromium } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { detachedNodes, measureMemory } from './support/cdp.js';
import { isTaskList, readItems } from './support/google.js';
import { expandTaskList } from './support/tasklist.js';
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
  for (let i = 0; i < n; i++) {
    const before = this.page.url();
    await this.page.getByTestId('nav-next').click();
    await expect.poll(() => this.page.url()).not.toBe(before);
  }
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

// --- Lighthouse ------------------------------------------------------------------------------------------------

When('I run a phone performance audit of the app', async function (this: World) {
  this.extendTimeout(180_000);
  const port = 9222 + Math.floor(Math.random() * 500);
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
  try {
    const { default: lighthouse } = await import('lighthouse');
    // Default config = mobile form factor with simulated throttling.
    const result = await lighthouse(`${this.baseURL}/`, {
      port,
      onlyCategories: ['performance'],
      logLevel: 'error',
      output: 'json',
    });
    const score = result?.lhr.categories.performance.score;
    if (score == null) throw new Error(`Lighthouse returned no performance score: ${result?.lhr.runtimeError?.message ?? ''}`);
    this.lighthouseScore = Math.round(score * 100);
    this.testInfo.annotations.push({ type: 'lighthouse performance', description: String(this.lighthouseScore) });
    if (typeof result?.report === 'string') {
      await this.testInfo.attach('lighthouse.json', { body: result.report, contentType: 'application/json' });
    }
  } finally {
    await browser.close();
  }
});

Then('the performance score is at least {int}', async function (this: World, min: number) {
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

// Idle RSS is measured on a server of its own: the shared one has served the whole suite by now (A-102).
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
      POLL_INTERVAL_MS: '30000', TZ: 'Europe/Berlin', NODE_ENV: 'production',
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
