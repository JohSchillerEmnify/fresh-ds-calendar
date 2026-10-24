/** Running-clock steps (STEPS.md "Clock and time"). The plain `the time is D T` step lives in setup.steps.ts. */
import { Given, When } from './fixtures.js';
import { berlinToEpoch } from './support/dates.js';
import type { World } from './support/world.js';

Given(
  'the time is {date} {time} and the clock is running',
  async function (this: World, date: string, time: string) {
    const epoch = berlinToEpoch(date, time);
    this.clockNowMs = epoch;
    await this.api.setClock(new Date(epoch).toISOString(), false);
    // Install the fake browser clock before the page opens, then pause it: app timers advance only via "N minutes pass".
    await this.page.clock.install({ time: epoch });
    await this.page.clock.pauseAt(epoch + 1);
  },
);

When('{int} minutes pass', async function (this: World, minutes: number) {
  if (this.clockNowMs === undefined) throw new Error('"N minutes pass" needs "the time is ... and the clock is running"');
  this.clockNowMs += minutes * 60_000;
  await this.page.clock.runFor(minutes * 60_000);
  await this.api.setClock(new Date(this.clockNowMs).toISOString(), false);
});

When('{int} seconds pass', async function (this: World, seconds: number) {
  if (this.clockNowMs === undefined) throw new Error('"N seconds pass" needs "the time is ... and the clock is running"');
  this.clockNowMs += seconds * 1_000;
  await this.page.clock.runFor(seconds * 1_000);
  await this.api.setClock(new Date(this.clockNowMs).toISOString(), false);
});
