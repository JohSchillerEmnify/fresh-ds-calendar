/** Timeline, Now card and transition warning steps (STEPS.md "Timeline and Now card"). */
import { expect, type Locator } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { minutesOf } from './support/dates.js';
import { box, expectInViewport } from './support/ui.js';
import type { World } from './support/world.js';

async function heightOf(world: World, title: string): Promise<number> {
  return (await box(world.eventChip(title))).height;
}

Then(
  'the event {string} is about {int} times as tall as the event {string}',
  async function (this: World, big: string, times: number, small: string) {
    const ratio = (await heightOf(this, big)) / (await heightOf(this, small));
    expect(ratio, `height ratio ${big}/${small}`).toBeGreaterThanOrEqual(times * 0.9);
    expect(ratio, `height ratio ${big}/${small}`).toBeLessThanOrEqual(times * 1.1);
  },
);

Then('the event {string} is at least {int} pixels tall', async function (this: World, title: string, px: number) {
  expect(await heightOf(this, title)).toBeGreaterThanOrEqual(px - 0.5);
});

const marker = (w: World) => w.page.getByTestId('now-marker');
/** The time-grid day column that contains the now marker. */
const markerColumn = (w: World): Locator =>
  marker(w).locator('xpath=ancestor::*[@data-testid="week-day-column" or @data-testid="day-column"][1]');

async function hourHeight(w: World): Promise<number> {
  const grid = w.page.getByTestId('time-grid').first();
  await expect(grid).toHaveAttribute('data-hour-height', /\d/);
  return Number(await grid.getAttribute('data-hour-height'));
}

Then('the now marker is positioned at {time}', async function (this: World, time: string) {
  await expect(marker(this)).toHaveAttribute('data-time', time);
  const hh = await hourHeight(this);
  await expect
    .poll(async () => {
      const col = await markerColumn(this).boundingBox();
      const m = await marker(this).boundingBox();
      if (!col || !m) return 'marker or column not visible';
      const want = col.y + (minutesOf(time) / 60) * hh;
      // The marker may be a line with a dot: accept its top or its centre.
      const off = Math.min(Math.abs(m.y - want), Math.abs(m.y + m.height / 2 - want));
      return off <= 3 ? 'ok' : `marker y ${m.y.toFixed(1)} != expected ${want.toFixed(1)}`;
    })
    .toBe('ok');
});

Then('the now marker is in the column of {date}', async function (this: World, date: string) {
  await expect(marker(this)).toBeVisible();
  await expect(markerColumn(this)).toHaveAttribute('data-date', date);
});

Then('I do not see the now marker', async function (this: World) {
  await this.settled();
  await expect(marker(this)).toHaveCount(0);
});

Then('the now marker is visible on screen', async function (this: World) {
  await expect(marker(this)).toBeVisible();
  await expectInViewport(this.page, marker(this));
});

Then('the time grid is scrolled to show {time} at the top', async function (this: World, time: string) {
  const hh = await hourHeight(this);
  const want = (minutesOf(time) / 60) * hh;
  await expect
    .poll(async () => {
      // time-grid itself, or its nearest scrollable ancestor, whichever actually scrolls.
      const top = await this.page.getByTestId('time-grid').first().evaluate((el) => {
        for (let e: Element | null = el; e; e = e.parentElement) {
          if (e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== 'visible') return e.scrollTop;
        }
        return 0;
      });
      return Math.abs(top - want) <= hh / 4 ? 'ok' : `scrollTop ${top} != ${want} (+-${hh / 4})`;
    })
    .toBe('ok');
});

const nowCard = (w: World) => w.page.getByTestId('now-card');

Then('the now card shows the line {string}', async function (this: World, line: string) {
  await expect(nowCard(this)).toBeVisible();
  await expect
    .poll(async () =>
      (await nowCard(this).getByTestId('now-card-line').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()),
    )
    .toContain(line);
});

Then('the now card does not show a current event', async function (this: World) {
  await expect(nowCard(this)).toBeVisible();
  await expect(nowCard(this).getByTestId('now-card-current')).toHaveCount(0);
});

Then('the current event progress is {int} percent', async function (this: World, percent: number) {
  await expect(nowCard(this).getByTestId('now-progress')).toHaveAttribute('aria-valuenow', String(percent));
});

Then('I do not see the now card', async function (this: World) {
  await this.settled();
  await expect(nowCard(this)).toHaveCount(0);
});

const warning = (w: World) => w.page.getByTestId('transition-warning');

Then('I see the transition warning {string}', async function (this: World, text: string) {
  await expect(warning(this)).toContainText(text);
});

Then('I do not see a transition warning', async function (this: World) {
  await this.settled();
  await expect(warning(this)).toHaveCount(0);
});

When('I dismiss the transition warning', async function (this: World) {
  await this.page.getByTestId('transition-warning-dismiss').click();
});
