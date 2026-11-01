/** Release notes steps (STEPS.md "Release notes"). */
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures.js';
import type { World } from './support/world.js';
import { settingControl } from './support/settings.js';

Given('the release notes are:', async function (this: World, table: DataTable) {
  await this.api.post('/api/__test/release-notes', { notes: table.hashes().map((r) => ({ date: r.date, text: r.text })) });
});

When('I open What\'s new', async function (this: World) {
  await (await settingControl(this, 'settings-whats-new')).click();
  await expect(this.page.getByTestId('whats-new')).toBeVisible();
});

Then('What\'s new shows the days {string}', async function (this: World, days: string) {
  const days$ = this.page.getByTestId('whats-new').getByTestId('whats-new-day');
  await expect.poll(async () => (await days$.evaluateAll((els) => els.map((e) => e.getAttribute('data-date')))).join(', ')).toBe(days);
});

Then('What\'s new shows {string} under {date}', async function (this: World, text: string, date: string) {
  const day = this.page.getByTestId('whats-new').locator(`[data-testid="whats-new-day"][data-date="${date}"]`);
  await expect(day.getByTestId('whats-new-item').filter({ hasText: text })).toBeVisible();
});

Given('this device last ran an older version and has seen the notes up to {date}', async function (this: World, date: string) {
  const { notes } = await this.api.get<{ notes: { id: string; date: string }[] }>('/api/release-notes');
  const seen = notes.find((n) => n.date <= date); // newest first: the first one dated D or earlier is the newest of them
  // set only once: a reload must see what the app stored since (the dismissal), not the old device state again
  await this.context.addInitScript(([id]) => {
    try {
      if (localStorage.getItem('cal.lastVersion') !== null) return;
      localStorage.setItem('cal.lastVersion', '0.0.1');
      if (id) localStorage.setItem('cal.notesSeen', id);
    } catch { /* storage unavailable */ }
  }, [seen?.id]);
});

Then('I am told what is new: {string} and {int} more', async function (this: World, text: string, more: number) {
  const note = this.page.getByTestId('whats-new-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText(text);
  await expect(note).toContainText(`+${more} more`);
});

When('I dismiss the release note', async function (this: World) {
  await this.page.getByTestId('whats-new-dismiss').click();
  await expect(this.page.getByTestId('whats-new-note')).toBeHidden();
});

When('I choose What\'s new in the release note', async function (this: World) {
  await this.page.getByTestId('whats-new-open').click();
});

Then('I am not told what is new', async function (this: World) {
  await this.settled();
  // the note would show right after the first load; give it 2 s
  await this.page.waitForTimeout(2000);
  await expect(this.page.getByTestId('whats-new-note')).toHaveCount(0);
});

When('I reload the app', async function (this: World) {
  await this.page.reload();
  await this.settled();
});
