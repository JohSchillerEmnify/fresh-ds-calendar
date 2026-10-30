/**
 * Sign-in steps (STEPS.md "Signing in"). Google is the mock provider with one calendar per person; "signs in with
 * Google" runs the real OAuth round trip (start -> consent -> callback) against the TEST_MODE test double.
 */
import { createHash, randomBytes } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { Given, Step, Then, When } from './fixtures.js';
import { addDays, berlinIso } from './support/dates.js';
import { tid, type World } from './support/world.js';

/** Open the week, get sent to the sign-in page, and press "Sign in with Google" as this person. */
export async function signIn(world: World, email: string, date = '2026-10-12', driveScope = true) {
  world.person = email;
  await world.api.chooseGoogleAccount(email, driveScope);
  // signed out, the app may leave the deep link for /signin with a full page load before it has loaded: that is the
  // way there, not a failure. Playwright reports it as "interrupted by another navigation to .../signin", or (seen on
  // mobile, when the jump cancels the deep link's own load) as net::ERR_ABORTED for that URL; either way the page must
  // then really be on /signin
  await world.page.goto(`/week/${date}`).catch(async (e: Error) => {
    if (!/interrupted by another navigation to "[^"]*\/signin"|net::ERR_ABORTED at \S*\/week\//.test(e.message)) throw e;
    await world.page.waitForURL((u) => u.pathname === '/signin', { timeout: 5000 });
  });
  await world.page.getByTestId('signin-google').click();
  // leaves /signin through the round trip and lands on the calendar (or back on /signin?error=private)
  await world.page.waitForURL((u) => u.pathname !== '/signin' || u.searchParams.has('error'));
  if (!world.page.url().includes('error=')) await world.calendarShown();
}

const onSignIn = (world: World) => expect(world.page.getByTestId('signin-page')).toBeVisible();

/** The allow-list the scenario has set, so "may no longer use the calendar" can take one address off it. */
const allowed = new WeakMap<World, string[]>();
const allow = async (w: World, emails: string[]) => { allowed.set(w, emails); await w.api.setAuth(emails); };

Given('{string} and {string} may use the calendar', async function (this: World, a: string, b: string) { await allow(this, [a, b]); });
Step('{string} may no longer use the calendar', async function (this: World, a: string) {
  await allow(this, (allowed.get(this) ?? []).filter((e) => e !== a));
});

Given(
  '{string} has an event {string} on {date} from {time} to {time}',
  async function (this: World, owner: string, title: string, date: string, from: string, to: string) {
    await this.api.remoteInsert({ owner, summary: title, start: { dateTime: berlinIso(date, from) }, end: { dateTime: berlinIso(date, to) } });
  },
);

When('{string} signs in with Google', async function (this: World, email: string) {
  await signIn(this, email);
});

Given('{string} is signed in', async function (this: World, email: string) {
  await signIn(this, email);
});

Given('Google no longer accepts the access of {string}', async function (this: World, email: string) {
  await this.api.revokeGoogleAccess(email);
});

When('their session expires', async function (this: World) {
  await this.page.context().clearCookies();
});

When('someone opens the week view for {date} without signing in', async function (this: World, date: string) {
  this.weekOpened = date;
  await this.page.goto(`/week/${date}`);
});

When('they sign out in the settings', async function (this: World) {
  await this.page.getByTestId('settings-button').click();
  await this.page.getByTestId('settings-signout').click();
});

When('they sign in with Google again', async function (this: World) {
  // no page is opened first: the page the person was sent away from stays the place to return to
  await onSignIn(this);
  await this.page.getByTestId('signin-google').click();
  await this.page.waitForURL((u) => u.pathname !== '/signin');
  await this.calendarShown();
});

/** Per scenario: the HTTP client of the second device ("is also signed in on another device"). */
const otherDevice = new WeakMap<World, APIRequestContext>();

Given('{string} is also signed in on another device', async function (this: World, email: string) {
  const context = await this.browser.newContext({ baseURL: this.baseURL });
  this.track(context);
  await this.api.chooseGoogleAccount(email);
  // start -> fake consent -> callback: the client follows the redirects and keeps the session cookie
  await context.request.get('/api/auth/google/start');
  expect((await context.request.get('/api/auth/me', { failOnStatusCode: false })).status()).toBe(200);
  otherDevice.set(this, context.request);
});

When('they sign out everywhere in the settings', async function (this: World) {
  await this.page.getByTestId('settings-button').click();
  await this.page.getByTestId('settings-signout-all').click();
});

Then('the other device is signed out too', async function (this: World) {
  const res = await otherDevice.get(this)!.get('/api/auth/me', { failOnStatusCode: false });
  expect(res.status()).toBe(401);
});

When('they open the week view for {date}', async function (this: World, date: string) {
  await this.page.goto(`/week/${date}`);
});

Then('they see the week view for {date}', async function (this: World, date: string) {
  const start = await this.weekStart();
  expect(date >= start && date <= addDays(start, 6), `week starting ${start} contains ${date}`).toBe(true);
});

Then('they see the event {string} on {date}', async function (this: World, title: string, date: string) {
  await expect(this.eventChip(title, date)).toBeVisible();
});

Then('they do not see the event {string}', async function (this: World, title: string) {
  await this.settled();
  await expect(this.eventChips(title).locator('visible=true')).toHaveCount(0);
});

Then('they are told the calendar is private', async function (this: World) {
  await expect(this.page.getByTestId('signin-private')).toBeVisible();
});

Then('they see no events', async function (this: World) {
  // nothing of the calendar is on screen: the sign-in page stands in its place
  await onSignIn(this);
  await expect(this.page.locator(`${tid('event-chip')}, ${tid('event-bar')}`)).toHaveCount(0);
});

Then('they see the sign-in page', async function (this: World) {
  await onSignIn(this);
});

Then('opening the week view for {date} shows the sign-in page', async function (this: World, date: string) {
  await this.page.goto(`/week/${date}`);
  await onSignIn(this);
});

Then('the calendar data cannot be read without signing in', async function (this: World) {
  const from = this.weekOpened ?? '2026-10-12';
  // `request` is the test's own HTTP client: it carries no session cookie
  const res = await this.request.get(`/api/items?from=${from}&to=${addDays(from, 7)}`, { failOnStatusCode: false });
  expect(res.status()).toBe(401);
  expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
});

Then('they are asked to sign in with Google again', async function (this: World) {
  const banner = this.page.getByTestId('reauth-banner');
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('button')).toBeVisible();
});

Given("Google's consent screen is answered without calendar access", async function (this: World) {
  await this.api.setCalendarGranted(false);
});

Then('they are told Google Calendar access is missing', async function (this: World) {
  const banner = this.page.getByTestId('calendar-access-banner');
  await expect(banner).toBeVisible();
  await expect(banner.getByTestId('calendar-access-grant')).toBeVisible();
});

Then('the settings offer to grant calendar access', async function (this: World) {
  await this.page.getByTestId('settings-button').click();
  await expect(this.page.getByTestId('settings-calendar-access')).toBeVisible();
  await this.page.goBack();
});

When('they grant calendar access', async function (this: World) {
  await this.api.setCalendarGranted(true);
  await this.page.getByTestId('calendar-access-grant').click();
  await this.page.waitForURL((u) => u.pathname !== '/signin' && !u.pathname.startsWith('/api/'));
  await this.calendarShown();
});

Then('they are no longer told Google Calendar access is missing', async function (this: World) {
  await expect(this.page.getByTestId('calendar-access-banner')).toHaveCount(0);
});

/** The OAuth round trip as the system browser runs it for the app (`app=1`): the test's own HTTP client with its own cookie jar. */
async function appSignIn(world: World, email: string) {
  await world.api.chooseGoogleAccount(email);
  const step = async (url: string) => {
    const res = await world.request.get(url, { maxRedirects: 0, failOnStatusCode: false });
    expect(res.status()).toBe(302);
    return res.headers()['location']!;
  };
  world.appVerifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(world.appVerifier).digest('base64url');
  const consent = await step(`/api/auth/google/start?app=1&challenge=${challenge}`);
  const callback = await step(consent);
  // the callback answers 302 to a Chrome intent URL for the app; its code is what the deep link carries
  const intent = await step(callback);
  world.appCode = /^intent:\/\/auth\?code=([A-Za-z0-9_-]+)#Intent;/.exec(intent)?.[1];
  world.appLink = world.appCode ? `lan.mordor.calendar://auth?code=${world.appCode}` : undefined;
}

/** What the deep link does: the app's WebView loads the exchange URL. */
async function appExchange(world: World, verifier = world.appVerifier) {
  const res = await world.page.goto(`/api/auth/app-exchange?code=${world.appCode}${verifier ? `&verifier=${verifier}` : ''}`);
  world.appExchange = { status: res!.status(), text: await world.page.content() };
}

When('{string} signs in with Google from the app', async function (this: World, email: string) {
  this.person = email;
  await appSignIn(this, email);
});

Given('{string} signed in with Google from the app', async function (this: World, email: string) {
  this.person = email;
  await appSignIn(this, email);
});

Then('the system browser is not signed in', async function (this: World) {
  const cookies = (await this.request.storageState()).cookies;
  expect(cookies.map((c) => c.name)).not.toContain('cal_session');
});

Then('the app is handed a one-time code', async function (this: World) {
  expect(this.appLink).toMatch(/^lan\.mordor\.calendar:\/\/auth\?code=[A-Za-z0-9_-]{22,}$/);
});

When('the app exchanges the code', async function (this: World) {
  await appExchange(this);
});

When('another app exchanges the code', async function (this: World) {
  await appExchange(this, '');
});

When('the app exchanges the code again', async function (this: World) {
  await appExchange(this);
});

Then('the app is asked to sign in again', async function (this: World) {
  expect(this.appExchange?.status).toBe(400);
  expect(this.appExchange?.text).toContain('href="/signin"');
});
