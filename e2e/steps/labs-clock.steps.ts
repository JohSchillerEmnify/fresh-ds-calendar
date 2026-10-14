/** Labs steps used by labs-clock.feature (STEPS.md "Labs"): the Labs switch and the 24-hour clock view. */
import { expect } from '@playwright/test';
import { Then, When } from './fixtures.js';
import { exactText, tid, type World } from './support/world.js';
import { setLabsSwitch, turnOnLabsSwitch } from './support/ui.js';

When('I turn on experimental views in the settings', async function (this: World) {
  await turnOnLabsSwitch(this.page, 'settings-labs');
});

Then('the view switcher offers the experimental views {string}', async function (this: World, labels: string) {
  for (const label of labels.split(', ')) {
    const entry = this.page.getByTestId(`view-switch-${label.toLowerCase()}`);
    await expect(entry).toBeVisible();
    await expect(entry).toContainText(label);
    await expect(entry).toHaveAttribute('data-experimental', 'true');
  }
});

Then('the view switcher does not offer {string}', async function (this: World, label: string) {
  await expect(this.page.getByTestId(`view-switch-${label.toLowerCase()}`)).toHaveCount(0);
});

When('I switch the Labs view {string} on in the settings', async function (this: World, label: string) {
  await setLabsSwitch(this.page, `settings-labs-view-${label.toLowerCase()}`, true);
});

When('I switch the Labs view {string} off in the settings', async function (this: World, label: string) {
  await setLabsSwitch(this.page, `settings-labs-view-${label.toLowerCase()}`, false);
});

When('I open the clock view for {date}', async function (this: World, date: string) {
  await this.page.goto(`/clock/${date}`);
  await expect(this.page.getByTestId('clock-view')).toBeVisible();
});

/** Expects exactly one clock arc of that kind and title, spanning `start` to `end` (HH:MM). */
async function expectArc(world: World, kind: 'event' | 'tasklist', title: string, start: string, end: string) {
  const arc = world.page.locator(tid('clock-arc') + `[data-kind="${kind}"][data-title="${title}"]`);
  await expect(arc).toHaveCount(1);
  await expect(arc).toHaveAttribute('data-start', start);
  await expect(arc).toHaveAttribute('data-end', end);
}

Then(
  'the event {string} is an arc from {time} to {time}',
  async function (this: World, title: string, start: string, end: string) {
    await expectArc(this, 'event', title, start, end);
  },
);

Then(
  'the task list {string} is an arc from {time} to {time}',
  async function (this: World, title: string, start: string, end: string) {
    await expectArc(this, 'tasklist', title, start, end);
  },
);

Then('the clock lists {string} without a time', async function (this: World, text: string) {
  const entry = this.page.locator(tid('clock-untimed')).filter({ hasText: exactText(text) });
  await expect(entry).toHaveCount(1);
  await expect(entry).toBeVisible();
});

Then('the clock fills the available space', async function (this: World) {
  const view = this.page.getByTestId('clock-view'), dial = this.page.getByTestId('clock-dial');
  await expect.poll(async () => {
    const [v, d] = [await view.boundingBox(), await dial.boundingBox()];
    if (!v || !d) return 'not laid out';
    const fits = d.x >= v.x - 1 && d.y >= v.y - 1 && d.x + d.width <= v.x + v.width + 1 && d.y + d.height <= v.y + v.height + 1;
    const share = d.width / Math.min(v.width, v.height);
    return fits && share >= 0.9 ? 'fills' : `diameter ${Math.round(d.width)} of ${Math.round(Math.min(v.width, v.height))} (inside: ${fits})`;
  }).toBe('fills');
});

Then('the clock hand points at {time}', async function (this: World, time: string) {
  await expect(this.page.getByTestId('clock-hand')).toHaveAttribute('data-time', time);
});

Then('the arc of {string} is labelled {string}', async function (this: World, title: string, label: string) {
  const text = this.page.locator(tid('clock-label') + `[data-title="${title}"]`);
  await expect(text).toHaveCount(1);
  await expect(text).toBeVisible();
  await expect(text).toHaveText(label);
});

// ---- clock gestures (labs-clock.feature "Using the clock") ----

interface Pt { x: number; y: number }
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const useTouch = (w: World) => !!w.testInfo.project.use.hasTouch;

/** Screen point of minute `m` on the dial at viewBox radius `r` (midnight at the top, clockwise). */
async function dialPoint(w: World, m: number, r: number): Promise<Pt> {
  return w.page.getByTestId('clock-dial').evaluate((dial, [min, rad]) => {
    const svg = (dial as SVGElement).ownerSVGElement!;
    const a = (min / 1440) * 2 * Math.PI;
    const p = new DOMPoint(220 + rad * Math.sin(a), 220 - rad * Math.cos(a)).matrixTransform(svg.getScreenCTM()!);
    return { x: p.x, y: p.y };
  }, [m, r] as const);
}

async function arcOf(w: World, title: string) {
  const arc = w.page.locator(tid('clock-arc') + `[data-title="${title}"]`);
  await expect(arc).toHaveCount(1);
  const [start, end, r] = await Promise.all(['data-start', 'data-end', 'data-r'].map((a) => arc.getAttribute(a)));
  return { start: minutesOf(start!), end: minutesOf(end!) || 1440, r: Number(r) };
}

/** Points along the dial from minute `a` to `b` (the short way), every 5 minutes, so the app sees a turn, not a jump. */
async function pathRound(w: World, a: number, b: number, r: number): Promise<Pt[]> {
  let d = (b - a) % 1440;
  if (d > 720) d -= 1440;
  if (d <= -720) d += 1440;
  const n = Math.max(2, Math.ceil(Math.abs(d) / 5));
  const pts: Pt[] = [];
  for (let i = 1; i <= n; i++) pts.push(await dialPoint(w, a + (d * i) / n, r));
  return pts;
}

/** Presses at `from`, holds for the long press, moves through `path` and releases (touch on phones, mouse elsewhere). */
async function pressHoldMove(w: World, from: Pt, path: Pt[]) {
  const page = w.page;
  if (useTouch(w)) {
    const cdp = await page.context().newCDPSession(page);
    const tp = (p: Pt) => [{ x: Math.round(p.x), y: Math.round(p.y), id: 1 }];
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(from) });
      await page.waitForTimeout(500);
      for (const p of path) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await cdp.detach(); }
    return;
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(500);
  for (const p of path) await page.mouse.move(p.x, p.y);
  await page.mouse.up();
}

async function tapAt(w: World, p: Pt) {
  if (useTouch(w)) await w.page.touchscreen.tap(p.x, p.y);
  else await w.page.mouse.click(p.x, p.y);
}

When('I tap the arc of {string}', async function (this: World, title: string) {
  const a = await arcOf(this, title);
  await tapAt(this, await dialPoint(this, (a.start + a.end) / 2, a.r));
});

/** Grabs the arc 5 minutes after its start and turns it so that it starts at `time`. */
When('I turn the arc of {string} to {time}', async function (this: World, title: string, time: string) {
  const a = await arcOf(this, title);
  const grab = a.start + Math.min(5, (a.end - a.start) / 2);
  const to = minutesOf(time) + (grab - a.start);
  await pressHoldMove(this, await dialPoint(this, grab, a.r), await pathRound(this, grab, to, a.r));
});

When('I select the arc of {string}', async function (this: World, title: string) {
  const a = await arcOf(this, title);
  await pressHoldMove(this, await dialPoint(this, (a.start + a.end) / 2, a.r), []);
  await expect(this.page.locator(tid('clock-arc') + `[data-title="${title}"]`)).toHaveAttribute('data-selected', 'true');
});

async function dragHandle(w: World, edge: 'start' | 'end', title: string, time: string) {
  const a = await arcOf(w, title);
  const handle = w.page.locator(tid('clock-handle') + `[data-edge="${edge}"][data-title="${title}"]`);
  await expect(handle).toBeVisible();
  const from = edge === 'start' ? a.start : a.end;
  const path = await pathRound(w, from, minutesOf(time), a.r);
  const p0 = await dialPoint(w, from, a.r);
  if (useTouch(w)) {
    const cdp = await w.page.context().newCDPSession(w.page);
    const tp = (p: Pt) => [{ x: Math.round(p.x), y: Math.round(p.y), id: 1 }];
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(p0) });
      for (const p of path) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await cdp.detach(); }
    return;
  }
  await w.page.mouse.move(p0.x, p0.y);
  await w.page.mouse.down();
  for (const p of path) await w.page.mouse.move(p.x, p.y);
  await w.page.mouse.up();
}

When('I drag the start handle of {string} to {time}', async function (this: World, title: string, time: string) {
  await dragHandle(this, 'start', title, time);
});

When('I drag the end handle of {string} to {time}', async function (this: World, title: string, time: string) {
  await dragHandle(this, 'end', title, time);
});

/** Taps the empty dial plate at `time`, halfway between the hub and the hour ticks. */
When('I tap the clock at {time}', async function (this: World, time: string) {
  await tapAt(this, await dialPoint(this, minutesOf(time), 120));
});

Then('the middle of the clock says {string}', async function (this: World, text: string) {
  await expect(this.page.getByTestId('clock-now-line')).toHaveText(text);
});

Then('the clock shades the time until {time}', async function (this: World, time: string) {
  await expect(this.page.getByTestId('clock-wedge')).toHaveAttribute('data-to', time);
});

Then('the clock shows the all-day event {string}', async function (this: World, title: string) {
  await expect(this.page.locator(tid('clock-allday') + `[data-title="${title}"]`)).toBeVisible();
});
