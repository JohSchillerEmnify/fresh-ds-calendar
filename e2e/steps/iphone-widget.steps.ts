/**
 * iPhone widget steps (STEPS.md "iPhone widgets"): the Settings part runs in the browser. The widget key's secret is read
 * from the installer text the setup holds (the key exists nowhere else in the page), so the steps can use it later.
 * Everything about the script itself is proven by `server/test/ios-widget.test.ts` and `server/test/widget-keys.test.ts`.
 */
import { expect, type Locator } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { berlinIso } from './support/dates.js';
import { openSettingsPage, settingControl } from './support/settings.js';
import { chooseOption, selectedLabel } from './support/ui.js';
import type { World } from './support/world.js';

/** The secrets of the keys this scenario created, by device name. */
const secrets = new WeakMap<World, Map<string, string>>();
const secretsOf = (w: World) => secrets.get(w) ?? secrets.set(w, new Map()).get(w)!;

const SCRIPTABLE_STORE = 'https://apps.apple.com/app/id1405459188';
const sheet = (w: World) => w.page.getByTestId('iphone-widget-sheet');
const step = (w: World, n: number) => w.page.getByTestId(`iphone-widget-step-${n}`);
const rowOf = (w: World, name: string): Locator => w.page.getByTestId('iphone-widget-key-row').filter({ hasText: name });

async function openSection(w: World) {
  await openSettingsPage(w, 'widgets');
  await expect(w.page.getByTestId('iphone-widget-keys')).toBeVisible();
}

async function createKey(w: World, name: string) {
  await openSection(w);
  const add = w.page.getByTestId('iphone-widget-add').or(w.page.getByTestId('iphone-widget-add-another')).first();
  await add.click();
  await w.page.getByTestId('iphone-widget-name').fill(name);
  await w.page.getByTestId('iphone-widget-create').click();
  await expect(w.page.getByTestId('iphone-widget-guide')).toBeVisible();
  const text = await w.page.getByTestId('iphone-widget-installer-text').inputValue();
  secretsOf(w).set(name, /"(cwk_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43})"/.exec(text)![1]!);
}

/** A key made through the API (a person's earlier visit), for the list scenarios. */
async function ensureKey(w: World, name: string) {
  const list = (await (await w.page.request.get('/api/widget-keys')).json()) as { name: string }[];
  if (list.some((k) => k.name === name)) return;
  const made = await w.page.request.post('/api/widget-keys', { data: { name } });
  expect(made.status()).toBe(201);
}

When('I open the iPhone widget settings', async function (this: World) { await openSection(this); });

When('I open the iPhone widget settings again', async function (this: World) {
  await this.page.goto('/settings/widgets');
  await expect(this.page.getByTestId('iphone-widget-keys')).toBeVisible();
});

When('I create a widget key named {string}', async function (this: World, name: string) { await createKey(this, name); });
Given('I created a widget key named {string}', async function (this: World, name: string) { await createKey(this, name); });

Then('the settings show the widget key {string}', async function (this: World, name: string) {
  // the new key's row is behind the open sheet's scrim: the list is checked in the page, whatever covers it
  await expect(rowOf(this, name)).toHaveCount(1, { timeout: 10_000 });
});

Then('the settings show the widget key {string} last used on {date} at {time}', async function (this: World, name: string, date: string, time: string) {
  await expect(rowOf(this, name).locator('[data-last-used-local]')).toHaveAttribute('data-last-used-local', `${date} ${time}`);
});

Then('the settings show the widget key {string} as never used', async function (this: World, name: string) {
  await expect(rowOf(this, name).locator('[data-never]')).toHaveCount(1);
});

Then('the settings do not show the widget key itself', async function (this: World) {
  const body = await this.page.locator('body').innerText();
  expect(body).not.toMatch(/cwk_/);
  for (const secret of secretsOf(this).values()) expect(await this.page.content()).not.toContain(secret.slice('cwk_AAAAAAAA_'.length));
});

Then('the new widget key is shown once with the buttons {string} and {string}', async function (this: World, a: string, b: string) {
  await expect(this.page.getByTestId('iphone-widget-copy-installer')).toHaveText(a);
  await expect(this.page.getByTestId('iphone-widget-open-scriptable')).toHaveText(b);
});

Then('the setup offers a link to get Scriptable', async function (this: World) {
  const link = this.page.getByTestId('iphone-widget-get-scriptable');
  await expect(link).toHaveAttribute('href', SCRIPTABLE_STORE);
  await expect(step(this, 1)).toContainText('Scriptable');
});

Then('the setup says {string}', async function (this: World, text: string) {
  await expect(sheet(this).getByText(text, { exact: true })).toBeVisible();
});

Then('the setup guide step {int} says {string} and expects {string}', async function (this: World, n: number, action: string, hint: string) {
  await expect(step(this, n)).toContainText(action);
  await expect(this.page.getByTestId(`iphone-widget-step-${n}-expects`)).toHaveText(hint);
});

Then('the setup guide step {int} says {string} and has no hint', async function (this: World, n: number, action: string) {
  await expect(step(this, n)).toContainText(action);
  await expect(this.page.getByTestId(`iphone-widget-step-${n}-expects`)).toHaveCount(0);
});

When('I copy the widget installer', async function (this: World) {
  await this.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await this.page.getByTestId('iphone-widget-copy-installer').click();
});

Then('the button {string} now says {string}', async function (this: World, _before: string, after: string) {
  await expect(this.page.getByTestId('iphone-widget-copy-installer')).toHaveText(after);
});

/** What the copy button put on the clipboard (the installer text), or the installer text the sheet holds when the browser refuses to read it. */
async function copied(w: World): Promise<string> {
  const read = await w.page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  return read || (await w.page.getByTestId('iphone-widget-installer-text').inputValue());
}

Then('the copied widget installer holds the key and the server URL', async function (this: World) {
  const text = await copied(this);
  expect(text.split('\n')[0]).toBe('// Calendar widget installer');
  expect(text).toContain([...secretsOf(this).values()][0]!);
  expect(text).toContain(JSON.stringify(new URL(this.page.url()).origin));
});

Then('the copied widget installer says nothing else to fill in', async function (this: World) {
  expect(await copied(this)).not.toMatch(/YOUR|TODO|<[A-Z ]+>|fill in/i);
});

Given('the widget key {string} was last used on {date} at {time}', async function (this: World, name: string, date: string, time: string) {
  await ensureKey(this, name);
  await this.api.post('/api/__test/widget-keys/last-used', { name, at: new Date(berlinIso(date, time)).toISOString() });
});

Given('the widget key {string} was never used', async function (this: World, name: string) {
  await ensureKey(this, name);
  await this.api.post('/api/__test/widget-keys/last-used', { name, at: null });
});

When('the iPhone widget refreshes with the key {string}', async function (this: World, name: string) {
  const secret = secretsOf(this).get(name);
  expect(secret, `the key "${name}" was created by this scenario`).toBeTruthy();
  const r = await this.page.request.get('/api/widget/data?from=2026-10-14&to=2026-10-15', { headers: { authorization: `Bearer ${secret}` } });
  expect(r.status()).toBe(200);
});

Then('the setup guide shows {string} for the widget key {string}', async function (this: World, text: string, name: string) {
  // the open setup reads the key list again every few seconds
  await expect(this.page.getByTestId('iphone-widget-connected')).toContainText(`${text} – ${name}`, { timeout: 20_000 });
});

Then('the lock screen circle is set to {string}', async function (this: World, label: string) {
  const control = await settingControl(this, 'settings-widget-circle');
  await expect.poll(async () => selectedLabel(control)).toBe(label);
});

Then('the lock screen circle row says {string}', async function (this: World, hint: string) {
  await expect(this.page.getByTestId('settings-widget-circle-hint')).toHaveText(hint);
});

When('I set the lock screen circle to {string}', async function (this: World, label: string) {
  const control = await settingControl(this, 'settings-widget-circle');
  const saved = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/prefs' && r.request().method() === 'PATCH');
  await chooseOption(control, label);
  expect((await saved).status(), 'prefs saved').toBe(200);
});
