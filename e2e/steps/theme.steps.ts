/** Material 3 theme steps (STEPS.md "Theme"). */
import fs from 'node:fs';
import path from 'node:path';
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import type { Scheme } from './parameters.js';
import { contrastRatio, cssColorToRgba, roleHex, toHex } from './support/color.js';
import { exactText, tid, type World } from './support/world.js';
import { openSettingsPage, settingControl, turnOnLabsSwitch } from './support/settings.js';

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
  await openSettingsPage(world, 'theme');
}

/** The theme menu is a page over the calendar: leave it through the browser history to see the calendar again. */
async function backToCalendar(world: World) {
  const menu = world.page.getByTestId('theme-view').or(world.page.getByTestId('settings-view'));
  // right after a reload the page may not be rendered yet: wait for it, or the menu is mistaken for already left
  await expect(menu.or(world.page.locator(['month-view', 'week-view', 'day-view', 'year-view'].map(tid).join(', '))).first()).toBeVisible();
  // menu -> Appearance & layout -> settings -> calendar
  for (let i = 0; i < 3 && (await menu.isVisible()); i++) {
    await world.page.goBack();
  }
  await world.calendarShown();
}

/** Clicks a gallery card and waits until the choice has been saved in the background. */
export async function chooseTheme(world: World, name: string) {
  const saved = world.page.waitForResponse(isSaved);
  await card(world, name).click();
  await expect(card(world, name)).toHaveAttribute('aria-pressed', 'true');
  await saved;
}

/** The theme menu is open; from the settings screen, or from the week view for today when nothing is open yet. */
async function ensureMenu(world: World) {
  if (await world.page.getByTestId('theme-view').isVisible()) return;
  if (await world.page.getByTestId('settings-view').isVisible()) {
    await openSettingsPage(world, 'theme');
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
  for (let i = 0; i < 3 && !(await this.page.getByTestId('theme-view').isVisible()); i++) await this.page.goForward();
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
  for (const part of parts) {
    // a part left out where it would be under a control (data-hidden) does not count; another one of its kind may show
    const el = scene.locator(`[data-part="${part}"]:not([data-hidden])`).first();
    await expect(el, part).toBeAttached();
    // fireworks and confetti are 0x0 anchors whose pieces are drawn around them: a box-less anchor is judged by its first piece
    const box = await el.boundingBox();
    const target = box && box.width > 0 && box.height > 0 ? el : el.locator('> *').first();
    await expect(target, part).toBeVisible();
  }
});

/** How many CSS animations inside the top bar scene are running (STEPS.md scene notes). */
async function runningSceneAnimations(world: World, within = '[data-testid="top-bar-scene"]'): Promise<number> {
  // the scene parts come in a lazy chunk: count only once the scene has drawn its parts, never on an empty bar
  await expect(world.page.locator(within).first()).toBeAttached();
  await expect(world.page.getByTestId('top-bar-scene').locator('[data-part]').first()).toBeAttached();
  return world.page.evaluate((sel) => {
    const scene = document.querySelector(sel);
    if (!scene) throw new Error(`no ${sel}`);
    return document.getAnimations().filter((a) => {
      const target = (a.effect as KeyframeEffect | null)?.target;
      return a.playState === 'running' && !!target && scene.contains(target);
    }).length;
  }, within);
}

Then('the top bar scene is moving', async function (this: World) {
  await expect.poll(() => runningSceneAnimations(this), { message: 'running scene animations' }).toBeGreaterThan(0);
});

Then('the top bar scene is still', async function (this: World) {
  await expect(this.page.locator('html')).toHaveAttribute('data-scenes', 'still');
  await expect.poll(() => runningSceneAnimations(this), { message: 'running scene animations' }).toBe(0);
  await expect(this.page.getByTestId('top-bar-scene').locator('[data-part="butterfly"], [data-part="bat"], [data-part="ghost"]')).toHaveCount(0);
});

Then('the scene\'s cat is moving', async function (this: World) {
  const cat = '[data-testid="top-bar-scene"] [data-part="cat"]';
  await expect.poll(() => runningSceneAnimations(this, cat), { message: 'running cat animations' }).toBeGreaterThan(0);
});

Then('a visitor passes through the top bar scene', async function (this: World) {
  await expect(this.page.getByTestId('top-bar-scene').locator('[data-part="butterfly"], [data-part="bat"], [data-part="ghost"]').first()).toBeVisible();
});

Then('the visitor flies across the top bar scene', async function (this: World) {
  const scene = this.page.getByTestId('top-bar-scene');
  const visitor = scene.locator('[data-part="butterfly"], [data-part="bat"], [data-part="ghost"]').first();
  await expect(visitor).toBeVisible();
  const box = await scene.boundingBox();
  if (!box) throw new Error('the top bar scene has no box');
  // the flight is the visitor's own animation (the wing flap runs on a child): seek it instead of waiting 10 s
  const samples: { at: number; x: number; y: number; w: number; h: number }[] = [];
  for (let at = 5; at <= 95; at += 5) {
    const b = await visitor.evaluate((el, pct) => {
      const flight = el.getAnimations().find((a) => (a.effect as KeyframeEffect | null)?.target === el);
      if (!flight) return null;
      flight.pause();
      flight.currentTime = (Number(flight.effect?.getComputedTiming().duration) * pct) / 100;
      return el.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number };
    }, at);
    if (!b) throw new Error('the visitor has no flight animation (it stays where it is)');
    samples.push({ at, x: b.x, y: b.y, w: b.width, h: b.height });
  }
  const centres = samples.map((s) => (s.x + s.w / 2 - box.x) / box.width);
  expect(Math.min(...centres), 'reaches the left quarter').toBeLessThan(0.25);
  expect(Math.max(...centres), 'reaches the right quarter').toBeGreaterThan(0.75);
  for (const s of samples.filter((p) => p.at >= 20 && p.at <= 80)) {
    expect(s.x, `${s.at} %: left edge inside`).toBeGreaterThanOrEqual(box.x);
    expect(s.y, `${s.at} %: top edge inside`).toBeGreaterThanOrEqual(box.y);
    expect(s.x + s.w, `${s.at} %: right edge inside`).toBeLessThanOrEqual(box.x + box.width);
    expect(s.y + s.h, `${s.at} %: bottom edge inside`).toBeLessThanOrEqual(box.y + box.height);
  }
});

Then('the theme menu sections are {string}, {string}, {string} and {string}', async function (this: World, a: string, b: string, c: string, d: string) {
  await expect(this.page.locator('[data-testid="theme-section"] > h2')).toHaveText([a, b, c, d]);
});

Then('the theme menu has no Mordor button', async function (this: World) {
  await expect(this.page.getByTestId('theme-view')).toBeVisible();
  await expect(this.page.getByTestId('settings-theme-mordor')).toHaveCount(0);
});

Then('the scene choices are {string}', async function (this: World, list: string) {
  // the choices live in their own "Scene" section, not in the fine-tuning one
  await expect(this.page.locator('[data-testid="theme-section"][data-section="scene"] [data-testid="theme-option"] .ol')).toHaveText(list.split(', '));
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
  await expect(await settingControl(this, 'settings-theme-name')).toHaveText(text);
});

When('I set the seasons and holidays to {string}', async function (this: World, label: string) {
  await ensureMenu(this);
  const o = this.page.getByTestId('theme-seasonal').getByRole('button', { name: label, exact: true });
  if ((await o.getAttribute('aria-pressed')) !== 'true') {
    const saved = this.page.waitForResponse(isSaved);
    await o.click();
    await saved;
  }
  await expect(o).toHaveAttribute('aria-pressed', 'true');
});

Given('the seasons and holidays are off', async function (this: World) {
  // the current session's person (the page may be signed in as someone else), so not this.api
  const res = await this.page.request.patch('/api/prefs/theme', { data: { seasonal: 'off' } });
  expect(res.ok(), await res.text()).toBe(true);
});

Given('the seasons and holidays follow the calendar', async function (this: World) {
  // the default of a new person, put back after a Background turned it off
  const res = await this.page.request.patch('/api/prefs/theme', { data: { seasonal: 'all' } });
  expect(res.ok(), await res.text()).toBe(true);
});

Then('the seasons and holidays are set to {string}', async function (this: World, label: string) {
  await ensureMenu(this);
  await expect(this.page.getByTestId('theme-seasonal').getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
});

Then('the advent timeline shows {int} lit candle(s)', async function (this: World, n: number) {
  await backToCalendar(this);
  const scene = this.page.getByTestId('top-bar-scene');
  await expect(scene.getByTestId('advent-candle')).toHaveCount(4);
  await expect(scene.locator('[data-testid="advent-candle"][data-lit="true"]')).toHaveCount(n);
});

async function treeLights(world: World, state: 'on' | 'off') {
  await backToCalendar(world);
  const tree = world.page.getByTestId('top-bar-scene').getByTestId('xmas-tree');
  await expect(tree).toHaveAttribute('data-lights', state);
  // the tree ends the timeline: it stands right of the fourth candle
  const [t, c] = await Promise.all([tree.boundingBox(), world.page.getByTestId('top-bar-scene').getByTestId('advent-candle').nth(3).boundingBox()]);
  expect(t!.x).toBeGreaterThan(c!.x + c!.width);
}
Then('the Christmas tree lights are on', async function (this: World) { await treeLights(this, 'on'); });
Then('the Christmas tree lights are off', async function (this: World) { await treeLights(this, 'off'); });

// ---- Theme import (STEPS.md "Theme import (`@theme-import`)") ----

const themeFile = (name: string) => path.join(import.meta.dirname, '../fixtures/themes', name);
const preview = (world: World) => world.page.getByTestId('theme-import-preview');

When('I choose "Create with AI"', async function (this: World) {
  await this.page.getByTestId('theme-ai').click();
});

Then('I see a prompt that describes the theme file {string}', async function (this: World, schema: string) {
  const prompt = this.page.getByTestId('theme-ai-prompt');
  await expect(prompt).toBeVisible();
  expect(await prompt.inputValue()).toContain(schema);
});

Then('I can copy the prompt', async function (this: World) {
  await this.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // the app is served over plain http on the LAN: copy as an insecure context would (no async Clipboard API)
  await this.page.evaluate(() => Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true }));
  await this.page.getByTestId('theme-ai-copy').click();
  const shown = await this.page.getByTestId('theme-ai-prompt').inputValue();
  await expect.poll(() => this.page.evaluate(() => navigator.clipboard.readText())).toBe(shown);
});

When('I import the theme file {string}', async function (this: World, name: string) {
  await this.page.getByTestId('theme-import-file').setInputFiles(themeFile(name));
});

When('I paste the theme text {string}', async function (this: World, text: string) {
  await this.page.getByTestId('theme-import-text').fill(text);
  await this.page.getByTestId('theme-import-submit').click();
});

When('I paste the AI answer {string}', async function (this: World, name: string) {
  await this.page.getByTestId('theme-import-text').fill(fs.readFileSync(themeFile(name), 'utf8'));
  await this.page.getByTestId('theme-import-submit').click();
});

When('I upload the picture file {string}', async function (this: World, name: string) {
  await this.page.getByTestId('theme-picture-file').setInputFiles(themeFile(name));
});

Then('I can copy the repair prompt', async function (this: World) {
  await this.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await this.page.evaluate(() => Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true }));
  await this.page.getByTestId('theme-repair-copy').click();
  const shown = await this.page.getByTestId('theme-repair-prompt').inputValue();
  await expect.poll(() => this.page.evaluate(() => navigator.clipboard.readText())).toBe(shown);
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
  const res = await this.page.request.post('/api/themes', { data: { theme: JSON.parse(fs.readFileSync(themeFile(name), 'utf8')) } });
  expect(res.status(), await res.text()).toBe(201);
});

When('I delete the theme {string}', async function (this: World, name: string) {
  await ensureMenu(this);
  await this.page.locator(`[data-testid="theme-item"][data-name="${name}"]`).getByTestId('theme-delete').click();
  await expect(card(this, name)).toHaveCount(0);
});

const downloads = new WeakMap<World, { name: string; text: string }>();

When('I export the theme {string}', async function (this: World, name: string) {
  await ensureMenu(this);
  const download = this.page.waitForEvent('download');
  await this.page.locator(`[data-testid="theme-item"][data-name="${name}"]`).getByTestId('theme-export').click();
  const file = await download;
  downloads.set(this, { name: file.suggestedFilename(), text: fs.readFileSync((await file.path())!, 'utf8') });
});

Then('the theme file {string} is downloaded', async function (this: World, name: string) {
  expect(downloads.get(this)?.name).toBe(name);
});

Then('the downloaded theme file has no header layout', async function (this: World) {
  const keys: string[] = [];
  const walk = (v: unknown) => { if (v && typeof v === 'object') for (const [k, c] of Object.entries(v)) { keys.push(k); walk(c); } };
  walk(JSON.parse(downloads.get(this)!.text));
  expect(keys.filter((k) => /header/i.test(k))).toEqual([]);
});

// ---- Labs switch for the AI part, drawn scene, own picture, Save as my theme ----

Given('the AI theme prompt is turned on in Labs', async function (this: World) {
  await this.api.patch('/api/prefs', { labs: true, labsOwnThemes: true });
});

When('I turn on the AI theme prompt in the settings', async function (this: World) {
  // the AI switch sits under the experimental master switch
  await turnOnLabsSwitch(this, 'settings-labs');
  await turnOnLabsSwitch(this, 'settings-labs-own-themes');
});

Then('the theme menu has no AI prompt', async function (this: World) {
  await ensureMenu(this);
  await expect(this.page.getByTestId('theme-own')).toBeVisible();
  await expect(this.page.getByTestId('theme-ai')).toHaveCount(0);
});

Then('the theme menu has an AI prompt', async function (this: World) {
  await ensureMenu(this);
  await expect(this.page.getByTestId('theme-ai')).toBeVisible();
});

Then('the theme menu has the import block', async function (this: World) {
  await ensureMenu(this);
  await expect(this.page.getByTestId('theme-own')).toBeVisible();
  await expect(this.page.getByTestId('theme-import-text')).toBeVisible();
});

Then('the top bar draws the decor {string}', async function (this: World, decor: string) {
  await backToCalendar(this);
  await expect(this.page.getByTestId('top-bar-scene').getByTestId('drawn-scene')).toHaveAttribute('data-decor', decor);
});

Then('the top bar shows the picture of the theme', async function (this: World) {
  await backToCalendar(this);
  const scene = this.page.getByTestId('top-bar-scene');
  await expect(scene.getByTestId('scene-image')).toBeVisible();
  await expect(scene.getByTestId('drawn-scene')).toHaveCount(0);
});

Given('{string} uses the imported theme {string}', async function (this: World, _email: string, name: string) {
  const { themes } = (await (await this.page.request.get('/api/themes')).json()) as { themes: { id: string; doc: { name: string } }[] };
  const found = themes.find((t) => t.doc.name === name);
  expect(found, `imported theme ${name}`).toBeTruthy();
  const res = await this.page.request.patch('/api/prefs/theme', { data: { preset: `theme:${found!.id}` } });
  expect(res.ok()).toBe(true);
});

When('I save my look as my own theme named {string}', async function (this: World, name: string) {
  await ensureMenu(this);
  await this.page.getByTestId('theme-save-own').click();
  await this.page.getByTestId('theme-save-name').fill(name);
  // saving stores the theme, then chooses it: wait for both requests
  const stored = this.page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/themes'));
  const chosen = this.page.waitForResponse(isSaved);
  await this.page.getByTestId('theme-save-confirm').click();
  expect((await stored).status()).toBe(201);
  await chosen;
  await expect(this.page.getByTestId('theme-save-dialog')).toHaveCount(0);
});

Then('my own theme {string} has {string} set to {string}', async function (this: World, name: string, key: string, value: string) {
  const { themes } = (await (await this.page.request.get('/api/themes')).json()) as { themes: { doc: Record<string, unknown> }[] };
  const found = themes.find((t) => t.doc.name === name);
  expect(found, `own theme ${name}`).toBeTruthy();
  expect(String(found!.doc[key])).toBe(value);
});

// --- Fine-tuning: sliders, density, checkbox choices (STEPS.md "Fine-tuning sliders") ---------------------------------
const SLIDERS: Record<string, string> = { 'Glow strength': 'theme-slider-glow', 'Corner radius': 'theme-slider-radius', 'Entry tint': 'theme-slider-tint' };
const CHOICES: Record<string, string> = { Density: 'theme-density', 'Checkbox shape': 'theme-checkbox-shape', 'Checkbox fill': 'theme-check-fill', 'Check mark': 'theme-check-glyph', 'Icon set': 'theme-icon-set' };

When('I set the {string} slider to {int}', async function (this: World, label: string, value: number) {
  await ensureMenu(this);
  const saved = this.page.waitForResponse(isSaved);
  await this.page.getByTestId(SLIDERS[label]!).fill(String(value));
  await saved;
});

Then('the {string} slider shows {string}', async function (this: World, label: string, text: string) {
  await expect(this.page.getByTestId(`${SLIDERS[label]!}-value`)).toHaveText(text);
});

Then('the {string} slider is disabled', async function (this: World, label: string) {
  await expect(this.page.getByTestId(SLIDERS[label]!)).toBeDisabled();
});

Then('no option for {string} is pressed', async function (this: World, label: string) {
  await expect(this.page.locator(`[data-testid="theme-option"][data-setting="${label.toLowerCase()}"][aria-pressed="true"]`)).toHaveCount(0);
});

Then('the option {string} for {string} is pressed', async function (this: World, value: string, label: string) {
  await expect(option(this, label, value)).toHaveAttribute('aria-pressed', 'true');
});

When('I choose {string} for the {string} setting', async function (this: World, value: string, label: string) {
  await ensureMenu(this);
  const saved = this.page.waitForResponse(isSaved);
  const o = this.page.getByTestId(CHOICES[label]!).getByRole('button', { name: value, exact: true });
  await o.click();
  await expect(o).toHaveAttribute('aria-pressed', 'true');
  await saved;
});

Then('the event {string} has a corner radius of {int} px', async function (this: World, name: string, px: number) {
  await backToCalendar(this);
  const chip = this.eventChip(name);
  await expect(chip).toBeVisible();
  await expect.poll(() => chip.evaluate((n) => parseFloat(getComputedStyle(n).borderTopLeftRadius))).toBe(px);
});

Then('the preview event has a corner radius of {int} px', async function (this: World, px: number) {
  const ev = this.page.getByTestId('theme-preview-event');
  await expect(ev).toBeVisible();
  await expect.poll(() => ev.evaluate((n) => parseFloat(getComputedStyle(n).borderTopLeftRadius))).toBe(px);
});

When('I scroll the theme menu to the {string} section', async function (this: World, heading: string) {
  await ensureMenu(this);
  const section = this.page.getByTestId('theme-section').filter({ has: this.page.getByRole('heading', { name: heading, exact: true }) });
  await section.scrollIntoViewIfNeeded();
  await expect(section).toBeInViewport();
});

Then('the live preview is pinned under the theme menu header', async function (this: World) {
  const preview = this.page.getByTestId('theme-live-preview');
  await expect(preview).toBeInViewport({ ratio: 1 });
  const header = await this.page.getByTestId('theme-view').locator('header').first().boundingBox();
  await expect.poll(async () => Math.abs(((await preview.boundingBox())?.y ?? -999) - (header!.y + header!.height))).toBeLessThanOrEqual(2);
});

const livePreviewToggle = (world: World) => world.page.getByTestId('theme-live-preview-toggle');
const setLivePreviewCollapsed = async (world: World, want: boolean) => {
  const preview = world.page.getByTestId('theme-live-preview');
  await expect(preview).toBeVisible();
  if ((await preview.getAttribute('data-collapsed')) !== String(want)) await livePreviewToggle(world).click();
  await expect(preview).toHaveAttribute('data-collapsed', String(want));
};

When('I collapse the live preview', async function (this: World) {
  await setLivePreviewCollapsed(this, true);
});
When('I expand the live preview', async function (this: World) {
  await setLivePreviewCollapsed(this, false);
});
Then('the live preview is collapsed', async function (this: World) {
  await expect(this.page.getByTestId('theme-live-preview')).toHaveAttribute('data-collapsed', 'true');
});
Then('the live preview is expanded', async function (this: World) {
  await expect(this.page.getByTestId('theme-live-preview')).toHaveAttribute('data-collapsed', 'false');
});

/** Blur radii (px) of the coloured shadows of an element: the glow, not the black elevation shadows. */
async function glowBlurs(chip: Locator): Promise<number[]> {
  const shadow = await chip.evaluate((n) => getComputedStyle(n).boxShadow);
  return shadow.split(/,(?![^(]*\))/).flatMap((p) => {
    const colour = /(rgba?|color)\([^)]*\)/.exec(p)?.[0] ?? '';
    const alpha = Number(/\/\s*([\d.]+)\s*\)/.exec(colour)?.[1] ?? /rgba?\([^)]*?,\s*([\d.]+)\)/.exec(colour)?.[1] ?? '1');
    const black = /^(rgba?\(\s*0,\s*0,\s*0|color\(srgb 0 0 0)/.test(colour);
    const blur = parseFloat(p.replace(colour, '').match(/-?[\d.]+px/g)?.[2] ?? '0');
    return alpha > 0 && !black && blur > 0 ? [blur] : [];
  });
}

Then('the event {string} glows with a blur between {int} and {int} px', async function (this: World, name: string, min: number, max: number) {
  await backToCalendar(this);
  const chip = this.eventChip(name);
  await expect(chip).toBeVisible();
  await expect.poll(async () => Math.max(0, ...(await glowBlurs(chip)))).toBeGreaterThanOrEqual(min);
  expect(Math.max(...(await glowBlurs(chip)))).toBeLessThanOrEqual(max);
});

Then('the event {string} does not glow', async function (this: World, name: string) {
  await backToCalendar(this);
  const chip = this.eventChip(name);
  await expect(chip).toBeVisible();
  await expect.poll(() => glowBlurs(chip)).toEqual([]);
});

Then('the entry tint is {int} %', async function (this: World, pct: number) {
  await expect.poll(() => this.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--e-fill').trim())).toBe(`${pct}%`);
});

Then('the app text is {float} px', async function (this: World, px: number) {
  await expect.poll(() => this.page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))).toBeCloseTo(px, 2);
});

Then('the task item checkboxes are drawn as {string} with a {string} mark', async function (this: World, shape: string, glyph: string) {
  const html = this.page.locator('html');
  await expect(html).toHaveAttribute('data-checkbox', shape);
  await expect(html).toHaveAttribute('data-check', glyph);
  const boxes = this.page.getByTestId('tasklist-item-checkbox');
  await expect(boxes.first()).toBeVisible();
  // only the chosen glyph is drawn; the other three are display: none
  const shown = await boxes.first().locator('.rcb-check').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.getAttribute('data-glyph')));
  expect(shown).toEqual([glyph]);
});

/** The glyph paths of the icons last checked per scenario, to prove another set draws other shapes. */
const drawnIcons = new WeakMap<object, { set: string; drawing: string }>();

Then('the app uses the {string} icon set', async function (this: World, set: string) {
  await expect(this.page.locator('html')).toHaveAttribute('data-icons', set);
  // the icons of the menu itself are drawn in that set too
  await expect(this.page.getByTestId('theme-back').locator('svg').first()).toHaveAttribute('data-icon-set', set);
  // every icon on screen (the menu's per-option samples excepted) is drawn in that set, and the drawn glyphs differ from the previously checked set
  await expect.poll(() => this.page.evaluate(() => [...new Set([...document.querySelectorAll('svg[data-icon-set]')].filter((e) => !e.closest('.isamp')).map((e) => e.getAttribute('data-icon-set')))].join())).toBe(set);
  const drawing = await this.page.evaluate(() => [...document.querySelectorAll('svg[data-icon-set]')].filter((e) => !e.closest('.isamp')).map((e) => [...e.querySelectorAll('path')].map((p) => p.getAttribute('d')).join('')).join('|'));
  const before = drawnIcons.get(this);
  drawnIcons.set(this, { set, drawing });
  if (before && before.set !== set) expect(drawing, `icons drawn in "${set}" look the same as in "${before.set}"`).not.toBe(before.drawing);
});

Then('every option of the {string} setting shows a sample icon', async function (this: World, label: string) {
  const options = this.page.getByTestId(CHOICES[label]!).getByRole('button');
  const n = await options.count();
  expect(n).toBeGreaterThan(1);
  for (let i = 0; i < n; i++) await expect(options.nth(i).locator('.isamp svg').first()).toBeVisible();
});
