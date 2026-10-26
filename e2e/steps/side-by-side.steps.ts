/** Events side by side steps (feature event-display, Rule "Overlapping entries sit side by side …", owner 2026-10-25). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { attr, tid, type World } from './support/world.js';

/** The pref that holds the limit of a view. */
const prefOf = (view: string) => (view === 'day' ? 'daySideBySide' : 'weekSideBySide');

/** Sets the limit of a view through the API. */
async function limit(w: World, view: string, n: number) {
  await w.api.patch('/api/prefs', { [prefOf(view)]: n });
}

/** Picks "Up to N" of a view on the settings screen and waits for the save. */
async function choose(w: World, view: string, n: number) {
  const saved = w.page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith('/api/prefs') && r.status() === 200);
  await w.page.getByTestId(`settings-${view}-side-by-side-${n}`).click();
  await saved;
}

/** Expects "Up to N" of a view to be the selected option on the settings screen. */
async function shows(w: World, view: string, n: number) {
  await expect(w.page.getByTestId(`settings-${view}-side-by-side-${n}`)).toHaveAttribute('aria-pressed', 'true');
}

Given('the day view shows up to {int} events side by side', async function (this: World, n: number) { await limit(this, 'day', n); });
Given('the week view shows up to {int} events side by side', async function (this: World, n: number) { await limit(this, 'week', n); });
When('I choose up to {int} events side by side in the day view', async function (this: World, n: number) { await choose(this, 'day', n); });
When('I choose up to {int} events side by side in the week view', async function (this: World, n: number) { await choose(this, 'week', n); });
Then('the settings show up to {int} events side by side in the day view', async function (this: World, n: number) { await shows(this, 'day', n); });
Then('the settings show up to {int} events side by side in the week view', async function (this: World, n: number) { await shows(this, 'week', n); });

Then('the entries {string} each take one of {int} equal columns', async function (this: World, list: string, n: number) {
  const titles = list.split(', ');
  // an entry is an event chip or a task list card with that title, whichever is shown
  const block = (title: string) =>
    this.page.locator(`${tid('event-chip')}${attr('data-title', title)}, ${tid('tasklist-card')}${attr('data-title', title)}`).locator('visible=true').first();
  for (const title of titles) await expect(block(title)).toBeVisible();
  const date = (await block(titles[0]).getAttribute('data-date'))!;
  await expect.poll(async () => {
    const col = (await this.dayColumn(date).boundingBox())!;
    const boxes = await Promise.all(titles.map(async (title) => (await block(title).boundingBox())!));
    const problems: string[] = [];
    boxes.forEach((b, i) => {
      if (Math.abs(b.width - col.width / n) > 4) problems.push(`${titles[i]} is ${Math.round(b.width)} px wide, not ${Math.round(col.width / n)}`);
      boxes.forEach((o, j) => {
        if (j <= i) return;
        const overlapX = b.x < o.x + o.width - 1 && o.x < b.x + b.width - 1;
        const overlapY = b.y < o.y + o.height && o.y < b.y + b.height;
        if (!overlapY) problems.push(`${titles[i]} and ${titles[j]} do not overlap in time`);
        if (overlapX) problems.push(`${titles[i]} and ${titles[j]} share a column`);
      });
    });
    return problems.join('; ');
  }).toBe('');
});

/** The border-box width, horizontal padding, border, title size and duration visibility of an event's time grid block. */
async function blockBox(w: World, title: string) {
  const chip = w.eventChip(title);
  await expect(chip).toBeVisible();
  return chip.evaluate((el) => {
    const s = getComputedStyle(el);
    const t = el.querySelector('[data-testid="event-chip-title"]');
    const dur = el.querySelector('.dur');
    return {
      left: s.paddingLeft, right: s.paddingRight, width: el.getBoundingClientRect().width, font: t ? getComputedStyle(t).fontSize : '',
      border: (parseFloat(s.borderLeftWidth) || 0) + (parseFloat(s.borderRightWidth) || 0),
      durShown: !!dur && getComputedStyle(dur).display !== 'none',
    };
  });
}

Given('the entries are drawn {string}', async function (this: World, entries: string) {
  await this.api.patch('/api/prefs/theme', { overrides: { entries } });
});

Then('the event {string} has a {int} px entry border', async function (this: World, title: string, px: number) {
  await expect.poll(async () => (await blockBox(this, title)).border).toBe(px);
});

Then('the event {string} has the narrow block padding', async function (this: World, title: string) {
  await expect.poll(async () => {
    const b = await blockBox(this, title);
    return b.width <= 84 ? `${b.left} ${b.right} ${b.font}${b.durShown ? ' with duration' : ''}` : `wide: ${b.width}`;
  }).toBe('3px 2px 11px');
});

Then('the event {string} has the normal block padding', async function (this: World, title: string) {
  await expect.poll(async () => {
    const b = await blockBox(this, title);
    return b.width > 84 ? `${b.left} ${b.right} ${b.font}` : `narrow: ${b.width}`;
  }).toBe('6px 5px 13px');
});

Then('the event {string} stays inside its day column', async function (this: World, title: string) {
  const chip = this.eventChip(title);
  const date = (await chip.getAttribute('data-date'))!;
  await expect.poll(async () => {
    const [c, col] = [(await chip.boundingBox())!, (await this.dayColumn(date).boundingBox())!];
    const over = c.x + c.width - (col.x + col.width), under = col.x - c.x;
    return over <= 0.5 && under <= 0.5 ? 'inside' : `${over.toFixed(2)} px past the right edge, ${under.toFixed(2)} px past the left`;
  }).toBe('inside');
});
