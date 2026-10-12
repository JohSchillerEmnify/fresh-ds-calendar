/** Reward effect and micro-interaction steps (STEPS.md "Reward effects"). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { itemById } from './support/tasklist.js';
import { splitList } from './support/tables.js';
import type { ProbeWindow, RewardLogEntry } from './support/world.js';
import { attr, type World } from './support/world.js';

const LONG_RUNNING_KINDS = ['tick', 'list-complete', 'drop'];
/** Quiet period used by the negative effect assertions (STEPS.md: 1 500 ms). */
const QUIET_MS = 1_500;

const rewardLog = (w: World): Promise<RewardLogEntry[]> =>
  w.page.evaluate(() => (window as unknown as ProbeWindow).__rewardLog ?? []);

Then(
  'a {string} effect appears and is removed within {int} ms',
  async function (this: World, kind: string, ms: number) {
    this.extendTimeout(ms);
    const latest = async () => (await rewardLog(this)).filter((e) => e.kind === kind).at(-1);
    await expect.poll(latest, { message: `a "${kind}" reward effect is inserted` }).toBeDefined();
    await expect
      .poll(async () => (await latest())?.removedAt, { message: `the "${kind}" effect is removed`, timeout: ms + 2_000 })
      .toBeDefined();
    const entry = (await latest())!;
    expect(entry.removedAt! - entry.insertedAt, `"${kind}" effect lifetime in ms`).toBeLessThanOrEqual(ms);
  },
);

async function expectNoEffects(world: World, kinds: string[] | null) {
  await world.page.waitForTimeout(QUIET_MS);
  const seen = (await rewardLog(world)).filter((e) => kinds === null || kinds.includes(e.kind)).map((e) => e.kind);
  expect(seen, 'reward effects that appeared').toEqual([]);
}

Then('no reward effect appears', async function (this: World) {
  await expectNoEffects(this, LONG_RUNNING_KINDS);
});

Then('no {string} effect appears', async function (this: World, kind: string) {
  await expectNoEffects(this, [kind]);
});

Then('there are no reward effect elements left', async function (this: World) {
  await this.page.waitForTimeout(QUIET_MS);
  await expect(this.page.getByTestId('reward-effect')).toHaveCount(0);
});

Then(
  'the progress ring of the task list {string} shows {int} percent',
  async function (this: World, title: string, percent: number) {
    const ring = this.byTestId('tasklist-expanded', attr('data-title', title)).getByTestId('tasklist-progress-ring');
    await expect(ring).toBeVisible();
    await expect
      .poll(async () => Math.round(Number(await ring.getAttribute('aria-valuenow'))))
      .toBe(percent);
  },
);

Then('the expanded task list shows the message {string}', async function (this: World, message: string) {
  await expect(this.expanded.getByTestId('tasklist-complete-message')).toHaveText(message);
});

When('I quickly tick the items {string}', async function (this: World, list: string) {
  for (const title of splitList(list)) {
    const item = await itemById(this, title);
    // No waiting for responses or effects between clicks.
    await item.getByTestId('tasklist-item-checkbox').click({ noWaitAfter: true });
  }
});

When('I tick and untick the item {string} {int} times', async function (this: World, title: string, times: number) {
  this.extendTimeout(times * 1_500);
  const item = await itemById(this, title);
  const box = item.getByTestId('tasklist-item-checkbox');
  for (let i = 0; i < times; i++) {
    await expect(item).not.toHaveAttribute('data-done', 'true');
    await box.click();
    await expect(item).toHaveAttribute('data-done', 'true');
    await box.click();
  }
  await expect(item).not.toHaveAttribute('data-done', 'true');
});

const animationCount = (w: World) =>
  w.page.getByTestId('event-dialog').evaluate((d) => d.getAnimations({ subtree: true }).length);

Then('the event dialog opened with an animation', async function (this: World) {
  expect(await animationCount(this), 'running animations in the event dialog').toBeGreaterThan(0);
});

Then('the event dialog opened without an animation', async function (this: World) {
  await expect(this.page.getByTestId('event-dialog')).toBeVisible();
  expect(await animationCount(this), 'running animations in the event dialog').toBe(0);
});

Then('at most {int} app timers are active', async function (this: World, max: number) {
  const timers = await this.page.evaluate(() => {
    const t = (window as unknown as { __appTimers?: unknown }).__appTimers;
    if (typeof t === 'number') return t;
    if (t && typeof t === 'object') {
      const o = t as { size?: number; length?: number };
      return o.size ?? o.length ?? Object.keys(t).length;
    }
    return null;
  });
  expect(timers, 'window.__appTimers (test-mode counter, ARCHITECTURE 5a)').not.toBeNull();
  expect(timers!).toBeLessThanOrEqual(max);
});

Then('the page does not contain the words {string}', async function (this: World, list: string) {
  await this.settled();
  const text = await this.page.evaluate(() => document.body.innerText);
  const found = splitList(list).filter((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  expect(found, 'forbidden words present in the page text').toEqual([]);
});
