/** Security and privacy steps (STEPS.md "Security, secrets at rest and privacy"): plain HTTP checks of headers, guards and the privacy page. */
import { createHash } from 'node:crypto';
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import type { World } from './support/world.js';

/** The last response kept by an `I request` or `I send` step. */
function last(w: World) {
  if (!w.lastResponse) throw new Error('No previous request step');
  return w.lastResponse;
}

/** Sends a request and keeps its answer as the last response, like `I request {string}`. */
async function send(w: World, spec: string, opts: { headers?: Record<string, string>; data?: string }) {
  const [method, ...rest] = spec.trim().split(/\s+/);
  if (w.firstCheckIn) await w.firstCheckIn;
  const res = await w.request.fetch(rest.join(' '), { method, failOnStatusCode: false, ...opts });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = undefined; }
  w.lastResponse = { status: res.status(), json, url: res.url(), headers: res.headers(), text };
}

const header = (w: World, name: string) => last(w).headers?.[name.toLowerCase()];

// ---- requests ----
When('I send {string} with the header {string} set to {string}', async function (this: World, spec: string, name: string, value: string) {
  await send(this, spec, { headers: { [name]: value } });
});
When('I send {string} with the body {string} as {string}', async function (this: World, spec: string, body: string, type: string) {
  await send(this, spec, { headers: { 'content-type': type }, data: body });
});
When('I send {string} with a body of {int} kilobytes', async function (this: World, spec: string, kb: number) {
  await send(this, spec, { headers: { 'content-type': 'application/json' }, data: JSON.stringify({ pad: 'x'.repeat(kb * 1024) }) });
});
When('I request {string} with the cookie {string}', async function (this: World, spec: string, cookie: string) {
  await send(this, spec, { headers: { cookie } });
});

// ---- answers ----
Then('the response status is not {int}', async function (this: World, status: number) {
  expect(last(this).status).not.toBe(status);
});
Then('the response header {string} is {string}', async function (this: World, name: string, value: string) {
  expect(header(this, name), `header ${name}`).toBe(value);
});
Then('the response header {string} contains {string}', async function (this: World, name: string, part: string) {
  expect(header(this, name) ?? '', `header ${name}`).toContain(part);
});
Then('the response text contains {string}', async function (this: World, text: string) {
  expect(last(this).text ?? '').toContain(text);
});
Then('the Content-Security-Policy allows the inline script of the page by its fingerprint', async function (this: World) {
  const csp = header(this, 'content-security-policy') ?? '';
  const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src')) ?? '';
  const inline = [...(last(this).text ?? '').matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  expect(inline.length, 'inline scripts in the page').toBeGreaterThan(0);
  for (const m of inline) expect(scriptSrc).toContain(`'sha256-${createHash('sha256').update(m[1]!).digest('base64')}'`);
});

// ---- the privacy page ----
const privacyText = (w: World) => (last(w).text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
Then('the page is the privacy policy', async function (this: World) {
  await expect(this.page.locator('h1')).toHaveText('Privacy policy');
  for (const id of ['week-view', 'month-view', 'signin-google']) await expect(this.page.getByTestId(id)).toHaveCount(0);
});
Then('the calendar is not shown', async function (this: World) {
  await expect(this.page.locator('#app')).toHaveCount(0);
});
Then('the privacy policy names {string} and says what it sees: {string}', async function (this: World, party: string, sees: string) {
  const text = privacyText(this);
  expect(text).toContain(party);
  for (const w of sees.split(',').map((x) => x.trim())) expect(text).toContain(w);
});
Then('the privacy policy names the map picture service and says what it sees: {string}', async function (this: World, sees: string) {
  const text = privacyText(this);
  expect(text).toContain('map pictures');
  expect(text).toContain(sees);
});
Then('the privacy policy names the place search and says what it sees: {string}', async function (this: World, sees: string) {
  const text = privacyText(this);
  expect(text).toContain('place suggestions');
  for (const w of sees.split(',').map((x) => x.trim())) expect(text).toContain(w);
});
Then('the privacy policy says the device, not the server, asks it', async function (this: World) {
  expect(privacyText(this)).toContain('your device (not our server)');
});
Then('the privacy policy says there is no advertising, tracking or analytics', async function (this: World) {
  expect(privacyText(this)).toContain('No advertising, no tracking, no analytics');
});
Then('the privacy policy says the only outside parties are Google and the two map services', async function (this: World) {
  expect(privacyText(this)).toContain('Apart from Google, the only third parties are the two map services');
});
