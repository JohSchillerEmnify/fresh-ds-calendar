/** Labs steps used by labs-clock.feature (STEPS.md "Labs"): the Labs switch and the 24-hour clock view. */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { exactText, tid, type World } from './support/world.js';
import { turnOnLabsSwitch } from './support/ui.js';

When('I turn on experimental views in the settings', async function (this: World) {
  await turnOnLabsSwitch(this.page, 'settings-labs');
});

Then(
  'the view switcher offers {string}, {string} and {string} marked as experimental',
  async function (this: World, a: string, b: string, c: string) {
    for (const label of [a, b, c]) {
      const entry = this.page.getByTestId(`view-switch-${label.toLowerCase()}`);
      await expect(entry).toBeVisible();
      await expect(entry).toContainText(label);
      await expect(entry).toHaveAttribute('data-experimental', 'true');
    }
  },
);

When('I open the clock view for {date}', async function (this: World, date: string) {
  await this.page.goto(`/clock/${date}`);
  await expect(this.page.getByTestId('clock-view')).toBeVisible();
});

/** Expects exactly one clock arc of that kind and title, spanning `start` to `end` (HH:MM). */
async function expectArc(world: World, kind: 'event' | 'tasklist', title: string, start: string, end: string) {
  const arc = world.page.locator(tid('clock-arc') + `[data-kind="${kind}"][data-title="${title}"]`);
  await expect(arc).toHaveCount(1);
  await expect(arc).toHaveAttribute('data-start', start);
  await expect(arc).toHaveAttribute('data-end', end);
}

Then(
  'the event {string} is an arc from {time} to {time}',
  async function (this: World, title: string, start: string, end: string) {
    await expectArc(this, 'event', title, start, end);
  },
);

Then(
  'the task list {string} is an arc from {time} to {time}',
  async function (this: World, title: string, start: string, end: string) {
    await expectArc(this, 'tasklist', title, start, end);
  },
);

Then('the middle of the clock lists {string}', async function (this: World, text: string) {
  const entry = this.page.locator(tid('clock-untimed')).filter({ hasText: exactText(text) });
  await expect(entry).toHaveCount(1);
  await expect(entry).toBeVisible();
});

Then('the clock fills the available space', async function (this: World) {
  const view = this.page.getByTestId('clock-view'), dial = this.page.getByTestId('clock-dial');
  await expect.poll(async () => {
    const [v, d] = [await view.boundingBox(), await dial.boundingBox()];
    if (!v || !d) return 'not laid out';
    const fits = d.x >= v.x - 1 && d.y >= v.y - 1 && d.x + d.width <= v.x + v.width + 1 && d.y + d.height <= v.y + v.height + 1;
    const share = d.width / Math.min(v.width, v.height);
    return fits && share >= 0.9 ? 'fills' : `diameter ${Math.round(d.width)} of ${Math.round(Math.min(v.width, v.height))} (inside: ${fits})`;
  }).toBe('fills');
});

Then('the clock hand points at {time}', async function (this: World, time: string) {
  await expect(this.page.getByTestId('clock-hand')).toHaveAttribute('data-time', time);
});

Then('the arc of {string} is labelled {string}', async function (this: World, title: string, label: string) {
  const text = this.page.locator(tid('clock-label') + `[data-title="${title}"]`);
  await expect(text).toHaveCount(1);
  await expect(text).toBeVisible();
  await expect(text).toHaveText(label);
});
