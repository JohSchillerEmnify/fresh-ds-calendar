/** Labs Now / Next deck steps (STEPS.md "Labs (`@labs`)": Now view). */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { exactText, type World } from './support/world.js';

const nowCard = (w: World) => w.page.getByTestId('nownext-now');
const nextCard = (w: World) => w.page.getByTestId('nownext-next');

When('I open the Now view', async function (this: World) {
  await this.page.goto('/now');
  await expect(this.page.getByTestId('nownext-view')).toHaveAttribute('data-loaded', 'true');
});

Then('the Now card shows {string} with {string}', async function (this: World, title: string, left: string) {
  await expect(nowCard(this)).toHaveAttribute('data-kind', 'running');
  await expect(nowCard(this)).toHaveAttribute('data-title', title);
  await expect(this.page.getByTestId('nownext-now-left')).toHaveText(exactText(left));
});

Then('the time bar of the Now card is {int} % full', async function (this: World, percent: number) {
  const bar = this.page.getByTestId('nownext-bar');
  await expect.poll(async () => Math.abs(Number(await bar.getAttribute('aria-valuenow')) - percent)).toBeLessThanOrEqual(1);
});

When('I tap the Now card', async function (this: World) {
  await nowCard(this).click();
});

Then('the Next card shows {string} in {string} at {time}', async function (this: World, title: string, inText: string, time: string) {
  await expect(nextCard(this)).toHaveAttribute('data-title', title);
  await expect(this.page.getByTestId('nownext-next-in')).toHaveText(exactText(`in ${inText}`));
  await expect(this.page.getByTestId('nownext-next-time')).toHaveText(exactText(time));
});

Then('the Now card shows the task list {string} with its next task {string}', async function (this: World, title: string, task: string) {
  await expect(nowCard(this)).toHaveAttribute('data-kind', 'tasks');
  await expect(nowCard(this)).toHaveAttribute('data-title', title);
  await expect(this.page.getByTestId('nownext-task')).toHaveAttribute('data-task', task);
});

Then('the Now card says {string}', async function (this: World, text: string) {
  await expect(nowCard(this).getByTestId('nownext-now-line')).toHaveText(exactText(text));
});

Then('the Later card says {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('nownext-later-more')).toHaveText(exactText(text));
});

When('I unfold the Later card', async function (this: World) {
  const toggle = this.page.getByTestId('nownext-later-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});

Then('the Later card lists {string}', async function (this: World, list: string) {
  const rows = this.page.getByTestId('nownext-later-item');
  await expect(rows.first()).toBeVisible();
  const got = await rows.evaluateAll((els) => els.map((e) => `${e.getAttribute('data-time')} ${e.getAttribute('data-title')}`));
  expect(got.join(', ')).toBe(list);
});

Then('the Now card says that {string} is also running', async function (this: World, titles: string) {
  await expect(nowCard(this).getByTestId('nownext-also')).toHaveAttribute('data-titles', titles);
});

Then('the top bar has no date navigation', async function (this: World) {
  const bar = this.page.getByTestId('top-bar');
  await expect(bar.getByTestId('period-title')).toBeVisible();
  for (const id of ['nav-prev', 'nav-next', 'nav-today']) await expect(bar.getByTestId(id)).toHaveCount(0);
});
