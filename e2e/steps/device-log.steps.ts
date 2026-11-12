/** Steps of the error log on the device (feature device-log, STEPS.md "Error log on the device"). */
import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures.js';
import type { World } from './support/world.js';
import { settingControl } from './support/settings.js';

const LOG_KEY = 'calendar.deviceLog';
const page = (w: World) => w.page.getByTestId('device-log-page');
const summaries = (w: World) => w.page.getByTestId('device-log-summary');

Given("this device's error log holds:", async function (this: World, table: DataTable) {
  const entries = table.hashes().map((r) => {
    const [name, ...rest] = r.message!.split(': ');
    const message = rest.join(': ');
    return { at: new Date(r.at!.replace(' ', 'T')).toISOString(), kind: 'error', summary: r.message, app: '0.0.0', platform: 'desktop', standalone: false, native: false, data: { name, message } };
  });
  // set only once: a reload must see what the app did with the log since
  await this.context.addInitScript(([key, value]) => {
    try { if (localStorage.getItem(key) === null) localStorage.setItem(key, value); } catch { /* storage unavailable */ }
  }, [LOG_KEY, JSON.stringify(entries)] as const);
});

Given('this device cannot share files', async function (this: World) {
  await this.context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true });
  });
});

Given('this device shares only text files', async function (this: World) {
  await this.context.addInitScript(() => {
    const w = window as unknown as { sharedLogFile?: { name: string; type: string; text: Promise<string> } };
    Object.defineProperty(Navigator.prototype, 'canShare', { value: (d: { files?: File[] }) => !!d.files?.length && d.files.every((f) => f.type === 'text/plain'), configurable: true });
    Object.defineProperty(Navigator.prototype, 'share', { value: async (d: { files: File[] }) => { const f = d.files[0]!; w.sharedLogFile = { name: f.name, type: f.type, text: f.text() }; }, configurable: true });
  });
});

When('I open the error log in the settings', async function (this: World) {
  if (await page(this).isVisible()) return;
  if (!this.page.url().startsWith('http')) {
    await this.page.goto('/day/2026-10-12');
    await this.calendarShown();
  }
  // the Error log row is in Settings › Account & app (feature settings-groups)
  await (await settingControl(this, 'settings-error-log')).click();
  await expect(page(this)).toBeVisible();
});

When('an unexpected error {string} happens in the app', async function (this: World, message: string) {
  await this.page.evaluate((m) => { setTimeout(() => { throw new TypeError(m); }); }, message);
  // the log is written synchronously by the error listener
  await this.page.waitForFunction(([key, m]) => (localStorage.getItem(key) ?? '').includes(m), [LOG_KEY, message] as const);
});

Then('the error log has an entry {string}', async function (this: World, text: string) {
  await expect(summaries(this).filter({ hasText: text })).not.toHaveCount(0);
});

Then('the error log does not contain {string}', async function (this: World, text: string) {
  await expect(page(this)).not.toContainText(text);
  const stored = await this.page.evaluate((key) => localStorage.getItem(key) ?? '', LOG_KEY);
  expect(stored).not.toContain(text);
});

Then('the error log shows {string}', async function (this: World, list: string) {
  await expect(summaries(this)).toHaveText(list.split(', '));
});

When('I clear the error log', async function (this: World) {
  await this.page.getByTestId('device-log-clear').click();
});

Then('the error log is empty', async function (this: World) {
  await expect(this.page.getByTestId('device-log-entry')).toHaveCount(0);
  await expect(this.page.getByTestId('device-log-empty')).toBeVisible();
});

async function download(w: World, testid: string): Promise<void> {
  const [file] = await Promise.all([w.page.waitForEvent('download'), w.page.getByTestId(testid).click()]);
  expect(file.suggestedFilename()).toMatch(/^calendar-error-log-\d{4}-\d{2}-\d{2}\.json$/);
  (w as World & { deviceLogFile?: string }).deviceLogFile = (await file.path())!;
}
When('I download the error log', async function (this: World) { await download(this, 'device-log-download'); });
When('I share the error log', async function (this: World) { await download(this, 'device-log-share'); });

Then('the downloaded error log holds {int} entries', async function (this: World, n: number) {
  const path = (this as World & { deviceLogFile?: string }).deviceLogFile!;
  expect(JSON.parse(await readFile(path, 'utf8')).entries).toHaveLength(n);
});

When('I share the error log with the share sheet', async function (this: World) {
  await this.page.getByTestId('device-log-share').click();
  await this.page.waitForFunction(() => 'sharedLogFile' in window);
});

Then('the shared error log is a text file with {int} entries', async function (this: World, n: number) {
  const file = await this.page.evaluate(async () => {
    const f = (window as unknown as { sharedLogFile: { name: string; type: string; text: Promise<string> } }).sharedLogFile;
    return { name: f.name, type: f.type, text: await f.text };
  });
  expect([file.type, file.name]).toEqual(['text/plain', expect.stringMatching(/^calendar-error-log-\d{4}-\d{2}-\d{2}\.txt$/)]);
  expect(JSON.parse(file.text).entries).toHaveLength(n);
});

// --- sending to the server and crash records (feature device-log) -------------------------------------------------
interface Upload { sub: string; entries: Array<{ kind: string; summary: string }> }
const uploads = async (w: World): Promise<Upload[]> => (await w.api.get<{ uploads: Upload[] }>('/api/__test/diag-uploads')).uploads;

Given('the Android app recorded a crash {string} with the message {string} before this start', async function (this: World, exception: string, message: string) {
  // the plugin hands a record over once: a reload finds none; the message is there to prove the app drops it
  await this.context.addInitScript(([cls, msg]) => {
    const w = window as unknown as { Capacitor?: unknown };
    w.Capacitor = { Plugins: { CrashReports: { take: async () => {
      if (sessionStorage.getItem('crashTaken')) return { records: [] };
      sessionStorage.setItem('crashTaken', '1');
      return { records: [{ source: 'java', exception: cls, message: msg, frames: ['lan.mordor.calendar.widget.WeekFetcher.fetch(WeekFetcher.java:50)'], thread: 'main', app: '1.1.9', android: 35, time: new Date('2026-10-12T08:10:00').getTime() }] };
    } } } };
  }, [exception, message] as const);
});

When('this device is offline', async function (this: World) {
  await this.context.setOffline(true);
});

When('I send the error log to the server', async function (this: World) {
  await this.page.getByTestId('device-log-send').click();
});

Then('I am told the error log was sent', async function (this: World) {
  await expect(this.page.getByTestId('device-log-send-status')).toHaveText('Sent to the server');
});

Then('I am told the error log could not be sent', async function (this: World) {
  await expect(this.page.getByTestId('device-log-send-status')).toContainText('Could not be sent');
});

Then('the server holds {int} error log upload for me with {int} entries', async function (this: World, n: number, entries: number) {
  await expect.poll(async () => (await uploads(this)).length).toBe(n);
  expect((await uploads(this))[0]!.entries).toHaveLength(entries);
});

Then('the server holds no error log upload', async function (this: World) {
  // the app has started and the pref is read: a send would have happened by now
  await this.page.waitForLoadState('networkidle').catch(() => undefined);
  expect(await uploads(this)).toHaveLength(0);
});

Then('the stored upload does not contain {string}', async function (this: World, text: string) {
  expect(JSON.stringify(await uploads(this))).not.toContain(text);
});

Then('sending reports automatically is off', async function (this: World) {
  await expect(this.page.getByTestId('device-log-auto')).not.toBeChecked();
});

When('I switch sending reports automatically on', async function (this: World) {
  await this.page.getByTestId('device-log-auto').click();
});
