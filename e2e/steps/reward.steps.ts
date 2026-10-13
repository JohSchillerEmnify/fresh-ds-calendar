/** Reward effect and micro-interaction steps (STEPS.md "Reward effects"). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { itemById } from './support/tasklist.js';
import { splitList } from './support/tables.js';
import type { ProbeWindow, RewardLogEntry } from './support/world.js';
import { attr, type World } from './support/world.js';

const LONG_RUNNING_KINDS = ['tick', 'list-complete', 'drop'];
/** Quiet period used by the negative effect assertions (STEPS.md: 1 500 ms). */
const QUIET_MS = 1_500;

const rewardLog = (w: World): Promise<RewardLogEntry[]> =>
  w.page.evaluate(() => (window as unknown as ProbeWindow).__rewardLog ?? []);

/** The latest effect of a kind is inserted (default timeout) and removed at most `ms` after its insertion. */
async function expectEffectLifetime(world: World, kind: string, ms: number) {
  world.extendTimeout(ms);
  const latest = async () => (await rewardLog(world)).filter((e) => e.kind === kind).at(-1);
  await expect.poll(latest, { message: `a "${kind}" reward effect is inserted` }).toBeDefined();
  await expect
    .poll(async () => (await latest())?.removedAt, { message: `the "${kind}" effect is removed`, timeout: ms + 2_000 })
    .toBeDefined();
  const entry = (await latest())!;
  expect(entry.removedAt! - entry.insertedAt, `"${kind}" effect lifetime in ms`).toBeLessThanOrEqual(ms);
}

Then(
  'a {string} effect appears and is removed within {int} ms',
  async function (this: World, kind: string, ms: number) {
    await expectEffectLifetime(this, kind, ms);
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

// ---- The emotional support cat (STEPS.md "Scenes and the support cat") ----

/** Kind under which the reward-effect observer logs `[data-testid="support-cat"]` (support/world.ts). */
const CAT = 'support-cat';
/** STEPS.md: "does not appear" = no cat inserted within 4 000 ms after the tick. */
const CAT_QUIET_MS = 4_000;

Given('the support cat comes by on the next finished list', async function (this: World) {
  // Forces the next roll on every page load from now on (the app honours it in test mode only).
  await this.context.addInitScript(() => { (window as unknown as { __catNext?: boolean }).__catNext = true; });
});

/** STEPS.md: picks the option with that label in `settings-support-cat` and waits for the save (`PATCH /api/prefs`). */
Given('the support cat is set to {string} in the settings', async function (this: World, label: string) {
  await this.page.goto('/settings');
  const option = this.page.getByTestId('settings-support-cat').getByRole('button', { name: label, exact: true });
  await expect(option).toBeVisible();
  if ((await option.getAttribute('aria-pressed')) === 'true') return;
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await option.click();
  await expect(option).toHaveAttribute('aria-pressed', 'true');
  expect((await saved).status(), 'support cat setting saved').toBe(200);
});

Then('the support cat appears and is gone within {int} ms', async function (this: World, ms: number) {
  await expectEffectLifetime(this, CAT, ms);
});

Then('the support cat does not appear', async function (this: World) {
  this.extendTimeout(CAT_QUIET_MS);
  await this.page.waitForTimeout(CAT_QUIET_MS);
  const seen = (await rewardLog(this)).filter((e) => e.kind === CAT);
  expect(seen, 'support cat visits').toEqual([]);
});

/**
 * STEPS.md: the list's title element (the expanded view's title when that list is open, else its visible card title)
 * has `data-struck="true"` and a visible strike line (a `strike-line` element over it or `line-through` decoration).
 */
Then('the title of the task list {string} is struck through', async function (this: World, title: string) {
  const expanded = this.byTestId('tasklist-expanded', attr('data-title', title));
  const el = (await expanded.isVisible())
    ? expanded.getByTestId('tasklist-expanded-title')
    : this.taskCard(title).getByTestId('tasklist-card-title');
  await expect(el, 'title marked as struck through').toHaveAttribute('data-struck', 'true');
  const line = el.getByTestId('strike-line');
  if (await line.count()) {
    await expect(line, 'strike line over the title').toBeVisible();
    return;
  }
  const deco = await el.evaluate((e) => getComputedStyle(e).textDecorationLine);
  expect(deco, 'title text decoration').toContain('line-through');
});

// ---- The drag helper cat (STEPS.md "Drag helper cat") ----

const dragCat = (w: World) => w.page.locator('[data-testid="support-cat"][data-role="drag"]');

/** STEPS.md: pose `push-down` and the cat's box is above the dragged card's centre. */
Then('the support cat pushes the card from above', async function (this: World) {
  const cat = dragCat(this);
  await expect(cat).toHaveAttribute('data-pose', 'push-down');
  const centreY = async (sel: string) => {
    const b = (await this.page.locator(sel).first().boundingBox())!;
    return b.y + b.height / 2;
  };
  await expect
    .poll(async () => (await centreY('[data-testid="support-cat"][data-role="drag"]')) < (await centreY('[data-dragging="true"]')), { message: 'cat above the card centre' })
    .toBe(true);
});

Then('the support cat sits beside the card with a paw on it', async function (this: World) {
  await expect(dragCat(this)).toHaveAttribute('data-pose', 'wait');
});

/** The drag cat is removed at most `ms` after the drop (release time from the pick-up step, both native clock). */
Then('the support cat is gone within {int} ms', async function (this: World, ms: number) {
  this.extendTimeout(ms);
  const latest = async () => (await rewardLog(this)).filter((e) => e.kind === CAT).at(-1);
  await expect.poll(latest, { message: 'the support cat was there' }).toBeDefined();
  await expect.poll(async () => (await latest())?.removedAt, { message: 'the support cat is removed', timeout: ms + 2_000 }).toBeDefined();
  const dropAt = await this.page.evaluate(() => (window as unknown as { __dropAt?: number }).__dropAt);
  expect(dropAt, 'drop time recorded by the pick-up step').toBeDefined();
  expect((await latest())!.removedAt! - dropAt!, 'ms from drop until the cat is gone').toBeLessThanOrEqual(ms);
});
