/**
 * Backup to Google Drive steps (STEPS.md "Backup to Google Drive"). Drive is `MockDrive` in TEST_MODE; the test hooks
 * force the debounce and daily timers and simulate a server that lost its data.
 */
import { expect, type APIRequestContext } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { signIn } from './signin.steps.js';
import { chooseTheme } from './theme.steps.js';
import type { World } from './support/world.js';

const SUPPORT_CAT = { Off: 'off', Sometimes: 'sometimes', 'Every time': 'always' } as const;
const status = (w: World) => w.page.getByTestId('settings-backup-status');

/** Shows the settings (the backup rows are in Account & data) unless they are open. */
async function settings(w: World) {
  if (new URL(w.page.url(), 'http://x').pathname !== '/settings') await w.page.goto('/settings');
  await expect(w.page.getByTestId('settings-view')).toBeVisible();
}

/** The Berlin wall-clock minute of an instant as `YYYY-MM-DD HH:mm`. */
const berlin = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

Given('the quiet period of the backup has passed', async function (this: World) {
  await this.api.post('/api/__test/backup/flush');
});

When('a day passes on the server', async function (this: World) {
  // (the page's own request context carries the session cookie; /api/config needs one while sign-in is on)
  const now = new Date(((await (await this.page.request.get('/api/config')).json()) as { now: string }).now);
  await this.api.setClock(new Date(now.getTime() + 24 * 3_600_000).toISOString());
  await this.api.post('/api/__test/backup/tick');
});

Then('the Drive holds {int} backup(s) of {string}', async function (this: World, n: number, email: string) {
  const { files } = await this.api.get<{ files: unknown[] }>(`/api/__test/backup/drive?owner=${encodeURIComponent(email)}`);
  expect(files).toHaveLength(n);
});

Given('I back up now', async function (this: World) {
  await settings(this);
  const done = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/backup' && r.request().method() === 'POST');
  await this.page.getByTestId('settings-backup-now').click();
  await done;
});

Then('the last backup is from {date} at {time}', async function (this: World, date: string, time: string) {
  // a backup made in the background is only shown when the settings are opened again
  await this.page.goto('/settings');
  await expect(this.page.getByTestId('settings-view')).toBeVisible();
  await expect.poll(async () => { const iso = await status(this).getAttribute('data-last-backup'); return iso ? berlin(iso) : ''; }).toBe(`${date} ${time}`);
});

When('the server loses all data of {string}', async function (this: World, email: string) {
  await this.api.post('/api/__test/backup/wipe', { owner: email });
});

When('I restore from the backup', async function (this: World) {
  await settings(this);
  await this.page.getByTestId('settings-backup-restore').click();
});

Then('the restore asks for confirmation', async function (this: World) {
  await expect(this.page.getByTestId('confirm-dialog')).toBeVisible();
});

When('I confirm the restore', async function (this: World) {
  const restored = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/backup/restore' && r.request().method() === 'POST');
  const reloaded = this.page.waitForEvent('load');
  await this.page.getByTestId('confirm-ok').click();
  expect((await restored).status(), 'restore answered').toBe(200);
  await reloaded;
  await expect(this.page.getByTestId('settings-view')).toBeVisible();
});

Given('the Drive is unavailable', async function (this: World) {
  await this.api.post('/api/__test/backup/drive-down', { down: true });
});

Then('the backup status says it failed', async function (this: World) {
  await expect(status(this)).toHaveAttribute('data-state', 'failed');
  await expect(status(this)).toContainText('failed');
});

Then('the saved support cat setting is {string}', async function (this: World, label: keyof typeof SUPPORT_CAT) {
  // the page's own request context carries the session cookie
  await expect.poll(async () => (await (await this.page.request.get('/api/prefs')).json()).supportCat).toBe(SUPPORT_CAT[label]);
});

Given('{string} signs in without the Drive permission', async function (this: World, email: string) {
  await signIn(this, email, '2026-10-12', false);
});

Then('I am asked to allow backups to Google Drive', async function (this: World) {
  await expect(this.page.getByTestId('settings-backup-allow')).toBeVisible();
  await expect(status(this)).toHaveAttribute('data-state', 'off');
});

Then('there is no button to back up now', async function (this: World) {
  await expect(this.page.getByTestId('settings-backup-now')).toHaveCount(0);
  await expect(this.page.getByTestId('settings-backup-restore')).toHaveCount(0);
});

When('I back up now {int} times', async function (this: World, n: number) {
  await settings(this);
  for (let i = 0; i < n; i++) {
    const done = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/backup' && r.request().method() === 'POST');
    await this.page.getByTestId('settings-backup-now').click();
    await done;
  }
});

Given('{string} is signed in with the theme {string} backed up', async function (this: World, email: string, theme: string) {
  await signIn(this, email);
  await this.page.goto('/settings/theme');
  await chooseTheme(this, theme);
  const done = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/backup' && r.request().method() === 'POST');
  await settings(this);
  await this.page.getByTestId('settings-backup-now').click();
  await done;
});

/** Per scenario: the HTTP client of the other person's own session. */
const otherPerson = new WeakMap<World, APIRequestContext>();

Given('{string} adds the category {string}', async function (this: World, email: string, name: string) {
  const context = await this.browser.newContext({ baseURL: this.baseURL });
  this.track(context);
  await this.api.chooseGoogleAccount(email);
  await context.request.get('/api/auth/google/start');
  const res = await context.request.post('/api/categories', { data: { name, color: '#2e7d32' } });
  expect(res.status(), 'category added').toBe(201);
  otherPerson.set(this, context.request);
});

When('I restore from the backup and confirm', async function (this: World) {
  await settings(this);
  await this.page.getByTestId('settings-backup-restore').click();
  await expect(this.page.getByTestId('confirm-dialog')).toBeVisible();
  const restored = this.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/backup/restore' && r.request().method() === 'POST');
  const reloaded = this.page.waitForEvent('load');
  await this.page.getByTestId('confirm-ok').click();
  expect((await restored).status(), 'restore answered').toBe(200);
  await reloaded;
});

Then('the category {string} still exists', async function (this: World, name: string) {
  const { categories } = (await (await otherPerson.get(this)!.get('/api/settings')).json()) as { categories: Array<{ name: string }> };
  expect(categories.map((c) => c.name)).toContain(name);
});
