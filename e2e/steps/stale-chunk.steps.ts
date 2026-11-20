/** A deploy removes the app's hashed script files (STEPS.md "App updates"). */
import { expect } from '@playwright/test';
import { Given, Then } from './fixtures.js';
import type { World } from './support/world.js';

const FILES: Record<string, string> = { month: 'MonthPage', week: 'WeekView', day: 'DayView', year: 'YearView' };
const loads = new WeakMap<object, { n: number }>();

Given('the script and styles of the {view} view are gone from the server until the page reloads', async function (this: World, view: string) {
  // the page runs without a worker, as a phone that never got one controlling it: a worker would serve the old file from its cache
  await this.page.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  });
  await this.page.reload();
  await this.settled();
  const counter = { n: 0 };
  loads.set(this, counter);
  this.page.on('load', () => { counter.n++; });
  // the script and the style file of the view, as a deploy leaves the page that still names the old ones
  await this.page.route(new RegExp(`/assets/${FILES[view]}-[^/]*\\.(js|css)$`), (route) => (counter.n === 0 ? route.fulfill({ status: 404, body: 'gone' }) : route.continue()));
});

Then('the page has reloaded once', async function (this: World) {
  const counter = loads.get(this)!;
  await expect.poll(() => counter.n).toBe(1);
  // the reloaded page is stable: no second reload follows once it settled
  await this.settled();
  expect(counter.n).toBe(1);
});
