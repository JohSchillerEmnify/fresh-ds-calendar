/** Steps of spec/features/views/item-search.feature (STEPS.md "Item search"): the search sheet, its results and the search beyond the device. */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { addDays, berlinIso } from './support/dates.js';
import { attr, tid, type World } from './support/world.js';

const sheet = (w: World) => w.byTestId('item-search');
const list = (w: World) => w.byTestId('item-search-list');
const results = (w: World) => w.byTestId('item-search-result');
const result = (w: World, title: string) => w.page.locator(`${tid('item-search-result')}${attr('data-title', title)}`);
const beyond = (w: World) => w.byTestId('item-search-beyond');

// --- the top bar and the sheet ---------------------------------------------------------------------------------

Then('the top bar shows the search button', async function (this: World) {
  await expect(this.byTestId('top-bar').getByTestId('search-button')).toBeVisible();
});

Then('the search button is right after the date and before the Today button', async function (this: World) {
  const box = async (id: string) => (await this.byTestId('top-bar').getByTestId(id).boundingBox())!;
  // the drawn icon counts, not the button's transparent tap border (which may overlap its neighbours)
  const icon = (await this.byTestId('top-bar').getByTestId('search-button').locator('svg').boundingBox())!;
  const [date, search, today] = [await box('period-title'), await box('search-button'), await box('nav-today')];
  expect(icon.x, 'search icon after the date').toBeGreaterThanOrEqual(date.x + date.width - 1);
  expect(icon.x - (date.x + date.width), 'search icon right next to the date').toBeLessThanOrEqual(16);
  expect(today.x, 'Today after search').toBeGreaterThanOrEqual(search.x + search.width - 1);
  // no other control of the bar sits between the date and Today
  const between = await this.byTestId('top-bar').locator('button, a, [role="button"]').evaluateAll((els, [from, to]) => els.filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && r.left >= from! && r.right <= to! && !e.matches('[data-testid="search-button"]');
  }).length, [date.x + date.width, today.x]);
  expect(between, 'controls between the date and Today besides the search button').toBe(0);
});

Then('the top bar shows no search button', async function (this: World) {
  await expect(this.byTestId('top-bar')).toBeVisible();
  await expect(this.byTestId('top-bar').getByTestId('search-button')).toHaveCount(0);
});

Then('the side menu has the search row at its top', async function (this: World) {
  const menu = this.byTestId('side-menu');
  await expect(menu.getByTestId('side-menu-search')).toBeVisible();
  const ids = await menu.locator('[data-testid="side-menu-search"], [data-testid^="side-menu-view-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(ids[0], 'first entry of the menu').toBe('side-menu-search');
});

When('I choose the search row in the side menu', async function (this: World) {
  await this.byTestId('side-menu').getByTestId('side-menu-search').click();
});

When('I open the item search', async function (this: World) {
  await this.byTestId('search-button').click();
  await expect(sheet(this)).toBeVisible();
});

Then('the item search is open', async function (this: World) {
  await expect(sheet(this)).toBeVisible();
});

Then('the item search is closed', async function (this: World) {
  await expect(sheet(this)).toHaveCount(0);
});

Then('the item search is shown as a bottom sheet', async function (this: World) {
  await expect(sheet(this)).toHaveAttribute('data-presentation', 'sheet');
});

Then('the item search is shown as a dialog', async function (this: World) {
  await expect(sheet(this)).toHaveAttribute('data-presentation', 'modal');
});

// --- typing ----------------------------------------------------------------------------------------------------

When('I search the items for {string}', async function (this: World, text: string) {
  await this.byTestId('item-search-input').fill(text);
  await expect(list(this)).toHaveAttribute('data-query', text.trim());
});

When('I clear the item search', async function (this: World) {
  await this.byTestId('search-clear').click();
});

/** Types the query in the page itself and says how long the list took to show results (or the empty note) for it. */
When('I search the items for {string} and the results appear within {int} ms', async function (this: World, text: string, ms: number) {
  const took = await this.page.evaluate(async (q) => {
    const input = document.querySelector<HTMLInputElement>('[data-testid="item-search-input"]')!;
    const ready = () => {
      const l = document.querySelector('[data-testid="item-search-list"]');
      return l?.getAttribute('data-query') === q && (l.querySelector('[data-testid="item-search-result"]') || l.querySelector('[data-testid="item-search-empty"]'));
    };
    const t0 = performance.now();
    input.value = q;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    while (!ready()) await new Promise((r) => requestAnimationFrame(r));
    return performance.now() - t0;
  }, text);
  this.testInfo.annotations.push({ type: `results for "${text}"`, description: `${Math.round(took)} ms` });
  expect(took, `results for "${text}" (ms)`).toBeLessThanOrEqual(ms);
});

When('I open and close the item search {int} times', async function (this: World, n: number) {
  this.extendTimeout(n * 1_000);
  for (let i = 0; i < n; i++) {
    await this.byTestId('search-button').click();
    await expect(sheet(this)).toBeVisible();
    await this.page.keyboard.press('Escape');
    await expect(sheet(this)).toHaveCount(0);
  }
});

// --- results ---------------------------------------------------------------------------------------------------

Then('the item search shows the event {string} on {date}', async function (this: World, title: string, date: string) {
  await expect(this.page.locator(`${tid('item-search-result')}[data-kind="event"]${attr('data-title', title)}${attr('data-date', date)}`).first()).toBeVisible();
});

Then('the item search shows the task list {string} on {date}', async function (this: World, title: string, date: string) {
  await expect(this.page.locator(`${tid('item-search-result')}[data-kind="tasklist"]${attr('data-title', title)}${attr('data-date', date)}`).first()).toBeVisible();
});

Then('the item search shows the undated task list {string}', async function (this: World, title: string) {
  await expect(this.page.locator(`${tid('item-search-result')}[data-kind="tasklist"]${attr('data-title', title)}:not([data-date])`).first()).toBeVisible();
});

Then('the item search shows the shared task list {string}', async function (this: World, title: string) {
  await expect(this.page.locator(`${tid('item-search-result')}[data-kind="tasklist"]${attr('data-title', title)}[data-shared]`).first()).toBeVisible();
});

Then('the item search shows the item {string} of the task list {string}', async function (this: World, item: string, title: string) {
  await expect(this.page.locator(`${tid('item-search-result')}[data-kind="tasklist"]${attr('data-title', title)}${attr('data-item', item)}`).first()).toBeVisible();
});

Then('the item search shows {int} result(s)', async function (this: World, n: number) {
  await expect(results(this)).toHaveCount(n);
});

Then('the item search shows at most {int} results', async function (this: World, n: number) {
  await expect(results(this).first()).toBeVisible();
  expect(await results(this).count(), 'rows drawn').toBeLessThanOrEqual(n);
});

Then('the item search shows more than {int} results', async function (this: World, n: number) {
  await expect.poll(() => results(this).count()).toBeGreaterThan(n);
});

Then('the item search lists {string}', async function (this: World, labels: string) {
  // an entry that names a date ("Run on 2026-11-30") is compared with its date, one that does not by its title only
  const wanted = labels.split(', ');
  await expect.poll(async () => {
    const rows = await results(this).evaluateAll((els) => els.map((e) => [e.getAttribute('data-title') ?? '', e.getAttribute('data-date')]));
    return rows.map(([title, date], i) => (/ on \d{4}-\d\d-\d\d$/.test(wanted[i] ?? '') && date ? `${title} on ${date}` : title)).join(', ');
  }).toBe(labels);
});

Then('the item search says nothing matches {string}', async function (this: World, q: string) {
  await expect(results(this)).toHaveCount(0);
  await expect(this.byTestId('item-search-empty')).toContainText(q);
});

Then('the item search says it covers {date} to {date}', async function (this: World, from: string, to: string) {
  const reach = this.byTestId('item-search-reach');
  await expect(reach).toHaveAttribute('data-from', from);
  await expect(reach).toHaveAttribute('data-to', to);
});

When('I choose the item search result {string}', async function (this: World, title: string) {
  await result(this, title).first().click();
});

Then('the item search marks the result {string} as hidden', async function (this: World, title: string) {
  await expect(this.page.locator(`${tid('item-search-result')}${attr('data-title', title)}[data-hidden]`).first()).toBeVisible();
});

Then('the item search does not mark the result {string} as hidden', async function (this: World, title: string) {
  const row = this.page.locator(`${tid('item-search-result')}${attr('data-title', title)}`).first();
  await expect(row).toBeVisible();
  await expect(row).not.toHaveAttribute('data-hidden', /.*/);
});

// --- the search beyond the device --------------------------------------------------------------------------------

/** What a person does to reach the end of the list: scroll down (a wheel turn too, as a short list has nothing to scroll). Stops once Google has been asked again or nothing more can be asked. */
When('I scroll the item search to the end', async function (this: World) {
  this.extendTimeout(60_000);
  const l = list(this);
  const loads = async () => Number((await l.getAttribute('data-loads')) ?? 0);
  const start = await loads();
  for (let i = 0; i < 200; i++) {
    await l.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const box = await l.boundingBox();
    if (box) { await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await this.page.mouse.wheel(0, 2_000); }
    await this.page.waitForTimeout(120);
    const [state, total, drawn, now] = [await l.getAttribute('data-state'), Number(await l.getAttribute('data-total')), await results(this).count(), await loads()];
    if (state === 'loading') continue;
    if (now > start) return;
    if (drawn >= total && (state === 'done' || state === 'offline')) return;
  }
  throw new Error('The item search never reached the end of its results');
});

Then('the item search has {int} results in all', async function (this: World, n: number) {
  await expect(list(this)).toHaveAttribute('data-total', String(n));
});

Then('the item search has not looked beyond the device yet', async function (this: World) {
  // longer than the rest the search takes before it asks Google
  await this.page.waitForTimeout(1_200);
  await expect(list(this)).toHaveAttribute('data-state', 'idle');
  await expect(list(this)).toHaveAttribute('data-loads', '0');
});

Then('the item search says it searched all dates', async function (this: World) {
  await expect(beyond(this)).toHaveAttribute('data-state', 'done');
});

Then('the item search says the nearest {int} are shown and more load while scrolling', async function (this: World, n: number) {
  await expect(beyond(this)).toHaveAttribute('data-state', 'more');
  await expect(beyond(this)).toHaveAttribute('data-limit', String(n));
});

Then('the item search says searching all dates did not finish', async function (this: World) {
  await expect(beyond(this)).toHaveAttribute('data-state', 'limited');
});

Then('the item search says the rest needs a connection', async function (this: World) {
  await expect(beyond(this)).toHaveAttribute('data-state', 'offline');
});

Given('Google refuses searches because of its rate limit', async function (this: World) {
  await this.api.post('/api/__test/search-rate-limit', { on: true });
});

When('Google accepts searches again', async function (this: World) {
  await this.api.post('/api/__test/search-rate-limit', { on: false });
});

// --- fixtures --------------------------------------------------------------------------------------------------

Given('the calendar contains {int} events {string} one a day from {date}', async function (this: World, n: number, title: string, from: string) {
  const events = Array.from({ length: n }, (_, i) => {
    const date = addDays(from, i);
    return { summary: title, start: { dateTime: berlinIso(date, '10:00') }, end: { dateTime: berlinIso(date, '11:00') } };
  });
  await this.api.post('/api/__test/remote/events/bulk', { events });
});

const KINDS = ['Dentist', 'Team lunch', 'Lunch team', 'Standup', 'Doctor', 'Haircut', 'Gym', 'Yoga class', 'Call mum', 'Project sync', 'Book club', 'Piano lesson', 'Car service', 'Dinner', 'Coffee', 'Swimming', 'Parents evening', 'Retro', 'Planning', 'Review'];
const WORDS = ['bring', 'the', 'insurance', 'card', 'before', 'lunch', 'with', 'team', 'and', 'notes', 'about', 'budget', 'plan', 'tickets', 'garden', 'invoice', 'travel', 'photos', 'shoes', 'keys'];
const PLACES = ['Rosenstrasse 4', 'Main street 12', 'Office', 'Cafe Anna', 'Home', 'Town hall', 'Gym', 'Library'];

/** A heavy user's device window (STEPS.md): 8 000 timed events and 700 task lists with about 3 500 items, the same every run. */
Given('the calendar contains a heavy year around {date}', async function (this: World, around: string) {
  this.extendTimeout(180_000);
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
  const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const events = Array.from({ length: 8_000 }, () => {
    const date = addDays(around, Math.floor(rnd() * 730) - 365);
    const from = (7 + Math.floor(rnd() * 13)) * 60 + pick([0, 15, 30, 45]);
    return {
      summary: pick(KINDS), description: Array.from({ length: 10 }, () => pick(WORDS)).join(' '), location: pick(PLACES),
      start: { dateTime: berlinIso(date, hhmm(from)) }, end: { dateTime: berlinIso(date, hhmm(from + 60)) },
    };
  });
  for (let i = 0; i < events.length; i += 500) await this.api.post('/api/__test/remote/events/bulk', { events: events.slice(i, i + 500) });
  const lists = Array.from({ length: 700 }, (_, i) => ({
    title: pick(['Groceries', 'Chores', 'Work todo', 'Packing']), date: addDays(around, Math.floor((i / 700) * 730) - 365), time: null,
    items: Array.from({ length: 3 + Math.floor(rnd() * 6) }, () => ({ title: `${pick(WORDS)} ${pick(WORDS)}`, done: rnd() < 0.3 })),
  }));
  for (let i = 0; i < lists.length; i += 8) await Promise.all(lists.slice(i, i + 8).map((body) => this.api.post('/api/tasklists', body)));
});
