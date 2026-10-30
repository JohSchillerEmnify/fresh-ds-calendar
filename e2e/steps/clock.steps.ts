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

/** Moves the page's clock on; with the server's time frozen ("the time is D T") only the page's own `Date.now` jumps (the app counts device time). */
async function pass(world: World, minutes: number): Promise<void> {
  if (world.clockNowMs === undefined) {
    await world.page.evaluate((ms) => {
      const w = window as unknown as { __skew?: number };
      if (w.__skew === undefined) {
        const real = Date.now.bind(Date);
        w.__skew = 0;
        Date.now = () => real() + w.__skew!;
      }
      w.__skew += ms;
    }, minutes * 60_000);
    return;
  }
  world.clockNowMs += minutes * 60_000;
  await world.page.clock.runFor(minutes * 60_000);
  await world.api.setClock(new Date(world.clockNowMs).toISOString(), false);
}

When('{int} minutes pass', async function (this: World, minutes: number) {
  await pass(this, minutes);
});

When('1 minute passes', async function (this: World) {
  await pass(this, 1);
});

When('{int} seconds pass', async function (this: World, seconds: number) {
  if (this.clockNowMs === undefined) throw new Error('"N seconds pass" needs "the time is ... and the clock is running"');
  this.clockNowMs += seconds * 1_000;
  await this.page.clock.runFor(seconds * 1_000);
  await this.api.setClock(new Date(this.clockNowMs).toISOString(), false);
});
