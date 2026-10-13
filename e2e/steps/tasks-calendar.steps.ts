/**
 * Tasks calendar steps (STEPS.md "Tasks calendar"): task lists live in the person's hidden "Calendar app: tasks"
 * calendar of the (mock) Google account, which the app finds or creates and never offers as an event calendar.
 */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import type { GoogleEvent, RemoteCalendar } from './support/api.js';
import { attr, type World } from './support/world.js';

/** The calendar list entries with this summary. */
async function calendarsNamed(world: World, summary: string): Promise<RemoteCalendar[]> {
  return (await world.api.remoteCalendars()).filter((c) => c.summary === summary);
}

/** Confirmed events with this summary in one calendar of the mock account. */
async function eventsIn(world: World, calendarId: string, summary: string): Promise<GoogleEvent[]> {
  const qs = `calendarId=${encodeURIComponent(calendarId)}&q=${encodeURIComponent(summary)}`;
  const { items } = await world.api.get<{ items: GoogleEvent[] }>(`/api/__test/remote/events?${qs}`);
  return items.filter((e) => e.status !== 'cancelled');
}

When(
  'I create the task list {string} on {date} with the item {string}',
  async function (this: World, title: string, date: string, item: string) {
    if (!this.page.url().startsWith('http')) {
      await this.page.goto(`/week/${date}`);
      await this.calendarShown();
    }
    await this.page.getByTestId('create-button').click();
    await this.page.getByTestId('new-kind-tasklist').click();
    const dialog = this.page.getByTestId('tasklist-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByTestId('tasklist-title').fill(title);
    await dialog.getByTestId('tasklist-date').fill(date);
    await dialog.getByTestId('tasklist-items').fill(item);
    const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/tasklists' && r.request().method() === 'POST');
    await dialog.getByTestId('tasklist-save').click();
    expect((await saved).status(), 'task list saved').toBe(201);
  },
);

Given('Google has a hidden calendar {string}', async function (this: World, summary: string) {
  await this.api.remoteInsertCalendar(summary, true);
});

Then('Google has a hidden calendar {string} with the event {string}', async function (this: World, summary: string, title: string) {
  await expect
    .poll(async () => {
      const cals = await calendarsNamed(this, summary);
      if (cals.length !== 1) return `${cals.length} calendars "${summary}"`;
      if (cals[0].hidden !== true) return `calendar "${summary}" is not hidden`;
      const evs = await eventsIn(this, cals[0].id, title);
      return evs.length === 1 ? 'ok' : `${evs.length} events "${title}" in "${summary}"`;
    })
    .toBe('ok');
});

Then('the main calendar has no event {string}', async function (this: World, title: string) {
  const main = (await this.api.remoteCalendars()).find((c) => c.primary);
  if (!main) throw new Error('The mock account has no primary calendar');
  await expect.poll(async () => (await eventsIn(this, main.id, title)).length).toBe(0);
});

Then('Google has exactly one calendar {string}', async function (this: World, summary: string) {
  await expect.poll(async () => (await calendarsNamed(this, summary)).length).toBe(1);
});

Then('the filter bar does not offer the calendar {string}', async function (this: World, name: string) {
  const bar = this.page.getByTestId('filter-bar');
  await expect(bar).toBeVisible();
  await this.settled();
  await expect(bar.getByTestId('filter-chip-calendar')).not.toHaveCount(0);
  await expect(this.byTestId('filter-chip-calendar', attr('data-name', name))).toHaveCount(0);
});

When('I turn on {string} in the settings', async function (this: World, label: string) {
  if (!this.page.url().startsWith('http')) {
    await this.page.goto('/');
    await this.calendarShown();
  }
  // The settings may already be open (e.g. after "I open the settings").
  if (!(await this.page.getByTestId('settings-view').isVisible())) await this.page.getByTestId('settings-button').click();
  const control = this.page.getByTestId('settings-view').getByRole('switch', { name: label, exact: true });
  await expect(control).toBeVisible();
  if ((await control.getAttribute('aria-checked')) !== 'true') {
    const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
    await control.click();
    expect((await saved).status(), 'prefs saved').toBe(200);
  }
  await expect(control).toHaveAttribute('aria-checked', 'true');
});

Then('Google shows the calendar {string}', async function (this: World, summary: string) {
  await expect
    .poll(async () => (await calendarsNamed(this, summary)).map((c) => c.hidden === true ? 'hidden' : 'shown').join(','))
    .toBe('shown');
});
