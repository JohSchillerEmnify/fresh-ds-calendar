/** Minimum event length steps (feature min-event-length). */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { expectPositioned } from './support/grid.js';
import { box } from './support/ui.js';
import type { World } from './support/world.js';
import { settingControl } from './support/settings.js';

/** The view the scenario looked at, per scenario world. */
const looked = new WeakMap<World, string>();

Given('the minimum event length is {int} minutes', async function (this: World, minutes: number) {
  await this.api.patch('/api/prefs', { minEventMinutes: minutes });
});

Given('I am on the settings screen', async function (this: World) {
  await this.page.goto('/settings/views');
  await expect(this.page.getByTestId('settings-view')).toBeVisible();
});

When('I choose a minimum event length of {int} minutes', async function (this: World, minutes: number) {
  const saved = this.page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith('/api/prefs'));
  await (await settingControl(this, `settings-min-event-length-${minutes}`)).click();
  await saved;
});

Then(
  'the event {string} is positioned from {time} to {time} in the day view for {date}',
  async function (this: World, title: string, from: string, to: string, date: string) {
    await this.page.goto(`/day/${date}`);
    await this.settled();
    await expectPositioned(this, this.eventChip(title), from, to);
  },
);

/** Waits until the element's box stops changing: the wheel zoom commits its re-layout a moment after the last event, later on a slow machine. */
async function layoutRests(el: Locator) {
  let last = '';
  await expect.poll(async () => {
    const now = JSON.stringify(await el.evaluate((e) => e.getBoundingClientRect().toJSON()));
    const rest = now === last;
    last = now;
    return rest;
  }, { message: 'zoom layout rests', intervals: [300] }).toBe(true);
}

/** Opens `date` in one of the views that lay out time. */
async function look(w: World, view: string, date: string) {
  const at = async (path: string, ready: Locator) => {
    await w.page.goto(path);
    await expect(ready.first()).toBeVisible();
  };
  switch (view) {
    case 'day view': return at(`/day/${date}`, w.page.getByTestId('time-grid'));
    case 'week view': return at(`/week/${date}`, w.page.getByTestId('time-grid'));
    case 'two-row week overview':
      await w.api.patch('/api/prefs', { weekTwoRow: true });
      await w.page.setViewportSize({ width: 375, height: 812 });
      return at(`/week/${date}`, w.page.getByTestId('week-overview-row'));
    case 'Labs strip': return at(`/strip/${date}`, w.page.getByTestId('strip-column'));
    case 'Labs timeline': return at('/timeline', w.page.getByTestId('timeline-item'));
    case 'zoom month': {
      // the cells show the time grid only when zoomed in far enough
      await at(`/zoom/${date}`, w.page.getByTestId('zoom-cell'));
      const grid = w.page.locator(`[data-testid="zoom-cell"][data-date="${date}"] [data-testid="zoom-timeline"]`);
      // zoom about the day's own cell (Ctrl+wheel, as zoom-month.steps does), so the cell stays on screen
      const cell = w.page.locator(`[data-testid="zoom-cell"][data-date="${date}"]`);
      for (let i = 0; i < 150 && !(await grid.isVisible()); i++) {
        await cell.evaluate((el) => {
          const r = el.getBoundingClientRect();
          el.dispatchEvent(new WheelEvent('wheel', { deltaY: -20, ctrlKey: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true }));
        });
        await w.page.waitForTimeout(30);
      }
      await expect(grid).toBeVisible();
      // the zoom about the cell's middle (a slow machine zooms to the maximum) can leave the blocks off screen, up or left behind the rail: pan (plain wheel) to the middle
      await layoutRests(grid);
      await grid.evaluate(async (el) => {
        const port = el.closest('.port')!;
        const blocks = [...el.querySelectorAll('.blk')].map((b) => b.getBoundingClientRect());
        const pr = port.getBoundingClientRect();
        const mid = (Math.min(...blocks.map((r) => r.top)) + Math.max(...blocks.map((r) => r.bottom))) / 2;
        const midX = (Math.min(...blocks.map((r) => r.left)) + Math.max(...blocks.map((r) => r.right))) / 2;
        port.dispatchEvent(new WheelEvent('wheel', { deltaX: midX - (pr.left + pr.width / 2), deltaY: mid - (pr.top + pr.height / 2), bubbles: true, cancelable: true }));
      });
      return layoutRests(grid);
    }
    case 'Labs horizontal view': return at(`/horizontal/${date}`, w.page.getByTestId('htime-row'));
    default: throw new Error(`no way to look at the ${view} from a browser`);
  }
}

When(/^I look at (\d{4}-\d{2}-\d{2}) in the (.+)$/, async function (this: World, date: string, view: string) {
  looked.set(this, view);
  await look(this, view, date);
});

const TITLE = '[data-testid="event-chip-title"], [data-testid="tasklist-card-title"]';

/** Two blocks overlap along the time axis and neither hides the other's first title line (side by side or cascaded). */
async function expectOverlapLayout(w: World, a: Locator, b: Locator) {
  const [x, y] = [await box(a), await box(b)];
  // time runs down in every view but the horizontal one, where it runs across
  const across = looked.get(w) === 'Labs horizontal view';
  const [p0, p1, q0, q1] = across ? [x.x, x.x + x.width, y.x, y.x + y.width] : [x.y, x.y + x.height, y.y, y.y + y.height];
  expect(p0 < q1 && q0 < p1, 'they overlap in time').toBe(true);
  for (const block of [a, b]) {
    const title = block.locator(TITLE).first();
    await expect.poll(() => title.evaluate((el, sel) => {
      const r = el.getBoundingClientRect();
      // probe near the start of the title line, kept inside the viewport (a panned view may cut the block's left edge)
      const x = Math.min(Math.max(r.left + Math.min(8, r.width / 2), 2), window.innerWidth - 2);
      const top = document.elementFromPoint(x, r.top + Math.min(8, r.height / 2));
      return !!top && el.closest(sel)!.contains(top);
    }, '[data-testid="timeline-item"], [data-testid="event-chip"], [data-testid="tasklist-card"]'), 'title not covered').toBe(true);
  }
}

/** The visible block of an event in the view looked at (in the zoom month only its time grid counts, over the faded list). */
function block(w: World, title: string): Locator {
  const scope = looked.get(w) === 'zoom month' ? w.page.getByTestId('zoom-timeline') : w.page.locator(':root');
  return scope.locator(`[data-testid="event-chip"][data-title="${title}"]`).locator('visible=true').first();
}

Then('the events {string} and {string} are laid out as overlapping', async function (this: World, a: string, b: string) {
  await expectOverlapLayout(this, block(this, a), block(this, b));
});

Then('the task list {string} and the event {string} are laid out as overlapping', async function (this: World, list: string, event: string) {
  await expectOverlapLayout(this, this.taskCard(list), this.eventChip(event));
});

Then('opening the event {string} shows the time {string}', async function (this: World, title: string, time: string) {
  const [from, to] = time.split('–');
  await this.page.keyboard.press('Escape');
  await this.eventChip(title).click();
  const input = (id: string) => this.page.locator(`input[data-testid="${id}"], [data-testid="${id}"] input`).first();
  await expect(input('event-start-time')).toHaveValue(from);
  await expect(input('event-end-time')).toHaveValue(to);
});
