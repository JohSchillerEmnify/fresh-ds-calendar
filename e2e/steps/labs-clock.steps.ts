/** Labs steps used by labs-clock.feature (STEPS.md "Labs"): the Labs switch and the 24-hour clock view. */
import { expect } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures.js';
import { createEvent } from './setup.steps.js';
import { berlinIso } from './support/dates.js';
import { exactText, tid, type World } from './support/world.js';
import { setLabsSwitch, turnOnLabsSwitch } from './support/ui.js';

/** A Labs view label as its registry id: lower case, words joined by "-" ("Clock: rings" → "clock-rings"). */
const labId = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

When('I turn on experimental views in the settings', async function (this: World) {
  await turnOnLabsSwitch(this.page, 'settings-labs');
});

Then('the view switcher offers the experimental views {string}', async function (this: World, labels: string) {
  for (const label of labels.split(', ')) {
    const entry = this.page.getByTestId(`view-switch-${labId(label)}`);
    await expect(entry).toBeVisible();
    await expect(entry).toContainText(label);
    await expect(entry).toHaveAttribute('data-experimental', 'true');
  }
});

Then('the view switcher does not offer {string}', async function (this: World, label: string) {
  await expect(this.page.getByTestId(`view-switch-${labId(label)}`)).toHaveCount(0);
});

When('I switch the Labs view {string} on in the settings', async function (this: World, label: string) {
  await setLabsSwitch(this.page, `settings-labs-view-${labId(label)}`, true);
});

When('I switch the Labs view {string} off in the settings', async function (this: World, label: string) {
  await setLabsSwitch(this.page, `settings-labs-view-${labId(label)}`, false);
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

/** What an arc covers on the dial: its ring (radius and band width) and its drawn span in minutes. */
interface Drawn { title: string; r: number; w: number; d0: number; d1: number }

/**
 * The drawn extent of every clock arc, measured from the rendered path (STEPS.md "Clock rings"): its radius from
 * points sampled along it, its span from the minutes of those points (unwrapped), its band from the rendered stroke width.
 */
async function drawnArcs(w: World): Promise<Drawn[]> {
  const arcs = w.page.locator(tid('clock-arc'));
  await expect(arcs.first()).toBeVisible();
  return arcs.evaluateAll((els) => els.map((el) => {
    const path = el as SVGPathElement, len = path.getTotalLength(), n = 32;
    const pts = Array.from({ length: n + 1 }, (_, i) => path.getPointAtLength((len * i) / n));
    const minute = (p: DOMPoint) => ((((Math.atan2(p.x - 220, 220 - p.y) * 180) / Math.PI + 360) % 360) / 360) * 1440;
    let d0 = minute(pts[0]), prev = d0, d1 = d0;
    for (const p of pts.slice(1)) {
      let m = minute(p);
      while (m < prev - 720) m += 1440;
      prev = m;
      d1 = m;
    }
    const r = pts.reduce((sum, p) => sum + Math.hypot(p.x - 220, p.y - 220), 0) / pts.length;
    if (d1 < d0) [d0, d1] = [d1, d0];
    return { title: el.getAttribute('data-title')!, r, w: parseFloat(getComputedStyle(el).strokeWidth), d0, d1 };
  }));
}

/** Two arcs cover each other when their bands overlap radially and their drawn spans overlap in time. */
const covers = (a: Drawn, b: Drawn) => Math.abs(a.r - b.r) < (a.w + b.w) / 2 && a.d0 < b.d1 && b.d0 < a.d1;

async function drawnOf(w: World, title: string): Promise<Drawn> {
  const found = (await drawnArcs(w)).filter((a) => a.title === title);
  expect(found, `one arc "${title}"`).toHaveLength(1);
  return found[0];
}

Then(
  'the arc of {string} is not covered by the arc of {string}',
  async function (this: World, title: string, other: string) {
    const [a, b] = [await drawnOf(this, title), await drawnOf(this, other)];
    expect(covers(a, b), `${title} ${JSON.stringify(a)} vs ${other} ${JSON.stringify(b)}`).toBe(false);
  },
);

Then('the arcs of {string} are on different rings', async function (this: World, titles: string) {
  const arcs = await Promise.all(titles.split(', ').map((t) => drawnOf(this, t)));
  expect(new Set(arcs.map((a) => Math.round(a.r))).size, JSON.stringify(arcs)).toBe(arcs.length);
});

Then(
  'the arcs of {string} and {string} are on the same ring with a gap between them',
  async function (this: World, first: string, second: string) {
    const [a, b] = [await drawnOf(this, first), await drawnOf(this, second)];
    expect(b.r, 'same ring').toBeCloseTo(a.r, 0);
    expect(a.d1, `a gap between ${JSON.stringify(a)} and ${JSON.stringify(b)}`).toBeLessThan(b.d0);
  },
);

Then('no two arcs on the clock cover each other', async function (this: World) {
  const arcs = await drawnArcs(this);
  for (const a of arcs) for (const b of arcs) {
    if (a !== b) expect(covers(a, b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`).toBe(false);
  }
});

Given('the calendar contains these events on {date}:', async function (this: World, date: string, table: DataTable) {
  for (const row of table.hashes()) {
    await createEvent(this, { title: row.title, allDay: false, start: berlinIso(date, row.from), end: berlinIso(date, row.to) });
  }
});

Then('every arc on the clock is named on the dial or next to it', async function (this: World) {
  const arcs = await drawnArcs(this);
  for (const a of arcs) {
    const named = this.page.locator(`${tid('clock-label')}[data-title="${a.title}"], ${tid('clock-overflow')}[data-title="${a.title}"]`);
    await expect(named.locator('visible=true'), `a name for "${a.title}"`).toHaveCount(1);
    const chip = this.page.locator(`${tid('clock-overflow')}[data-title="${a.title}"]`);
    if (await chip.count()) await expect(chip).toHaveText(new RegExp(`^\\d\\d:\\d\\d ${a.title.slice(0, 6)}`));
  }
  // most names are on the dial: the list next to it is only for those that find no room
  const onDial = await this.page.locator(tid('clock-label')).locator('visible=true').count();
  expect(onDial, `${onDial} of ${arcs.length} names on the dial`).toBeGreaterThanOrEqual(Math.ceil(arcs.length / 2));
});

/** Names overlap when any two of their characters' boxes do (per character, so names curved along rings count right). */
Then('no two names on the clock overlap', async function (this: World) {
  const names = await this.page.locator(`${tid('clock-label')}, ${tid('clock-now-line')}, ${tid('clock-now-when')}, ${tid('clock-time')}`).evaluateAll((els) => els.map((el) => {
    const t = el as SVGTextContentElement, m = t.getScreenCTM()!;
    const chars = Array.from({ length: t.getNumberOfChars() }, (_, i) => {
      const e = t.getExtentOfChar(i);
      const pts = [[e.x, e.y], [e.x + e.width, e.y], [e.x, e.y + e.height], [e.x + e.width, e.y + e.height]]
        .map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
      return { x0: Math.min(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), x1: Math.max(...pts.map((p) => p.x)), y1: Math.max(...pts.map((p) => p.y)) };
    }).filter((c) => c.x1 - c.x0 > 0.5);
    return { name: t.textContent, chars };
  }));
  expect(names.length).toBeGreaterThan(0);
  const hit = (a: { x0: number; y0: number; x1: number; y1: number }, b: typeof a) => a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 1 && b.y0 < a.y1 - 1;
  for (const a of names) for (const b of names) {
    if (a === b) continue;
    expect(a.chars.some((c) => b.chars.some((d) => hit(c, d))), `"${a.name}" overlaps "${b.name}"`).toBe(false);
  }
});

When('I open the rings clock for {date}', async function (this: World, date: string) {
  await this.page.goto(`/clock-rings/${date}`);
  await expect(this.page.locator(`${tid('clock-view')}[data-variant="rings"]`)).toBeVisible();
});

Then('no name on the clock is upside down', async function (this: World) {
  const labels = this.page.locator(tid('clock-label'));
  await expect(labels.first()).toBeVisible();
  const runs = await labels.evaluateAll((els) => els.map((el) => {
    const t = el as SVGTextContentElement, n = t.getNumberOfChars();
    const [a, b] = [t.getStartPositionOfChar(0), t.getEndPositionOfChar(n - 1)];
    const m = t.getScreenCTM()!;
    const [p, q] = [new DOMPoint(a.x, a.y).matrixTransform(m), new DOMPoint(b.x, b.y).matrixTransform(m)];
    return { name: t.textContent, dx: q.x - p.x, dy: q.y - p.y };
  }));
  for (const r of runs) expect(r.dx, `"${r.name}" reads ${JSON.stringify(r)}`).toBeGreaterThan(-Math.abs(r.dy));
});

Then('the clock lists {string} next to the dial', async function (this: World, text: string) {
  await expect(this.page.locator(tid('clock-overflow')).filter({ hasText: exactText(text) })).toBeVisible();
});

When('I tap {string} in the list next to the clock', async function (this: World, title: string) {
  await this.page.locator(`${tid('clock-overflow')}[data-title="${title}"]`).click();
});

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
  // the middle may name tomorrow's first entry: judge it only once tomorrow is loaded
  await expect(this.page.getByTestId('clock-view')).toHaveAttribute('data-tomorrow-loaded', 'true');
  await expect(this.page.getByTestId('clock-now-line')).toHaveText(text);
  await expect(this.page.getByTestId('clock-now-when')).toHaveCount(0);
});

Then('the middle of the clock says {string} over {string}', async function (this: World, title: string, when: string) {
  await expect(this.page.getByTestId('clock-view')).toHaveAttribute('data-tomorrow-loaded', 'true');
  const first = this.page.getByTestId('clock-now-line'), second = this.page.getByTestId('clock-now-when');
  await expect(first).toHaveText(title);
  await expect(second).toHaveText(when);
  const [a, b] = [await first.boundingBox(), await second.boundingBox()];
  // the line boxes include the halo and leading, so only the second line's middle must lie below the first one's box
  expect(b!.y + b!.height / 2, 'the second line stands below the first').toBeGreaterThan(a!.y + a!.height);
});

Then('the first line in the middle of the clock is {string} cut short with {string}', async function (this: World, full: string, mark: string) {
  const text = (await this.page.getByTestId('clock-now-line').textContent()) ?? '';
  expect(text.endsWith(mark), `"${text}" ends with ${mark}`).toBe(true);
  expect(text.length).toBeLessThan(full.length);
  expect(full.startsWith(text.slice(0, -mark.length)), `"${text}" is the start of "${full}"`).toBe(true);
});

Then('the second line in the middle of the clock is {string}', async function (this: World, when: string) {
  await expect(this.page.getByTestId('clock-now-when')).toHaveText(when);
});

Then('the clock shades no time', async function (this: World) {
  await expect(this.page.getByTestId('clock-now-line')).toBeVisible();
  await expect(this.page.getByTestId('clock-wedge')).toHaveCount(0);
});

Then('the clock shades the time until {time}', async function (this: World, time: string) {
  await expect(this.page.getByTestId('clock-wedge')).toHaveAttribute('data-to', time);
});

Then('the clock shows the all-day event {string}', async function (this: World, title: string) {
  await expect(this.page.locator(tid('clock-allday') + `[data-title="${title}"]`)).toBeVisible();
});
