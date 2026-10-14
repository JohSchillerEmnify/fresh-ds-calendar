/**
 * Sign-in steps (STEPS.md "Signing in"). Google is the mock provider with one calendar per person; "signs in with
 * Google" runs the real OAuth round trip (start -> consent -> callback) against the TEST_MODE test double.
 */
import { expect } from '@playwright/test';
import { Given, Then, When } from './fixtures.js';
import { addDays, berlinIso } from './support/dates.js';
import { tid, type World } from './support/world.js';

/** Open the week, get sent to the sign-in page, and press "Sign in with Google" as this person. */
export async function signIn(world: World, email: string, date = '2026-10-12', driveScope = true) {
  world.person = email;
  await world.api.chooseGoogleAccount(email, driveScope);
  await world.page.goto(`/week/${date}`);
  await world.page.getByTestId('signin-google').click();
  // leaves /signin through the round trip and lands on the calendar (or back on /signin?error=private)
  await world.page.waitForURL((u) => u.pathname !== '/signin' || u.searchParams.has('error'));
  if (!world.page.url().includes('error=')) await world.calendarShown();
}

const onSignIn = (world: World) => expect(world.page.getByTestId('signin-page')).toBeVisible();

Given('{string} and {string} may use the calendar', async function (this: World, a: string, b: string) {
  await this.api.setAuth([a, b]);
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
