/** Bedtime mode steps (STEPS.md "Bedtime"): the night band in every timeline-type view and the reminder. */
import { expect } from '@playwright/test';
import { Given, Then } from './fixtures.js';
import type { World } from './support/world.js';

const bands = (w: World) => w.page.getByTestId('bedtime-band');

Given('bedtime mode is on with fixed times {time} and {time}', async function (this: World, bedtime: string, wake: string) {
  await this.api.patch('/api/prefs', { bedtime: { enabled: true, mode: 'fixed', bedtime, wake } });
});

Given(
  'bedtime mode is on with fixed times {time} and {time}, and {time} and {time} on weekends',
  async function (this: World, bedtime: string, wake: string, weekendBedtime: string, weekendWake: string) {
    await this.api.patch('/api/prefs', { bedtime: { enabled: true, mode: 'fixed', bedtime, wake, weekendDifferent: true, weekendBedtime, weekendWake } });
  },
);

Given(
  'bedtime mode is on based on my first appointment with {int} hours of sleep and {int} minutes of lead time',
  async function (this: World, hours: number, minutes: number) {
    await this.api.patch('/api/prefs', { bedtime: { enabled: true, mode: 'dynamic', sleepMinutes: hours * 60, leadMinutes: minutes } });
  },
);

/** Opens the app once so this device shows (and remembers) tonight's reminder, as a person saw it earlier. */
Given("this device has already shown tonight's bedtime reminder", async function (this: World) {
  await this.page.goto('/');
  await expect(this.page.getByTestId('bedtime-reminder')).toBeVisible();
});

Then('the night bands of {date} are {string}', async function (this: World, date: string, expected: string) {
  // pieces of that day in document order, as "start-end"
  await expect.poll(async () => (await bands(this).and(this.page.locator(`[data-date="${date}"]`)).evaluateAll(
    (els) => els.map((e) => `${e.getAttribute('data-start')}-${e.getAttribute('data-end')}`),
  )).join(', ')).toBe(expected);
});

Then('the bedtime moons of {date} are {string}', async function (this: World, date: string, expected: string) {
  // moons drawn on that day in document order, as their time within the day
  await expect.poll(async () => (await this.page.getByTestId('bedtime-moon').and(this.page.locator(`[data-date="${date}"]`)).evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-at')),
  )).join(', ')).toBe(expected);
});

Then('the night band runs from {date} {time} to {date} {time}', async function (this: World, d1: string, t1: string, d2: string, t2: string) {
  await expect(bands(this).and(this.page.locator(`[data-from="${d1} ${t1}"][data-to="${d2} ${t2}"]`)).first()).toBeAttached();
});

Then('no night band is shown', async function (this: World) {
  // let the app load first, then neither the grid nor the track has a band
  await this.settled();
  await expect(bands(this)).toHaveCount(0);
  await expect(this.page.getByTestId('bedtime-track-band')).toHaveCount(0);
});

Then('the approach bar shows a night band', async function (this: World) {
  await expect(this.page.getByTestId('now-card').getByTestId('approach-bar').getByTestId('bedtime-track-band').first()).toBeAttached();
});

Then('I see the bedtime reminder {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('bedtime-reminder').getByTestId('snackbar-text')).toHaveText(text);
});

Then('I do not see a bedtime reminder', async function (this: World) {
  await expect(this.page.getByTestId('bedtime-reminder')).toHaveCount(0);
});
