/** Places for an event's location (STEPS.md "Places for an event's location", feature event-location). */
import { expect, type Locator } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures.js';
import { berlinIso } from './support/dates.js';
import { createEvent } from './setup.steps.js';
import { exactText, tid, type World } from './support/world.js';

/** A place the fake place search knows (table of "the place search knows:"). */
interface KnownPlace { name: string; address: string; lat: number; lon: number }

/** Per scenario: the known places, in table order. */
const known = new WeakMap<World, KnownPlace[]>();

/** The suggestions' pause in the app (LocationField.vue). */
const PAUSE_MS = 300;

export function place(w: World, name: string): KnownPlace {
  const p = known.get(w)?.find((k) => k.name === name);
  if (!p) throw new Error(`The place search does not know "${name}"`);
  return p;
}

/** The location field (the location rule's steps only use the event dialog's). */
const LOCATION_FIELDS: Record<string, string> = { location: 'event-location', description: 'event-description' };
const dialog = (w: World) => w.page.locator(`${tid('event-dialog')}, ${tid('birthday-dialog')}`);
const fieldOf = (w: World, name: string): Locator => {
  const id = LOCATION_FIELDS[name];
  if (!id) throw new Error(`Unknown field "${name}" for typing (known: ${Object.keys(LOCATION_FIELDS).join(', ')})`);
  return dialog(w).getByTestId(id);
};
const suggestions = (w: World) => w.byTestId('place-suggestions');

Given('the place search knows:', async function (this: World, table: DataTable) {
  const places = table.hashes().map((r) => ({ name: r.name!, address: r.address!, lat: Number(r.latitude), lon: Number(r.longitude) }));
  known.set(this, places);
  await this.api.post('/api/__test/places', { places });
});

/** Creates the event "as the app writes it": the location "<name>, <address>" and the place in the private properties. */
Given(
  'the calendar contains an event {string} on {date} from {time} to {time} at the place {string}',
  async function (this: World, title: string, date: string, from: string, to: string, name: string) {
    const p = place(this, name);
    await createEvent(this, { title, allDay: false, start: berlinIso(date, from), end: berlinIso(date, to), location: `${p.name}, ${p.address}`, place: { name: p.name, lat: p.lat, lon: p.lon } });
  },
);

Given(
  'the calendar {string} contains an event {string} on {date} from {time} to {time} at the place {string}',
  async function (this: World, calendar: string, title: string, date: string, from: string, to: string, name: string) {
    const p = place(this, name);
    await this.api.remoteInsert({
      calendarId: await this.api.calendarId(calendar), summary: title, location: `${p.name}, ${p.address}`,
      start: { dateTime: berlinIso(date, from) }, end: { dateTime: berlinIso(date, to) },
      extendedProperties: { private: { placeName: p.name, placeLat: String(p.lat), placeLon: String(p.lon) } },
    });
  },
);

When('I type {string} in the event field {string}', async function (this: World, text: string, name: string) {
  const f = fieldOf(this, name);
  await f.click();
  await f.fill('');
  // key by key, as a person types: the suggestions' pause applies
  await f.pressSequentially(text, { delay: 30 });
  await suggestions(this).waitFor({ state: 'visible', timeout: 1000 }).catch(() => undefined);
});

Then('I see the place suggestions:', async function (this: World, table: DataTable) {
  const want = table.hashes().map((r) => `${r.name} | ${r.address}`);
  await expect.poll(async () => {
    const rows = suggestions(this).getByTestId('place-suggestion');
    const out: string[] = [];
    for (const r of await rows.all()) out.push(`${await r.getByTestId('place-suggestion-name').innerText()} | ${await r.getByTestId('place-suggestion-address').innerText()}`);
    return out;
  }, { message: 'place suggestions (name | address)' }).toEqual(want);
});

Then('I see no place suggestions', async function (this: World) {
  // "checked after the pause plus 1 s": a late answer would show by then
  await this.page.waitForTimeout(PAUSE_MS + 1000);
  await expect(suggestions(this)).toBeHidden();
});

Then('the suggestions credit OpenStreetMap', async function (this: World) {
  const credit = suggestions(this).getByTestId('place-suggestions-credit');
  await expect(credit).toBeVisible();
  await expect(credit).toContainText('© OpenStreetMap');
});

When('I pick the place suggestion {string}', async function (this: World, name: string) {
  await suggestions(this).getByTestId('place-suggestion')
    .filter({ has: this.page.getByTestId('place-suggestion-name').filter({ hasText: exactText(name) }) }).click();
});

When('I press Arrow down in the event field {string}', async function (this: World, name: string) {
  await fieldOf(this, name).press('ArrowDown');
});

/** `event-map` shows the known place N: its position, the pin, and every picture loaded. */
async function expectMapOf(w: World, name: string) {
  const p = place(w, name);
  const map = dialog(w).getByTestId('event-map');
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute('data-lat', p.lat.toFixed(4));
  await expect(map).toHaveAttribute('data-lon', p.lon.toFixed(4));
  await expect(map.getByTestId('event-map-pin')).toBeVisible();
  const pictures = map.locator('img');
  await expect.poll(() => pictures.count(), { message: 'map pictures' }).toBeGreaterThan(0);
  await expect(map.locator('img:not([data-loaded="true"])'), 'every map picture has loaded').toHaveCount(0, { timeout: 10_000 });
}

Then('the event dialog shows a map with a pin on {string}', async function (this: World, name: string) {
  await expectMapOf(this, name);
});

Then('the event dialog shows no map', async function (this: World) {
  await expect(dialog(this)).toBeVisible();
  await expect(dialog(this).getByTestId('event-map')).toHaveCount(0);
  await expect(dialog(this).getByTestId('event-map-placeholder')).toHaveCount(0);
});

Then('the event dialog shows a map placeholder for {string}', async function (this: World, name: string) {
  const ph = dialog(this).getByTestId('event-map-placeholder');
  await expect(ph).toBeVisible({ timeout: 10_000 });
  await expect(ph.getByTestId('event-map-pin')).toBeVisible();
  await expect(ph).toContainText(name);
  await expect(dialog(this).locator(`${tid('event-map')} img`)).toHaveCount(0);
});

Then('the map credits OpenStreetMap', async function (this: World) {
  const map = dialog(this).getByTestId('event-map');
  const credit = map.getByTestId('event-map-credit');
  await expect(credit).toBeVisible();
  await expect(credit).toContainText('© OpenStreetMap');
  await map.evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
  // inside the map's box and on top at its middle (not covered); measured in one frame, polled while the sheet settles
  await expect.poll(() => credit.evaluate((el) => {
    const m = el.closest('[data-testid="event-map"]')!.getBoundingClientRect();
    const c = el.getBoundingClientRect();
    if (c.left < m.left - 0.5 || c.top < m.top - 0.5 || c.right > m.right + 0.5 || c.bottom > m.bottom + 0.5) return 'outside the map';
    const top = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
    return top && el.contains(top) ? 'shown' : `covered by ${top?.outerHTML.slice(0, 80)}`;
  }), { message: 'the credit on the map' }).toBe('shown');
});

Then('the event dialog shows no error', async function (this: World) {
  await expect(dialog(this).getByTestId('event-error')).toHaveCount(0);
});

Given('I have seen the map of the event {string}', async function (this: World, title: string) {
  await this.eventChip(title).click();
  await expect(dialog(this)).toBeVisible();
  // the pictures are in the device's cache once they have loaded
  await expect(dialog(this).getByTestId('event-map')).toBeVisible();
  await expect(dialog(this).locator(`${tid('event-map')} img:not([data-loaded="true"])`)).toHaveCount(0, { timeout: 10_000 });
  await dialog(this).getByTestId('event-cancel').click();
  await expect(dialog(this)).toBeHidden();
});

Then('the event form starts with the fields {string}', async function (this: World, list: string) {
  const want = list.split(', ');
  const fields = await dialog(this).locator('[data-field]').evaluateAll((els) => els.map((e) => e.getAttribute('data-field')));
  // form tables name the fields in words ("start date"); data-field uses the form model's names
  const names: Record<string, string> = { title: 'title', location: 'location', description: 'description', 'all day': 'allDay', 'start date': 'startDate', 'start time': 'startTime', 'end date': 'endDate', 'end time': 'endTime' };
  expect(fields.slice(0, want.length)).toEqual(want.map((n) => names[n] ?? n));
});

Then('the location\'s address line says {string}', async function (this: World, address: string) {
  await expect(dialog(this).getByTestId('event-location-address')).toHaveText(exactText(address));
});

Then('the location has no address line', async function (this: World) {
  await expect(dialog(this).getByTestId('event-location-address')).toHaveCount(0);
});

Then('the map is shown without scrolling the event dialog', async function (this: World) {
  const map = dialog(this).getByTestId('event-map');
  await expect(map).toBeVisible();
  // the dialog's own scroller stays at the top; the map lies fully inside its visible part
  const fits = await map.evaluate((el) => {
    let s: HTMLElement | null = el.parentElement;
    while (s && !(s.scrollHeight > s.clientHeight && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
    const view = (s ?? document.documentElement).getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { top: s?.scrollTop ?? 0, inside: r.top >= view.top - 0.5 && r.bottom <= Math.min(view.bottom, innerHeight) + 0.5 };
  });
  expect(fits.top, 'dialog scrolled').toBe(0);
  expect(fits.inside, 'map inside the visible part of the dialog').toBe(true);
});

/** Per scenario: the page a tap on the map opened. */
const opened = new WeakMap<World, Promise<import('@playwright/test').Page>>();

/** Clicks a link and remembers the tab it opens; the test machine has no internet, so both map sites answer a stub. */
async function tapOpening(world: World, link: import('@playwright/test').Locator): Promise<void> {
  const ctx = world.page.context();
  for (const site of ['https://www.openstreetmap.org/**', 'https://www.google.com/maps/**']) {
    await ctx.route(site, (r) => r.fulfill({ contentType: 'text/html', body: 'map' }));
  }
  opened.set(world, ctx.waitForEvent('page'));
  await link.click();
}

When('I tap the map', async function (this: World) {
  await tapOpening(this, dialog(this).locator(`${tid('event-map')}, ${tid('event-map-placeholder')}`).first());
});

const BUTTON_IDS: Record<string, string> = { 'Google Maps': 'event-map-google', OpenStreetMap: 'event-map-osm' };

When('I tap the map button {string}', async function (this: World, name: string) {
  await tapOpening(this, dialog(this).getByTestId(BUTTON_IDS[name] ?? name));
});

Then('I see the map buttons {string} under the map', async function (this: World, list: string) {
  const group = dialog(this).getByTestId('event-map-buttons');
  await expect(group).toBeVisible();
  await expect(group.getByRole('link')).toHaveText(list.split(', '));
  const map = dialog(this).locator(`${tid('event-map')}, ${tid('event-map-placeholder')}`).first();
  // both boxes in one read: the dialog scrolls the map into view, so two reads would measure two moments
  const mapEl = await map.elementHandle();
  await expect.poll(() => group.evaluate((g, m) => g.getBoundingClientRect().top - m!.getBoundingClientRect().bottom, mapEl), { message: 'buttons below the map' }).toBeGreaterThanOrEqual(-0.5);
});

/** The Google Maps search page for a place: its position as `query=<lat>,<lon>`. */
Then('the Google Maps page of the place {string} opens in a new tab', async function (this: World, name: string) {
  const p = place(this, name);
  const tab = await opened.get(this);
  if (!tab) throw new Error('nothing was tapped');
  await tab.waitForURL(/google\.com\/maps/);
  const url = new URL(tab.url());
  expect(url.pathname).toBe('/maps/search/');
  expect(url.searchParams.get('api')).toBe('1');
  const [lat, lon] = (url.searchParams.get('query') ?? '').split(',').map(Number);
  expect(lat!.toFixed(4)).toBe(p.lat.toFixed(4));
  expect(lon!.toFixed(4)).toBe(p.lon.toFixed(4));
  await tab.close();
});

/** The OpenStreetMap page marking a place: its position as `mlat`/`mlon`, 4 decimals or more. */
Then('the OpenStreetMap page of the place {string} opens in a new tab', async function (this: World, name: string) {
  const p = place(this, name);
  const tab = await opened.get(this);
  if (!tab) throw new Error('the map was not tapped');
  await tab.waitForURL(/openstreetmap\.org/);
  const url = new URL(tab.url());
  expect(url.hostname).toBe('www.openstreetmap.org');
  expect(Number(url.searchParams.get('mlat')).toFixed(4)).toBe(p.lat.toFixed(4));
  expect(Number(url.searchParams.get('mlon')).toFixed(4)).toBe(p.lon.toFixed(4));
  await tab.close();
});
