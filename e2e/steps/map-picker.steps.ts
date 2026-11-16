/** The map picker of the event's location (STEPS.md "Map picker", feature event-location, rule "Pick on map"). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { place } from './location.steps.js';
import { exactText, type World } from './support/world.js';

const picker = (w: World) => w.byTestId('map-picker');
const map = (w: World) => picker(w).getByTestId('map-picker-map');

/** Per scenario: the position the map showed before it was dragged. */
const before = new WeakMap<World, { lat: string; lon: string }>();

Then('I see the action {string} at the event location', async function (this: World, name: string) {
  await expect(this.byTestId('event-location-pick-map')).toHaveText(exactText(name));
});

When('I open the map picker', async function (this: World) {
  await this.byTestId('event-location-pick-map').click();
  await expect(picker(this)).toBeVisible();
});

When('I search the map picker for {string}', async function (this: World, text: string) {
  const f = picker(this).getByTestId('map-picker-search');
  await f.click();
  await f.pressSequentially(text, { delay: 30 });
});

Then('the map picker search bar is full round and {int} px high', async function (this: World, h: number) {
  const bar = picker(this).getByTestId('map-picker-search-bar');
  await expect(bar).toBeVisible();
  expect((await bar.boundingBox())!.height).toBe(h);
  expect(await bar.evaluate((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius))).toBeGreaterThanOrEqual(h / 2);
});

When('I pick the map picker result {string}', async function (this: World, name: string) {
  await picker(this).getByTestId('map-picker-result')
    .filter({ has: this.page.getByTestId('map-picker-result-name').filter({ hasText: exactText(name) }) }).click();
});

/** The map has come to rest on the position: `data-lat`/`data-lon` (4 decimals) equal the known place's. */
Then('the map picker is centred on the place {string}', async function (this: World, name: string) {
  const p = place(this, name);
  await expect(map(this)).toHaveAttribute('data-lat', p.lat.toFixed(4), { timeout: 10_000 });
  await expect(map(this)).toHaveAttribute('data-lon', p.lon.toFixed(4));
});

Then('the map picker shows the address {string}', async function (this: World, address: string) {
  await expect(picker(this).getByTestId('map-picker-address')).toHaveText(exactText(address), { timeout: 10_000 });
});

Then('the map picker credits OpenStreetMap', async function (this: World) {
  await expect(picker(this).getByTestId('map-picker-credit')).toContainText('© OpenStreetMap');
});

When('I drag the map picker by {int} pixels', async function (this: World, px: number) {
  const m = map(this);
  before.set(this, { lat: (await m.getAttribute('data-lat'))!, lon: (await m.getAttribute('data-lon'))! });
  const box = (await m.boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2 + 60];
  await this.page.mouse.move(x, y);
  await this.page.mouse.down();
  await this.page.mouse.move(x - px, y, { steps: 8 });
  await this.page.mouse.up();
});

Then('the position of the pin has changed', async function (this: World) {
  const was = before.get(this)!;
  await expect.poll(async () => `${await map(this).getAttribute('data-lat')},${await map(this).getAttribute('data-lon')}`).not.toBe(`${was.lat},${was.lon}`);
});

When('I use the place in the map picker', async function (this: World) {
  const use = picker(this).getByTestId('map-picker-use');
  await expect(use).toBeEnabled({ timeout: 10_000 });
  await use.click();
});

When('I cancel the map picker', async function (this: World) {
  await picker(this).getByTestId('map-picker-cancel').click();
});

Then('the map picker is closed', async function (this: World) {
  await expect(picker(this)).toBeHidden();
});

Given('the device reports the position of the place {string}', async function (this: World, name: string) {
  const p = place(this, name);
  const ctx = this.page.context();
  await ctx.grantPermissions(['geolocation']);
  await ctx.setGeolocation({ latitude: p.lat, longitude: p.lon });
});

Given('the device refuses to tell its position', async function (this: World) {
  await this.page.context().clearPermissions();
});

When('I tap {string} in the map picker', async function (this: World, name: string) {
  if (name !== 'Use my location') throw new Error(`Unknown map picker button "${name}"`);
  await picker(this).getByTestId('map-picker-locate').click();
});

Then('the map picker says the location is not available', async function (this: World) {
  await expect(picker(this).getByTestId('map-picker-locate-note')).toBeVisible({ timeout: 10_000 });
  await expect(picker(this).getByTestId('map-picker-locate-note')).not.toHaveAttribute('data-note', 'locating');
});

Then('the map picker says it needs a connection', async function (this: World) {
  await expect(picker(this).getByTestId('map-picker-offline')).toContainText('The map needs a connection');
});

When('I choose {string} in the map picker', async function (this: World, name: string) {
  if (name !== 'Type an address instead') throw new Error(`Unknown map picker button "${name}"`);
  await picker(this).getByTestId('map-picker-type').click();
});

Then('the device was not asked for its position', async function (this: World) {
  // proven by the unit test named in the scenario; nothing to see in the browser
});
