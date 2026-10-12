/**
 * Provider-side steps (STEPS.md "Google (provider) side", colors, categories): read and change the raw Google events
 * through /api/__test/remote/*. Assertions poll, because UI-triggered writes (optimistic ticks) land asynchronously.
 */
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures.js';
import type { GoogleEvent } from './support/api.js';
import { addDays, berlinIso, sameInstant } from './support/dates.js';
import {
  chunkCount, describeItems, dig, encodeItems, googleTaskListBody, isTaskList, readItems,
} from './support/google.js';
import { itemsFrom } from './support/tables.js';
import type { World } from './support/world.js';

/** Exactly one confirmed Google event with this summary (optionally only task lists). */
async function findOne(world: World, summary: string, taskList = false): Promise<GoogleEvent> {
  let found: GoogleEvent[] = [];
  await expect
    .poll(async () => {
      found = (await world.api.remoteEvents(summary)).filter((e) => e.summary === summary && (!taskList || isTaskList(e)));
      return found.length;
    }, { message: `exactly one Google ${taskList ? 'task list ' : ''}event "${summary}"` })
    .toBe(1);
  return found[0];
}

/** Poll a check over the (single) Google event until it returns 'ok'. */
async function pollEvent(world: World, summary: string, taskList: boolean, check: (ev: GoogleEvent) => string) {
  await expect
    .poll(async () => {
      const evs = (await world.api.remoteEvents(summary)).filter((e) => e.summary === summary && (!taskList || isTaskList(e)));
      if (evs.length !== 1) return `${evs.length} Google events named "${summary}"`;
      return check(evs[0]);
    })
    .toBe('ok');
}

const show = (v: unknown) => JSON.stringify(v);

// --- assertions ------------------------------------------------------------------------------------------------

Then(
  'Google contains an event {string} on {date} from {time} to {time}',
  async function (this: World, title: string, date: string, from: string, to: string) {
    await pollEvent(this, title, false, (ev) =>
      sameInstant(ev.start.dateTime, berlinIso(date, from)) && sameInstant(ev.end.dateTime, berlinIso(date, to))
        ? 'ok'
        : `start ${show(ev.start)} end ${show(ev.end)}`,
    );
  },
);

Then(
  'Google contains an all-day event {string} from {date} to {date}',
  async function (this: World, title: string, from: string, to: string) {
    const end = addDays(to, 1); // inclusive in steps, exclusive in Google
    await pollEvent(this, title, false, (ev) =>
      ev.start.date === from && ev.end.date === end ? 'ok' : `start ${show(ev.start)} end ${show(ev.end)}`,
    );
  },
);

Then('Google contains no event {string}', async function (this: World, title: string) {
  await expect
    .poll(async () => (await this.api.remoteEvents(title)).filter((e) => e.summary === title && e.status !== 'cancelled').length)
    .toBe(0);
});

Then('the Google event {string} has:', async function (this: World, title: string, table: DataTable) {
  const rows = table.raw();
  await pollEvent(this, title, false, (ev) => {
    for (const [path, want] of rows) {
      const got = dig(ev, path.trim());
      if (String(got) !== want) return `${path} = ${show(got)}, want ${show(want)}`;
    }
    return 'ok';
  });
});

Then('the Google event {string} has no color ID', async function (this: World, title: string) {
  await pollEvent(this, title, false, (ev) => (ev.colorId ? `colorId ${ev.colorId}` : 'ok'));
});

Then(
  'the Google event for the task list {string} is an all-day event on {date}',
  async function (this: World, title: string, date: string) {
    await pollEvent(this, title, true, (ev) =>
      ev.start.date === date && ev.end.date === addDays(date, 1) && !ev.start.dateTime
        ? 'ok'
        : `start ${show(ev.start)} end ${show(ev.end)}`,
    );
  },
);

Then(
  'the Google event for the task list {string} is a timed event on {date} from {time} to {time}',
  async function (this: World, title: string, date: string, from: string, to: string) {
    await pollEvent(this, title, true, (ev) =>
      sameInstant(ev.start.dateTime, berlinIso(date, from)) && sameInstant(ev.end.dateTime, berlinIso(date, to))
        ? 'ok'
        : `start ${show(ev.start)} end ${show(ev.end)}`,
    );
  },
);

Then(
  'the Google event for the task list {string} has the private extended property {string} set to {string}',
  async function (this: World, title: string, key: string, value: string) {
    await pollEvent(this, title, true, (ev) => {
      const got = ev.extendedProperties?.private?.[key];
      return got === value ? 'ok' : `private.${key} = ${show(got)}`;
    });
  },
);

Then(
  'the Google event for the task list {string} has the description:',
  async function (this: World, title: string, description: string) {
    await pollEvent(this, title, true, (ev) =>
      (ev.description ?? '') === description ? 'ok' : `description ${show(ev.description)}`,
    );
  },
);

Then(
  'the Google event for the task list {string} stores its items in more than one chunk',
  async function (this: World, title: string) {
    await pollEvent(this, title, true, (ev) => (chunkCount(ev) > 1 ? 'ok' : `${chunkCount(ev)} chunk(s)`));
  },
);

Then(
  'the Google event for the task list {string} stores the tags {string}',
  async function (this: World, title: string, tags: string) {
    await pollEvent(this, title, true, (ev) => {
      const raw = ev.extendedProperties?.private?.tags;
      const got = raw ? (JSON.parse(raw) as string[]).join(', ') : '';
      return got === tags ? 'ok' : `tags ${show(raw)}`;
    });
  },
);

Then(
  'the Google event for the task list {string} has the color ID {string}',
  async function (this: World, title: string, colorId: string) {
    await pollEvent(this, title, true, (ev) => (ev.colorId === colorId ? 'ok' : `colorId ${show(ev.colorId)}`));
  },
);

Then('the Google event for the task list {string} has no color ID', async function (this: World, title: string) {
  await pollEvent(this, title, true, (ev) => (ev.colorId ? `colorId ${ev.colorId}` : 'ok'));
});

// --- remote changes --------------------------------------------------------------------------------------------

When(
  'Google adds an event {string} on {date} from {time} to {time}',
  async function (this: World, title: string, date: string, from: string, to: string) {
    await this.api.remoteInsert({
      calendarId: 'primary',
      summary: title,
      start: { dateTime: berlinIso(date, from), timeZone: 'Europe/Berlin' },
      end: { dateTime: berlinIso(date, to), timeZone: 'Europe/Berlin' },
    });
  },
);

When('Google renames the event {string} to {string}', async function (this: World, from: string, to: string) {
  const ev = await findOne(this, from);
  await this.api.remotePatch(ev.id, { summary: to });
});

When(
  'Google moves the event {string} to {date} from {time} to {time}',
  async function (this: World, title: string, date: string, from: string, to: string) {
    const ev = await findOne(this, title);
    await this.api.remotePatch(ev.id, {
      start: { dateTime: berlinIso(date, from), timeZone: 'Europe/Berlin' },
      end: { dateTime: berlinIso(date, to), timeZone: 'Europe/Berlin' },
    });
  },
);

When('Google deletes the event {string}', async function (this: World, title: string) {
  await this.api.remoteDelete((await findOne(this, title)).id);
});

When('Google sets the color ID of the event {string} to {string}', async function (this: World, title: string, colorId: string) {
  await this.api.remotePatch((await findOne(this, title)).id, { colorId });
});

When(
  'Google adds a task list {string} on {date} with items:',
  async function (this: World, title: string, date: string, table: DataTable) {
    await this.api.remoteInsert(googleTaskListBody(title, date, itemsFrom(table)));
  },
);

When(
  'Google ticks the item {string} in the task list {string}',
  async function (this: World, item: string, list: string) {
    const ev = await findOne(this, list, true);
    const items = readItems(ev);
    const target = items.find((i) => i.t === item);
    if (!target) throw new Error(`Task list "${list}" has no item "${item}" in Google`);
    target.d = 1;
    const priv = ev.extendedProperties?.private ?? {};
    await this.api.remotePatch(ev.id, {
      description: describeItems(items),
      extendedProperties: { private: encodeItems(items, priv) },
    });
  },
);

When('Google renames the task list {string} to {string}', async function (this: World, from: string, to: string) {
  await this.api.remotePatch((await findOne(this, from, true)).id, { summary: to });
});

Given('Google becomes unavailable', async function (this: World) {
  await this.api.setOutage(true);
});

When('Google becomes available again', async function (this: World) {
  await this.api.setOutage(false);
});
