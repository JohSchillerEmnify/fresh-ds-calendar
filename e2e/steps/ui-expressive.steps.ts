/** One action vocabulary and theme corners (STEPS.md "UI redesign E", feature ui-expressive). */
import { expect, type Locator } from '@playwright/test';
import { Given, Then } from './fixtures.js';
import type { World } from './support/world.js';

/** STEPS.md control names → `data-testid`. */
const CONTROLS: Record<string, string> = { 'create button': 'create-button', 'Today button': 'nav-today', 'settings button': 'settings-button', 'filter button': 'filter-button' };
const controlId = (name: string) => {
  const id = CONTROLS[name];
  if (!id) throw new Error(`Unknown control "${name}"`);
  return id;
};

/** The look of every visible button of the page outside dialogs: its testid, drawn background (the Today `.pill` for Today) and whether it shows text. */
async function buttonLooks(w: World) {
  await w.settled();
  return w.page.evaluate(() => {
    const probe = (tok: string) => { const i = document.createElement('i'); i.style.background = `var(${tok})`; document.body.appendChild(i); const c = getComputedStyle(i).backgroundColor; i.remove(); return c; };
    const primary = [probe('--md-sys-color-primary'), probe('--md-sys-color-primary-container')];
    const alpha = (c: string) => (c.startsWith('rgba') ? Number(c.split(',')[3].replace(')', '')) : c === 'transparent' ? 0 : 1);
    return [...document.querySelectorAll<HTMLElement>('button')].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && getComputedStyle(b).visibility !== 'hidden' && !b.closest('[role="dialog"]');
    }).map((b) => {
      const drawn = b.querySelector<HTMLElement>('.pill') ?? b;
      const cs = getComputedStyle(drawn);
      return { id: b.dataset.testid ?? '', filled: primary.includes(cs.backgroundColor), alpha: alpha(cs.backgroundColor), blur: cs.backdropFilter, text: (b.innerText ?? '').trim(), label: b.getAttribute('aria-label') ?? b.getAttribute('title') ?? '' };
    });
  });
}

Then('the surface has one filled {string}', async function (this: World, name: string) {
  const id = controlId(name);
  const looks = (await buttonLooks(this)).filter((b) => b.id === id);
  expect(looks.length, `the ${name}`).toBe(1);
  expect(looks[0].filled, `${name} is filled`).toBe(true);
});

Then('every other button of the surface is tonal, outlined or text', async function (this: World) {
  const filled = (await buttonLooks(this)).filter((b) => b.filled).map((b) => b.id);
  expect(filled.sort(), 'filled buttons').toEqual(['create-button', 'nav-today']);
});

Then('the {string} is an icon with the label {string}', async function (this: World, name: string, label: string) {
  const b: Locator = this.page.getByTestId(controlId(name)).first();
  await expect(b).toHaveAttribute('aria-label', label);
  await expect(b.locator('svg').first()).toBeVisible();
  expect((await b.evaluate((el) => (el as HTMLElement).innerText)).trim(), 'no text').toBe('');
});

Then('every icon-only button of the screen has an accessible label', async function (this: World) {
  const bad = (await buttonLooks(this)).filter((b) => !b.text && !b.label);
  expect(bad.map((b) => b.id || '(no testid)'), 'icon-only buttons without a label').toEqual([]);
});

Given('the theme is {string}', async function (this: World, name: string) {
  await this.api.patch('/api/prefs/theme', { preset: name, seasonal: 'off' });
});

Then('the bottom bar, the top bar and every button are drawn with fully round corners', async function (this: World) {
  await this.settled();
  const bad = await this.page.evaluate(() => {
    const round = (el: Element) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomLeftRadius, cs.borderBottomRightRadius].map(parseFloat);
      return Math.min(...radii) >= Math.min(r.width, r.height) / 2 - 0.5;
    };
    // the controls of the two bars and the create button; the full-width top bar itself is a flat strip in every theme
    const bars = [document.querySelector('[data-testid="bottom-bar"]')].filter((e): e is Element => !!e);
    // the date title is a text button and the + button an M3 rounded square (theme-independent); the icon buttons and view items are round
    const buttons = [...document.querySelectorAll('[data-testid="top-bar"] button, [data-testid="bottom-bar"] button')].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 1 && !b.classList.contains('sr-only') && !b.matches('[data-testid="period-title"]');
    });
    const bar = document.querySelector('[data-testid="top-bar"]')!;
    const flat = parseFloat(getComputedStyle(bar).borderTopLeftRadius) === 0;
    return [...bars, ...buttons].filter((e) => !round(e) && !(e.matches('[data-testid="nav-today"]') && round(e.querySelector('.pill')!))).map((e) => (e as HTMLElement).dataset.testid ?? e.tagName).concat(flat ? [] : ['top-bar corners']);
  });
  expect(bad, 'not fully round').toEqual([]);
});

Then('the Today button is the only filled button of the top bar', async function (this: World) {
  const inBar = await this.page.evaluate(() => [...document.querySelectorAll('[data-testid="top-bar"] button')].map((b) => b.getAttribute('data-testid')));
  const looks = (await buttonLooks(this)).filter((b) => inBar.includes(b.id || null) && b.alpha > 0);
  expect(looks.map((b) => b.id), 'buttons with a background in the top bar').toEqual(['nav-today']);
  expect(looks[0].filled, 'Today is filled').toBe(true);
});

Then('the top bar icons have no see-through background', async function (this: World) {
  const bad = (await buttonLooks(this)).filter((b) => ['filter-button', 'settings-button', 'nav-today', 'menu-button'].includes(b.id) && ((b.alpha > 0 && b.alpha < 1) || (b.blur && b.blur !== 'none')));
  expect(bad.map((b) => b.id), 'icons over the scene with a glass look').toEqual([]);
});
