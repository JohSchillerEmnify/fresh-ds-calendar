/** Calendar off by a plan (STEPS.md "Calendar off by a plan", feature calendar-off-plan). */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { isTouchScreen, touchDrag } from './support/ui.js';
import { attr, type World } from './support/world.js';
import { openSettingsPage } from './support/settings.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const chip = (world: World, name: string) => world.byTestId('filter-chip-calendar', attr('data-name', name));
const sheet = (world: World) => world.page.getByTestId('calendar-plan-sheet');

/** Holds a finger (or the mouse) on the element for 700 ms without moving: the app's long press is 500 ms. */
async function longPress(world: World, target: Locator) {
  await expect(target).toBeVisible();
  // the filter bar scrolls sideways: the chip may sit past the screen edge
  await target.scrollIntoViewIfNeeded();
  const b = (await target.boundingBox())!;
  const at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  if (await isTouchScreen(world.page)) {
    await touchDrag(world.page, at, at, { holdMs: 700, steps: 1, durationMs: 0 });
  } else {
    await world.page.mouse.move(at.x, at.y);
    await world.page.mouse.down();
    await world.page.waitForTimeout(700);
    await world.page.mouse.up();
  }
  await expect(sheet(world)).toBeVisible();
}

/** Replaces the calendar's plan through the API, as the app saves it. */
async function setPlan(world: World, name: string, plan: Record<string, unknown>) {
  const id = await world.api.calendarId(name);
  const cur = (await (await world.page.request.get('/api/prefs')).json()) as { calendarPlans?: Record<string, Record<string, unknown>> };
  await world.api.patch('/api/prefs', { calendarPlans: { ...cur.calendarPlans, [id]: { ...cur.calendarPlans?.[id], ...plan } } });
}

When('I long-press the calendar chip {string}', async function (this: World, name: string) {
  await longPress(this, chip(this, name));
});

When('I tap the calendar chip {string}', async function (this: World, name: string) {
  await chip(this, name).click();
});

When('I long-press the calendar {string} in the side menu', async function (this: World, name: string) {
  await longPress(this, this.byTestId('side-menu-calendar', attr('data-name', name)));
});

When('I open the plan of the calendar {string} in the settings', async function (this: World, name: string) {
  // the plan is a row of the calendar's own page in Settings › Calendars (feature settings-groups)
  await openSettingsPage(this, 'calendars');
  await this.page.locator(`[data-testid="settings-row"][data-setting="${name}"]`).click();
  await this.page.locator('[data-setting-id="plan"]').click();
  await expect(sheet(this)).toBeVisible();
});

When('I choose {string} in the calendar sheet', async function (this: World, label: string) {
  const s = sheet(this);
  const sw = s.getByRole('switch', { name: label, exact: true });
  if (await sw.count()) {
    if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    return;
  }
  const button = s.getByRole('button', { name: label, exact: true });
  if (label !== 'Done') return button.click();
  const saved = this.page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith('/api/prefs') && r.status() === 200);
  await button.click();
  await saved;
  await expect(s).toBeHidden();
});

When('I pick the date {date} in the calendar sheet', async function (this: World, date: string) {
  await sheet(this).getByTestId('calendar-plan-until').fill(date);
});

When(
  'I set the off time from {string} {time} to {string} {time} in the calendar sheet',
  async function (this: World, fromDay: string, fromTime: string, toDay: string, toTime: string) {
    const s = sheet(this);
    await s.getByTestId('calendar-plan-from-day').selectOption(fromDay);
    await s.getByTestId('calendar-plan-from-time').fill(fromTime);
    await s.getByTestId('calendar-plan-to-day').selectOption(toDay);
    await s.getByTestId('calendar-plan-to-time').fill(toTime);
  },
);

Given(
  'the calendar {string} is off every week from {string} {time} to {string} {time}',
  async function (this: World, name: string, fromDay: string, fromTime: string, toDay: string, toTime: string) {
    await setPlan(this, name, { windows: [{ from: { day: DAYS.indexOf(fromDay), time: fromTime }, to: { day: DAYS.indexOf(toDay), time: toTime } }] });
  },
);

Given('the calendar {string} is off until {date}', async function (this: World, name: string, date: string) {
  await setPlan(this, name, { until: date });
});

Then('the calendar chip {string} is on', async function (this: World, name: string) {
  await expect(chip(this, name)).toHaveAttribute('aria-pressed', 'true');
});

Then('the calendar chip {string} is off', async function (this: World, name: string) {
  await expect(chip(this, name)).toHaveAttribute('aria-pressed', 'false');
});

Then('the calendar chip {string} shows {string}', async function (this: World, name: string, text: string) {
  await expect(chip(this, name)).toContainText(text);
});

Then('the calendar chip {string} shows that it switches by itself', async function (this: World, name: string) {
  await expect(chip(this, name).getByTestId('calendar-plan-mark')).toHaveCount(1);
});

Then('the calendar chip {string} does not show that it switches by itself', async function (this: World, name: string) {
  await expect(chip(this, name).getByTestId('calendar-plan-mark')).toHaveCount(0);
});
