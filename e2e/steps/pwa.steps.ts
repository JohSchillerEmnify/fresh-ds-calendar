/** HTTP and PWA steps (STEPS.md "PWA and HTTP"). */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { dig } from './support/google.js';
import type { World } from './support/world.js';

interface ManifestIcon { src: string; sizes?: string; purpose?: string; type?: string }

When('I request {string}', async function (this: World, spec: string) {
  const [method, ...rest] = spec.trim().split(/\s+/);
  const path = rest.join(' ');
  if (path.startsWith('/api/__test/')) this.api.usedTestApi = true;
  // read the server state only after the app's first-open check-in has landed (it changes the motivation)
  if (path.startsWith('/api/') && this.firstCheckIn) await this.firstCheckIn;
  const res = await this.request.fetch(path, { method, failOnStatusCode: false });
  const body = await res.text();
  let json: unknown;
  try { json = JSON.parse(body); } catch { json = undefined; }
  this.lastResponse = { status: res.status(), json, url: res.url() };
});

function last(world: World) {
  if (!world.lastResponse) throw new Error('No previous "I request" step');
  return world.lastResponse;
}

Then('the response status is {int}', async function (this: World, status: number) {
  expect(last(this).status).toBe(status);
});

Then('the response JSON field {string} equals {string}', async function (this: World, path: string, value: string) {
  expect(String(dig(last(this).json, path)), `JSON field ${path}`).toBe(value);
});

function manifestIcons(world: World): ManifestIcon[] {
  const icons = (last(world).json as { icons?: ManifestIcon[] } | undefined)?.icons;
  if (!Array.isArray(icons)) throw new Error('The last response has no manifest "icons" array');
  return icons;
}

Then('the page links a web app manifest', async function (this: World) {
  await expect(this.page.locator('link[rel="manifest"]').first()).toHaveAttribute('href', /\S/);
});

Then('the manifest declares an icon of size {string}', async function (this: World, size: string) {
  const sizes = manifestIcons(this).flatMap((i) => (i.sizes ?? '').split(/\s+/));
  expect(sizes).toContain(size);
});

Then('the manifest declares a maskable icon', async function (this: World) {
  expect(manifestIcons(this).some((i) => (i.purpose ?? '').split(/\s+/).includes('maskable'))).toBe(true);
});

Then('every manifest icon can be downloaded as a PNG', async function (this: World) {
  const base = last(this).url;
  for (const icon of manifestIcons(this)) {
    const url = new URL(icon.src, base).href;
    const res = await this.request.get(url, { failOnStatusCode: false });
    expect.soft(res.status(), `${icon.src} status`).toBe(200);
    expect.soft(res.headers()['content-type'] ?? '', `${icon.src} content-type`).toContain('image/png');
    const sig = (await res.body()).subarray(0, 8).toString('hex');
    expect.soft(sig, `${icon.src} PNG signature`).toBe('89504e470d0a1a0a');
  }
});

Then('the page has a theme color', async function (this: World) {
  await expect(this.page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', /\S/);
});

Then('the page has an apple touch icon of size {string}', async function (this: World, size: string) {
  await expect(this.page.locator(`link[rel="apple-touch-icon"][sizes="${size}"]`)).toHaveCount(1);
});

Then('the page has the meta tag {string} set to {string}', async function (this: World, name: string, value: string) {
  await expect(this.page.locator(`meta[name="${name}"]`).first()).toHaveAttribute('content', value);
});

Then('a service worker is registered for scope {string}', async function (this: World, scope: string) {
  await expect
    .poll(
      () =>
        this.page.evaluate(async (s) => {
          if (!('serviceWorker' in navigator)) return 'no serviceWorker API';
          const reg = await navigator.serviceWorker.getRegistration(s);
          return reg ? reg.scope : 'not registered';
        }, scope),
      { timeout: 15_000 },
    )
    .toBe(new URL(scope, this.baseURL + '/').href);
});

Then('the service worker controls the page', async function (this: World) {
  await expect
    .poll(() => this.page.evaluate(() => !!navigator.serviceWorker?.controller), { timeout: 15_000 })
    .toBe(true);
});

When('the browser offers to install the app', async function (this: World) {
  await this.page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string; platform: string }>;
      platforms: string[];
    };
    e.platforms = ['web'];
    e.prompt = async () => {
      (window as unknown as { __installPromptShown: boolean }).__installPromptShown = true;
    };
    e.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
    window.dispatchEvent(e);
  });
});

Then('I see the install app button', async function (this: World) {
  await expect(this.page.getByTestId('install-app-button')).toBeVisible();
});

Then('I do not see the install app button', async function (this: World) {
  await expect(this.page.getByTestId('app-shell')).toBeVisible();
  await expect(this.page.getByTestId('install-app-button')).toBeHidden();
});

When('I click the install app button', async function (this: World) {
  await this.page.getByTestId('install-app-button').click();
});

Then('the browser install prompt was shown', async function (this: World) {
  await expect
    .poll(() => this.page.evaluate(() => (window as unknown as { __installPromptShown?: boolean }).__installPromptShown === true))
    .toBe(true);
});

Then('I see the iOS install hint {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('ios-install-hint')).toContainText(text);
});

Then('I do not see the iOS install hint', async function (this: World) {
  await expect(this.page.getByTestId('app-shell')).toBeVisible();
  await expect(this.page.getByTestId('ios-install-hint')).toBeHidden();
});

When('I dismiss the iOS install hint', async function (this: World) {
  await this.page.getByTestId('ios-install-hint-dismiss').click();
});

Then('the settings offer to install the app', async function (this: World) {
  await expect(this.page.getByTestId('settings-install-app')).toBeVisible();
});

Then('the settings do not offer to install the app', async function (this: World) {
  await expect(this.page.getByTestId('settings-view')).toBeVisible();
  await expect(this.page.getByTestId('settings-install-app')).toBeHidden();
});

When('I open the install instructions in the settings', async function (this: World) {
  await this.page.getByTestId('settings-install-app').click();
  await expect(this.page.getByTestId('ios-install-sheet')).toBeVisible();
});

Then('the install instructions show the steps {string}', async function (this: World, steps: string) {
  await expect(this.page.getByTestId('ios-install-step')).toHaveText(steps.split(', '));
});

When('I close the install instructions', async function (this: World) {
  await this.page.getByTestId('ios-install-close').click();
});

Then('the install instructions are closed', async function (this: World) {
  await expect(this.page.getByTestId('ios-install-sheet')).toBeHidden();
});

// --- the APK update hint (inside the Android app) ---

Given('the app runs inside the Android app with version code {int}', async function (this: World, code: number) {
  await this.context.addInitScript((versionCode) => {
    (window as unknown as { Capacitor: unknown }).Capacitor = {
      isNativePlatform: () => true,
      Plugins: { ServerChoice: { appVersion: async () => ({ versionCode }) } },
    };
  }, code);
});

Given('the server offers the app version code {int}', async function (this: World, code: number) {
  await this.api.post('/api/__test/apk', { versionCode: code, versionName: `1.1.${code}` });
});

Then('I am offered to download the new app version', async function (this: World) {
  await expect(this.page.getByTestId('apk-available')).toBeVisible();
});

Then('I am not offered to download the new app version', async function (this: World) {
  await expect(this.page.getByTestId('app-shell')).toBeVisible();
  await expect(this.page.getByTestId('apk-available')).toBeHidden();
});

let apkRequested: Promise<unknown> | null = null;

When('I choose to download the app', async function (this: World) {
  apkRequested = this.page.waitForRequest((r) => new URL(r.url()).pathname === '/app.apk');
  await this.page.getByTestId('apk-download').click();
});

Then('the app download starts', async function (this: World) {
  await apkRequested;
});
