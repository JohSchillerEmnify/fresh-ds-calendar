/** Material 3 theme steps (STEPS.md "Theme"). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import type { Scheme } from './parameters.js';
import { contrastRatio, cssColorToRgba, roleHex, toHex } from './support/color.js';
import type { World } from './support/world.js';

async function emulateScheme(world: World, scheme: Scheme) {
  world.colorScheme = scheme;
  await world.page.emulateMedia({ colorScheme: scheme });
}

Given('the device prefers a {scheme} color scheme', async function (this: World, scheme: Scheme) {
  await emulateScheme(this, scheme);
});

When('the device switches to a {scheme} color scheme', async function (this: World, scheme: Scheme) {
  await emulateScheme(this, scheme);
});

Then('the app uses the {scheme} theme', async function (this: World, scheme: Scheme) {
  await expect(this.page.locator('html')).toHaveAttribute('data-theme', scheme);
});

Then('the page theme color matches the {string} color role', async function (this: World, role: string) {
  await expect
    .poll(async () => {
      const meta = await this.page.locator('meta[name="theme-color"]').first().getAttribute('content');
      const metaRgba = meta ? await cssColorToRgba(this.page, meta) : null;
      const roleValue = await roleHex(this.page, role);
      return `${metaRgba ? toHex(metaRgba) : `meta ${meta}`} vs ${roleValue}`;
    })
    .toMatch(/^(#[0-9a-f]{6}) vs \1$/);
});

Then('the color roles {string} are defined', async function (this: World, list: string) {
  const roles = list.split(', ');
  await expect
    .poll(() =>
      this.page.evaluate(
        (rs) => rs.filter((r) => !getComputedStyle(document.documentElement).getPropertyValue(`--md-sys-color-${r}`).trim()),
        roles,
      ), { message: 'undefined color roles' })
    .toEqual([]);
});

Then('the period title has a contrast ratio of at least {float}', async function (this: World, min: number) {
  const title = this.page.getByTestId('period-title');
  await expect(title).toBeVisible();
  expect(await contrastRatio(title)).toBeGreaterThanOrEqual(min);
});

Then('the event {string} has a text contrast ratio of at least {float}', async function (this: World, name: string, min: number) {
  const chip = this.eventChip(name);
  await expect(chip).toBeVisible();
  const text = chip.getByTestId('event-chip-title');
  const target = (await text.count()) ? text.first() : chip;
  expect(await contrastRatio(target)).toBeGreaterThanOrEqual(min);
});

Then('pressing the create button shows a state layer', async function (this: World) {
  const button = this.page.getByTestId('create-button');
  const b = await button.boundingBox();
  if (!b) throw new Error('create-button not visible');
  await this.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await this.page.mouse.down();
  try {
    await expect(button).toHaveAttribute('data-pressed', 'true');
    await expect
      .poll(() =>
        button.evaluate((el) => {
          const layer = (el.matches('[data-state-layer]') ? el : el.querySelector('[data-state-layer]')) as HTMLElement | null;
          return layer ? Number(getComputedStyle(layer).opacity) : -1;
        }),
      )
      .toBeGreaterThan(0);
  } finally {
    await this.page.mouse.up();
  }
});
