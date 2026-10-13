/** Streak, plant and sunflower field steps (STEPS.md "Streak and plant"). */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { chooseSelect, setSwitch } from './support/settings.js';
import { exactText, type World } from './support/world.js';

const SCENES: Record<string, 'sunflowers' | 'mordor' | 'none'> = {
  'Sunflower field': 'sunflowers',
  Mordor: 'mordor',
  None: 'none',
};
const SUNFLOWER_MODES: Record<string, 'grow' | 'full'> = {
  'Grow with points': 'grow',
  'Full field': 'full',
};

/** "Small plant" and "small-plant" count as the same stage name (data-stage format is not fixed by the spec). */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

Given('I checked in on {datelist}', async function (this: World, dates: string[]) {
  await this.api.setMotivation({ checkIns: dates });
});

Given(
  'the plant has {int} growth points and was last watered on {date}',
  async function (this: World, growth: number, lastWatered: string) {
    await this.api.setMotivation({ plant: { growth, lastWatered, todayPoints: 0 } });
  },
);

Given('the scene is {string}', async function (this: World, label: string) {
  const scene = SCENES[label];
  if (!scene) throw new Error(`Unknown scene "${label}"`);
  await this.api.patch('/api/prefs/theme', { overrides: { scene } });
});

Given('the sunflowers are set to {string}', async function (this: World, label: string) {
  const sunflowers = SUNFLOWER_MODES[label];
  if (!sunflowers) throw new Error(`Unknown sunflowers setting "${label}"`);
  await this.api.patch('/api/settings', { sunflowers });
});

const flame = (w: World) => w.page.getByTestId('streak-flame');
const plantButton = (w: World) => w.page.getByTestId('plant-button');
const field = (w: World) => w.page.getByTestId('sunflower-field');

Then('the streak shows {int}', async function (this: World, count: number) {
  await expect(flame(this)).toHaveText(exactText(String(count)));
});

Then('I see the streak message {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('streak-message')).toHaveText(exactText(text));
});

Then('I do not see a streak message', async function (this: World) {
  await this.settled();
  await expect(this.page.getByTestId('streak-message')).toHaveCount(0);
});

Then('the best streak in settings is {int}', async function (this: World, best: number) {
  await expect(this.page.getByTestId('settings-best-streak')).toContainText(new RegExp(`\\b${best}\\b`));
});

async function expectShown(world: World, loc: Locator, shown: boolean) {
  if (shown) return expect(loc.first()).toBeVisible();
  await world.settled();
  await expect(loc).toHaveCount(0);
}

Then('I see the plant', async function (this: World) {
  await expectShown(this, plantButton(this), true);
});

Then('I do not see the plant', async function (this: World) {
  await expectShown(this, plantButton(this), false);
});

Then('I see the streak flame', async function (this: World) {
  await expectShown(this, flame(this), true);
});

Then('I do not see the streak flame', async function (this: World) {
  await expectShown(this, flame(this), false);
});

Then('the plant is at the stage {string}', async function (this: World, stage: string) {
  await expect.poll(async () => slug((await plantButton(this).getAttribute('data-stage')) ?? '')).toBe(slug(stage));
});

Then('the plant looks {string}', async function (this: World, mood: string) {
  await expect(plantButton(this)).toHaveAttribute('data-mood', mood);
});

When('I open the plant card', async function (this: World) {
  await plantButton(this).click();
  await expect(this.page.getByTestId('plant-card')).toBeVisible();
});

Then('the plant card shows the stage {string}', async function (this: World, stage: string) {
  await expect.poll(async () => slug(await this.page.getByTestId('plant-card-stage').innerText())).toBe(slug(stage));
});

Then('the plant card shows {string}', async function (this: World, line: string) {
  await expect(this.page.getByTestId('plant-card-line')).toHaveText(exactText(line));
});

When('I turn the streak flame {string}', async function (this: World, state: string) {
  if (state !== 'on' && state !== 'off') throw new Error(`Expected "on" or "off", got "${state}"`);
  await setSwitch(this, this.page.getByTestId('settings-streak-flame'), state === 'on');
});

When('I turn the plant {string}', async function (this: World, state: string) {
  if (state !== 'on' && state !== 'off') throw new Error(`Expected "on" or "off", got "${state}"`);
  await setSwitch(this, this.page.getByTestId('settings-plant'), state === 'on');
});

When('I choose {string} for the sunflowers', async function (this: World, label: string) {
  await chooseSelect(this, this.page.getByTestId('settings-sunflowers'), label);
});

Then('I see the sunflower field', async function (this: World) {
  await expectShown(this, field(this), true);
});

Then('I do not see the sunflower field', async function (this: World) {
  await expectShown(this, field(this), false);
});

Then('the sunflower field shows {int} flower(s)', async function (this: World, count: number) {
  await expect(field(this)).toBeVisible();
  // Only visible flowers count (phones show fewer than the earned total).
  await expect.poll(() => field(this).getByTestId('sunflower').locator('visible=true').count()).toBe(count);
});

Then('the sunflower field is labelled {string}', async function (this: World, label: string) {
  await expect(field(this)).toHaveAttribute('aria-label', label);
});

/** Per sunflower: computed animation-name is not "none" and animation-play-state is "running". */
const swayStates = (w: World) =>
  field(w).getByTestId('sunflower').evaluateAll((els) =>
    els.map((e) => {
      const cs = getComputedStyle(e);
      return cs.animationName !== 'none' && cs.animationPlayState === 'running';
    }),
  );

Then('the sunflowers are swaying', async function (this: World) {
  await expect.poll(async () => {
    const s = await swayStates(this);
    return s.length > 0 && s.every(Boolean);
  }).toBe(true);
});

Then('the sunflowers are not swaying', async function (this: World) {
  await expect(field(this).getByTestId('sunflower').first()).toBeAttached();
  await expect.poll(async () => (await swayStates(this)).some(Boolean)).toBe(false);
});

Then('the sunflowers look {string}', async function (this: World, mood: string) {
  await expect(field(this)).toHaveAttribute('data-mood', mood);
});
