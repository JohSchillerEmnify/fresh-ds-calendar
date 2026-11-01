/** The month view that scrolls up and down (STEPS.md "Month view scrolling up and down", feature month-vertical). */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { box, chooseOption, selectedLabel, touchDrag } from './support/ui.js';
import { wheel } from './support/scroll.js';
import { attr, type World } from './support/world.js';

type Scroll = 'sideways' | 'vertical' | 'vertical-snap';
const MODES: Record<string, Scroll> = { Sideways: 'sideways', 'Up and down': 'vertical', 'Up and down, one month at a time': 'vertical-snap' };
const modeOf = (label: string): Scroll => {
  const v = MODES[label];
  if (!v) throw new Error(`Unknown month scrolling "${label}"`);
  return v;
};

const list = (w: World) => w.page.getByTestId('month-view');
const blocks = (w: World) => w.page.getByTestId('month-block');
const block = (w: World, month: string) => w.byTestId('month-block', attr('data-month', month));
const header = (w: World, text: string) => w.page.getByTestId('month-block-header').filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });
const weekdays = (w: World) => w.page.locator('[data-testid="month-view"] [role="row"]').first();
const scrollTop = (w: World) => list(w).evaluate((el) => el.scrollTop);

/** "the month view scrolls ..." as a Given sets the choice before the app is open; as a Then it checks the open month view. */
async function scrolls(w: World, mode: Scroll) {
  if (!w.page.url().startsWith('http')) {
    await w.api.patch('/api/prefs', { monthScroll: mode });
    return;
  }
  await expect(list(w)).toHaveAttribute('data-scroll', mode);
}
Given('the month view scrolls sideways', async function (this: World) { await scrolls(this, 'sideways'); });
Given('the month view scrolls up and down', async function (this: World) { await scrolls(this, 'vertical'); });
Given('the month view scrolls up and down one month at a time', async function (this: World) { await scrolls(this, 'vertical-snap'); });

When('I choose {string} as the month scrolling', async function (this: World, label: string) {
  modeOf(label);
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await chooseOption(this.page.getByTestId('settings-month-scroll'), label);
  expect((await saved).status(), 'choice saved').toBe(200);
});

Then('{string} is selected as the month scrolling', async function (this: World, label: string) {
  modeOf(label);
  await expect.poll(() => selectedLabel(this.page.getByTestId('settings-month-scroll'))).toBe(label);
});

Then('the month view shows only the month of {month}', async function (this: World, month: string) {
  // sideways has no list: its one month is named by the month view itself
  if (await blocks(this).count() === 0) {
    const [y, m] = month.split('-').map(Number);
    const name = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
    await expect(list(this)).toHaveAttribute('data-month', name);
    return;
  }
  await expect(blocks(this)).toHaveCount(1);
  await expect(block(this, month)).toHaveCount(1);
});

// --- where the months are --------------------------------------------------------------------------------------------

Then('the month header {string} is shown', async function (this: World, text: string) {
  await expect(header(this, text)).toBeInViewport();
});

Then('the month header {string} is shown below the month {month}', async function (this: World, text: string, month: string) {
  await expect(header(this, text)).toBeInViewport();
  const [h, m] = [await box(header(this, text)), await box(block(this, month))];
  expect(h.y, 'header below the month').toBeGreaterThanOrEqual(m.y + m.height - 1);
});

Then('the month {month} is below the month {month}', async function (this: World, lower: string, upper: string) {
  const [lo, up] = [await box(block(this, lower)), await box(block(this, upper))];
  expect(lo.y, `${lower} below ${upper}`).toBeGreaterThanOrEqual(up.y + up.height - 1);
});

Then('the month {month} is the month most in view', async function (this: World, month: string) {
  await expect.poll(() => list(this).evaluate((root) => {
    const view = root.getBoundingClientRect();
    let best = '', bestShare = -1;
    for (const b of root.querySelectorAll('[data-testid="month-block"]')) {
      const r = b.getBoundingClientRect();
      const share = Math.min(r.bottom, view.bottom) - Math.max(r.top, view.top);
      if (share > bestShare) { best = b.getAttribute('data-month')!; bestShare = share; }
    }
    return best;
  }), { message: 'month most in view' }).toBe(month);
});

Then('the day {date} is in view', async function (this: World, date: string) {
  await expect.poll(() => this.page.locator(`[data-testid="month-cell"]${attr('data-date', date)}`).evaluate((cell) => {
    const [c, v] = [cell.getBoundingClientRect(), document.querySelector('[data-testid="month-view"]')!.getBoundingClientRect()];
    return c.top >= v.top - 1 && c.bottom <= Math.min(v.bottom, innerHeight) + 1;
  }), { message: `${date} inside the calendar` }).toBe(true);
});

Then('the weekday row is pinned at the top of the calendar', async function (this: World) {
  await expect.poll(async () => (await box(weekdays(this))).y - (await box(list(this))).y).toBeCloseTo(0, 0);
});

// --- cells --------------------------------------------------------------------------------------------------------------

Then('the date {date} appears exactly once in the month view', async function (this: World, date: string) {
  await expect(this.page.locator(`[data-testid="month-cell"]${attr('data-date', date)}`)).toHaveCount(1);
});

/** The placeholder where `date` would be in a month block: its column in the block's last week row (a later month) or first (an earlier one). */
const placeholderOf = (w: World, month: string, date: string): Locator => {
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const rows = block(w, month).locator('.week');
  return (date.slice(0, 7) > month ? rows.last() : rows.first()).locator('[role="gridcell"]').nth(weekday);
};
Then('the day {date} is empty in the month {month}', async function (this: World, date: string, month: string) {
  await expect(placeholderOf(this, month, date)).toHaveAttribute('data-empty', 'true');
});

Then('no day is greyed in the month view', async function (this: World) {
  await expect(this.page.getByTestId('month-cell').first()).toBeVisible();
  await expect(this.page.locator('[data-testid="month-cell"][data-outside-month]')).toHaveCount(0);
});

Then('the day {date} is greyed in the month {month}', async function (this: World, date: string, month: string) {
  await expect(block(this, month).locator(`[data-testid="month-cell"]${attr('data-date', date)}`)).toHaveAttribute('data-outside-month', 'true');
});

When('I tap the day {date} in the month {month}', async function (this: World, date: string, month: string) {
  const number = block(this, month).locator(`[data-testid="month-cell"]${attr('data-date', date)}`).getByTestId('month-cell-day-number');
  if (this.testInfo.project.use.hasTouch) await this.page.waitForTimeout(1200); // a tap right after a scroll is dropped
  await number.click();
});

Then('every week of the month view is {int} pixels tall', async function (this: World, px: number) {
  await expect(blocks(this).first()).toBeVisible();
  const heights = await blocks(this).evaluateAll((els) => els.flatMap((b) => [...b.querySelectorAll('.week')].map((w) => Math.round(w.getBoundingClientRect().height))));
  expect(heights.length, 'week rows').toBeGreaterThan(0);
  expect([...new Set(heights)], 'week heights').toEqual([px]);
});

// --- scrolling ------------------------------------------------------------------------------------------------------------

let noted = 0;
When('I note the scroll position of the calendar', async function (this: World) {
  noted = await scrollTop(this);
});
Then('the calendar is at the noted scroll position', async function (this: World) {
  await expect.poll(() => scrollTop(this), { message: 'scroll position as noted' }).toBe(noted);
});

/** Waits until the list stops moving (a flick settles on its snap point). */
async function settled(w: World) {
  let last = -1, still = 0;
  await expect.poll(async () => {
    const now = await scrollTop(w);
    still = now === last ? still + 1 : 0;
    last = now;
    return still >= 4;
  }, { message: 'calendar settled', intervals: [60] }).toBe(true);
}

async function flick(w: World, dy: number) {
  const area = await box(list(w));
  const x = area.x + area.width / 2, y = area.y + area.height / 2;
  await touchDrag(w.page, { x, y: y - dy / 2 }, { x, y: y + dy / 2 }, { durationMs: 80, steps: 6 });
  await settled(w);
}
When('I flick the calendar up', async function (this: World) { await flick(this, -300); });
When('I flick the calendar down', async function (this: World) { await flick(this, 300); });

/** The header's top against the bottom of the pinned weekday row, in px. */
const gapBelowWeekdays = async (w: World, text: string) => (await box(header(w, text))).y - ((await box(weekdays(w))).y + (await box(weekdays(w))).height);
Then('the month header {string} is at the top of the calendar', async function (this: World, text: string) {
  await expect.poll(async () => Math.abs(await gapBelowWeekdays(this, text)) <= 1, { message: `${text} at the top` }).toBe(true);
});
Then('the month header {string} is not at the top of the calendar', async function (this: World, text: string) {
  await settled(this);
  const shown = await header(this, text).count();
  expect(shown === 0 || Math.abs(await gapBelowWeekdays(this, text)) > 1, `${text} not at the top`).toBe(true);
});

/** Scrolls the list until the header of `month` is at the top, as a person's swipe would end, then waits for the title and URL. */
When('I scroll the calendar to the month {month}', async function (this: World, month: string) {
  const root = list(this);
  for (let tries = 0; tries < 40 && (await block(this, month).count()) === 0; tries++) {
    // step towards the month by the distance in months of a typical height, until the list builds it
    const built = await blocks(this).evaluateAll((els) => els.map((e) => e.getAttribute('data-month')!));
    const diff = (a: string, b: string) => (Number(a.slice(0, 4)) - Number(b.slice(0, 4))) * 12 + Number(a.slice(5)) - Number(b.slice(5));
    const d = diff(month, built[Math.floor(built.length / 2)]);
    await root.evaluate((el, px) => { el.scrollTop += px; }, d * 450);
    await this.page.waitForTimeout(150);
  }
  await expect(block(this, month)).toHaveCount(1);
  await root.evaluate((el, m) => {
    const b = el.querySelector(`[data-testid="month-block"][data-month="${m}"]`)!.getBoundingClientRect();
    const wd = el.querySelector('[role="row"]')!.getBoundingClientRect();
    el.scrollTop += b.top - wd.bottom;
  }, month);
  const title = (await block(this, month).getByTestId('month-block-header').innerText()).trim();
  await expect(this.page.getByTestId('period-title')).toHaveText(title);
  await expect.poll(() => new URL(this.page.url()).pathname).toBe(`/month/${month}`);
});

When('I scroll the mouse wheel down by {int} pixels over the calendar', async function (this: World, px: number) {
  await wheel(this, px);
});

// --- what is built ------------------------------------------------------------------------------------------------------

Then('at most {int} months are built in the month view', async function (this: World, n: number) {
  await expect(blocks(this).first()).toBeVisible();
  expect(await blocks(this).count(), 'built months').toBeLessThanOrEqual(n);
});
Then('the month {month} is not built in the month view', async function (this: World, month: string) {
  await expect(block(this, month)).toHaveCount(0);
});
