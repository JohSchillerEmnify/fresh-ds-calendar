/** Material 3 theme steps (STEPS.md "Theme"). */
import fs from 'node:fs';
import path from 'node:path';
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import type { Scheme } from './parameters.js';
import { contrastRatio, cssColorToRgba, roleHex, toHex } from './support/color.js';
import { exactText, tid, type World } from './support/world.js';

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

/** The element's computed background equals its `data-color` (both resolved to sRGB bytes). */
async function expectFilled(world: World, el: Locator) {
  await expect(el).toBeVisible();
  const want = await cssColorToRgba(world.page, (await el.getAttribute('data-color')) ?? '');
  const got = await cssColorToRgba(world.page, await el.evaluate((n) => getComputedStyle(n).backgroundColor));
  expect(got && toHex(got)).toBe(want && toHex(want));
  expect(got?.a).toBe(1);
}

Then('the event {string} is filled with its color', async function (this: World, name: string) {
  await expectFilled(this, this.eventChip(name));
});

Then('the task list {string} is filled with its color', async function (this: World, title: string) {
  await expectFilled(this, this.taskCard(title));
});

Then('the task list {string} has a text contrast ratio of at least {float}', async function (this: World, title: string, min: number) {
  const card = this.taskCard(title);
  await expect(card).toBeVisible();
  for (const id of ['tasklist-card-title', 'tasklist-card-item', 'tasklist-card-count', 'tasklist-card-time']) {
    const text = card.getByTestId(id).locator('visible=true');
    for (let i = 0; i < (await text.count()); i++) expect(await contrastRatio(text.nth(i)), id).toBeGreaterThanOrEqual(min);
  }
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

// ---- Theme menu (STEPS.md "Theme menu (`@themes`)") ----

/** Signs this person in through the OAuth test double (as in signin.steps.ts) and waits for the calendar. */
async function signInAs(world: World, email: string, date = '2026-10-12') {
  world.person = email;
  await world.api.chooseGoogleAccount(email);
  await world.page.goto(`/week/${date}`);
  await world.page.getByTestId('signin-google').click();
  await world.page.waitForURL((u) => u.pathname !== '/signin' || u.searchParams.has('error'));
  await world.calendarShown();
}

const card = (world: World, name: string) => world.page.locator(`[data-testid="theme-card"][data-name="${name}"]`);
/** A fine-tuning option, found by the label it shows (e.g. "Sunflower field"). */
const option = (world: World, setting: string, label: string) =>
  world.page.locator(`[data-testid="theme-option"][data-setting="${setting.toLowerCase()}"]`)
    .filter({ has: world.page.locator('.ol', { hasText: new RegExp(`^${label}$`, 'i') }) });
const isSaved = (r: { request(): { method(): string }; url(): string }) => r.request().method() === 'PATCH' && r.url().includes('/api/prefs/theme');

async function openMenu(world: World) {
  await world.page.getByTestId('settings-button').click();
  await world.page.getByTestId('settings-theme').click();
  await expect(world.page.getByTestId('theme-view')).toBeVisible();
}

/** The theme menu is a page over the calendar: leave it through the browser history to see the calendar again. */
async function backToCalendar(world: World) {
  const menu = world.page.getByTestId('theme-view').or(world.page.getByTestId('settings-view'));
  // right after a reload the page may not be rendered yet: wait for it, or the menu is mistaken for already left
  await expect(menu.or(world.page.locator(['month-view', 'week-view', 'day-view', 'year-view'].map(tid).join(', '))).first()).toBeVisible();
  // menu -> settings -> calendar
  for (let i = 0; i < 2 && (await menu.isVisible()); i++) {
    await world.page.goBack();
  }
  await world.calendarShown();
}

/** Clicks a gallery card and waits until the choice has been saved in the background. */
async function chooseTheme(world: World, name: string) {
  const saved = world.page.waitForResponse(isSaved);
  await card(world, name).click();
  await expect(card(world, name)).toHaveAttribute('aria-pressed', 'true');
  await saved;
}

/** The theme menu is open; from the settings screen, or from the week view for today when nothing is open yet. */
async function ensureMenu(world: World) {
  if (await world.page.getByTestId('theme-view').isVisible()) return;
  if (await world.page.getByTestId('settings-view').isVisible()) {
    await world.page.getByTestId('settings-theme').click();
    await expect(world.page.getByTestId('theme-view')).toBeVisible();
    return;
  }
  if (!(await world.page.getByTestId('settings-button').isVisible())) {
    // "today" is the app clock's date in the calendar zone
    const config = (await (await world.page.request.get('/api/config')).json()) as { now: string; timeZone: string };
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone }).format(new Date(config.now));
    await world.page.goto(`/week/${today}`);
    await world.calendarShown();
  }
  await openMenu(world);
}

When('I open the theme menu', async function (this: World) {
  await ensureMenu(this);
});

When('I choose the theme {string}', async function (this: World, name: string) {
  await ensureMenu(this);
  await chooseTheme(this, name);
});

Given('I chose the theme {string}', async function (this: World, name: string) {
  await this.page.goto('/settings/theme');
  await chooseTheme(this, name);
});

Given('{string} chose the theme {string}', async function (this: World, email: string, name: string) {
  await signInAs(this, email);
  await this.page.goto('/settings/theme');
  await chooseTheme(this, name);
});

Then('the theme {string} is marked as chosen', async function (this: World, name: string) {
  // an earlier step may have looked at the calendar behind the menu: come back to the menu through the history
  for (let i = 0; i < 2 && !(await this.page.getByTestId('theme-view').isVisible()); i++) await this.page.goForward();
  await expect(card(this, name)).toHaveAttribute('aria-pressed', 'true');
  await expect(this.page.locator('[data-testid="theme-card"][aria-pressed="true"]')).toHaveCount(1);
});

Then('the theme {string} is in use', async function (this: World, name: string) {
  await expect(this.page.locator('html')).toHaveAttribute('data-theme-name', name);
});

/** A style is outline when the fill is transparent or the surface and the border is 1.5 px or wider. */
async function expectOutline(world: World, el: Locator) {
  await expect(el).toBeVisible();
  await expect
    .poll(() =>
      el.evaluate((n) => {
        const cs = getComputedStyle(n);
        const fill = cs.backgroundColor, border = cs.borderTopColor;
        return { w: parseFloat(cs.borderTopWidth), fill, border, c: n.getAttribute('data-color') };
      }).then(async (r) => {
        const b = await cssColorToRgba(world.page, r.border);
        const f = await cssColorToRgba(world.page, r.fill);
        const want = r.c ? await cssColorToRgba(world.page, r.c) : null;
        const surface = await roleHex(world.page, 'surface');
        const fillOk = !f || f.a === 0 || toHex(f) === surface;
        const borderOk = !!b && b.a > 0 && (!want || toHex(b) === toHex(want));
        return r.w >= 1.5 && fillOk && borderOk;
      }),
    )
    .toBe(true);
}

Then('the preview event is drawn as an outline', async function (this: World) {
  await expectOutline(this, this.page.getByTestId('theme-preview-event'));
});

Then('the event {string} is drawn as an outline', async function (this: World, name: string) {
  await backToCalendar(this);
  await expectOutline(this, this.eventChip(name));
});

Then('every option for {string} shows a sample event drawn in that style', async function (this: World, label: string) {
  const setting = label.toLowerCase();
  const opts = this.page.locator(`[data-testid="theme-option"][data-setting="${setting}"]`);
  await expect(opts).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const o = opts.nth(i);
    const sample = o.getByTestId('theme-sample-event');
    await expect(sample).toBeVisible();
    // the sample sits under an attribute of that very option, so the shared entry skin draws it in that style
    const value = await o.getAttribute('data-value');
    expect(await sample.evaluate((n, s) => n.closest(`[data-${s}]`)?.getAttribute(`data-${s}`), setting)).toBe(value);
  }
  // the three samples really look different
  const looks = await opts.getByTestId('theme-sample-event').evaluateAll((els) =>
    els.map((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.borderTopWidth, c.borderRadius, c.boxShadow].join('|'); }));
  expect(new Set(looks).size).toBe(3);
});

When('I pick {string} for {string}', async function (this: World, value: string, label: string) {
  await ensureMenu(this);
  const saved = this.page.waitForResponse(isSaved);
  const o = option(this, label, value);
  await o.click();
  await expect(o).toHaveAttribute('aria-pressed', 'true');
  await saved;
});

/** True when a computed shadow list has a coloured (alpha > 0) shadow with a blur. */
function hasGlow(shadow: string, filter: string): boolean {
  const parts = (shadow + ',' + filter).split(/,(?![^(]*\))/);
  return parts.some((p) => {
    const alpha = /\/\s*([\d.]+)\s*\)/.exec(p)?.[1] ?? /rgba?\([^)]*?,\s*([\d.]+)\)/.exec(p)?.[1] ?? '1';
    const lengths = p.replace(/(rgba?|color)\([^)]*\)/, '').match(/-?[\d.]+px/g) ?? [];
    return Number(alpha) > 0 && lengths.length >= 3 && parseFloat(lengths[2]!) > 0 && !/^\s*none/.test(p);
  });
}

Then('the event {string} glows', async function (this: World, name: string) {
  await backToCalendar(this);
  const chip = this.eventChip(name);
  await expect(chip).toBeVisible();
  await expect
    .poll(() => chip.evaluate((n) => { const c = getComputedStyle(n); return [c.boxShadow, c.filter]; }).then(([s, f]) => hasGlow(s!, f!)))
    .toBe(true);
});

Given('{string} may use the calendar', async function (this: World, email: string) {
  await this.api.setAuth([email]);
  // each person has a calendar of their own: the events set up so far are theirs to see too
  for (const ev of await this.api.remoteEvents()) await this.api.remoteInsert({ summary: ev.summary, start: ev.start, end: ev.end, owner: email });
});

// ---- Scenes (STEPS.md "Scenes and the support cat") ----

Then('the top bar scene shows {string}, {string}, {string} and {string}', async function (this: World, a: string, b: string, c: string, d: string) {
  // butterflies (bats at Halloween) only visit now and then: the test hook starts a visit at once (STEPS.md scene notes)
  const parts = [a, b, c, d].map((n) => n.trim().toLowerCase().replace(/['’]/g, '').replace(/\s+/g, '-'));
  if (parts.some((p) => p === 'butterfly' || p === 'bat')) {
    await this.context.addInitScript(() => { (window as unknown as { __butterflyNow?: boolean }).__butterflyNow = true; });
    await this.page.reload();
  }
  await backToCalendar(this);
  const scene = this.page.getByTestId('top-bar-scene');
  for (const part of parts) await expect(scene.locator(`[data-part="${part}"]`).first(), part).toBeVisible();
});

Then('the theme menu sections are {string}, {string} and {string}', async function (this: World, a: string, b: string, c: string) {
  await expect(this.page.locator('[data-testid="theme-section"] > h2')).toHaveText([a, b, c]);
});

Then('the theme menu has no Mordor button', async function (this: World) {
  await expect(this.page.getByTestId('theme-view')).toBeVisible();
  await expect(this.page.getByTestId('settings-theme-mordor')).toHaveCount(0);
});

Then('the scene choices are {string}, {string}, {string} and {string}', async function (this: World, a: string, b: string, c: string, d: string) {
  // the choices live in their own "Scene" section, not in the fine-tuning one
  await expect(this.page.locator('[data-testid="theme-section"][data-section="scene"] [data-testid="theme-option"] .ol')).toHaveText([a, b, c, d]);
  await expect(this.page.locator('[data-testid="theme-section"][data-section="fine-tuning"] [data-testid="theme-option"][data-setting="scene"]')).toHaveCount(0);
  // the old second control is gone
  await expect(this.page.getByTestId('settings-scene')).toHaveCount(0);
});

Then('the top bar shows the {string} scene', async function (this: World, name: string) {
  await backToCalendar(this);
  await expect(this.page.getByTestId('top-bar-scene')).toHaveAttribute('data-scene', name);
});

Then('the top bar shows no scene', async function (this: World) {
  await backToCalendar(this);
  await expect(this.page.getByTestId('top-bar-scene')).toHaveCount(0);
});

Then('the settings show the theme {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('settings-theme-name')).toHaveText(text);
});

// ---- Theme import (STEPS.md "Theme import (`@theme-import`)") ----

const themeFile = (name: string) => path.join(import.meta.dirname, '../fixtures/themes', name);
const preview = (world: World) => world.page.getByTestId('theme-import-preview');

When('I choose "Create with AI"', async function (this: World) {
  await this.page.getByTestId('theme-ai').click();
});

Then('I see a prompt that describes the theme file {string}', async function (this: World, schema: string) {
  const prompt = this.page.getByTestId('theme-ai-prompt');
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText(schema);
});

Then('I can copy the prompt', async function (this: World) {
  await this.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await this.page.getByTestId('theme-ai-copy').click();
  const shown = await this.page.getByTestId('theme-ai-prompt').textContent();
  await expect.poll(() => this.page.evaluate(() => navigator.clipboard.readText())).toBe(shown);
});

When('I import the theme file {string}', async function (this: World, name: string) {
  await this.page.getByTestId('theme-import-file').setInputFiles(themeFile(name));
});

When('I paste the theme text {string}', async function (this: World, text: string) {
  await this.page.getByTestId('theme-import-text').fill(text);
  await this.page.getByTestId('theme-import-submit').click();
});

Then('the import preview shows the theme {string}', async function (this: World, name: string) {
  await expect(preview(this)).toHaveAttribute('data-name', name);
});

When('I save the imported theme', async function (this: World) {
  // saving stores the theme, then chooses it: wait for both requests
  const stored = this.page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/themes'));
  const chosen = this.page.waitForResponse(isSaved);
  await this.page.getByTestId('theme-import-save').click();
  expect((await stored).status()).toBe(201);
  await chosen;
});

Then('the gallery offers the theme {string}', async function (this: World, name: string) {
  await ensureMenu(this);
  await expect(card(this, name)).toBeVisible();
});

Then('the gallery does not offer the theme {string}', async function (this: World, name: string) {
  await ensureMenu(this);
  await expect(card(this, name)).toHaveCount(0);
});

Then('the import says {string}', async function (this: World, message: string) {
  await expect(this.page.getByTestId('theme-import-error').filter({ hasText: exactText(message) })).toHaveCount(1);
});

Then('I cannot save the imported theme', async function (this: World) {
  await expect(this.page.getByTestId('theme-import-save')).toBeDisabled();
});

Then('the import notes that unsafe content was removed', async function (this: World) {
  await expect(this.page.getByTestId('theme-import-sanitized')).toBeVisible();
});

Then('no script from the theme runs', async function (this: World) {
  // the picture is only an image: give a script that slipped through a second to run, then look for its mark
  await this.page.waitForTimeout(1000);
  expect(await this.page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined();
  await expect(preview(this).locator('script')).toHaveCount(0);
  await expect(this.page.getByTestId('top-bar-scene').locator('script')).toHaveCount(0);
});

Given('{string} imported the theme file {string}', async function (this: World, email: string, name: string) {
  await signInAs(this, email);
  const res = await this.page.request.post('/api/themes', { data: JSON.parse(fs.readFileSync(themeFile(name), 'utf8')) });
  expect(res.status(), await res.text()).toBe(201);
});

When('I delete the theme {string}', async function (this: World, name: string) {
  await ensureMenu(this);
  await this.page.locator(`[data-testid="theme-item"][data-name="${name}"]`).getByTestId('theme-delete').click();
  await expect(card(this, name)).toHaveCount(0);
});
