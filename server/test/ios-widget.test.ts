/* eslint-disable @typescript-eslint/no-explicit-any -- the script and the API answers are untyped JavaScript objects */
import { describe, expect, it } from 'vitest';
import { widgetInstaller } from '@calendar/shared/widget-installer';
import { hourRange } from '@calendar/shared/week-hours';
import { fakeScriptable, layoutOf, runScript, WIDGET_SOURCE, type Net, type Options } from './scriptable-fake.js';
import { widgetSvg } from './widget-picture.js';

const BASE = 'https://cal.example.test';
const KEY = 'cwk_AAAAAAAA_' + 'B'.repeat(43);
const ev = (title: string, start: string, end: string, color = '#3367d6', over: object = {}) => ({
  kind: 'event', id: title, calendarId: 'c', title, allDay: false, start: `2026-10-${start.slice(0, 2)}T${start.slice(3)}:00+02:00`, end: `2026-10-${end.slice(0, 2)}T${end.slice(3)}:00+02:00`, color, ...over });
const T14 = (h: string) => `14 ${h}`; // day 14 at hh:mm
const dentist = ev('Dentist', T14('09:00'), T14('10:00'), '#d93025');
const gym = ev('Gym', T14('18:00'), T14('19:00'), '#188038');
const allDay = (title: string, date: string) => ({ ...ev(title, T14('00:00'), T14('00:00')), allDay: true, start: date, end: date.replace(/\d\d$/, (d) => String(Number(d) + 1)) });
const at = (h: string, day = '14') => Date.parse(`2026-10-${day}T${h}:00+02:00`);

const SCRIPT_3 = '// calendar-widget version=8\nconst x = 1;\n// calendar-widget end\n';
const answer = (items: unknown[], over: object = {}) => ({
  generatedAt: '2026-10-14T08:00:00+02:00', today: '2026-10-14', scriptVersion: 1, items, minEventMinutes: 0, weekSideBySide: false, taskCategories: false, ...over });
const ok = (body: unknown): { status: number; body: string } => ({ status: 200, body: JSON.stringify(body) });
const serve = (items: unknown[], over: object = {}): Net => (url) => (url.includes('/api/widget/data') ? ok(answer(items, over)) : { status: 200, body: SCRIPT_3 });

/** Runs the widget once at `nowMs` and returns what it drew. */
async function draw(items: unknown[], family: string, now: number, o: Options = {}, over: object = {}) {
  const f = fakeScriptable({ keychain: { 'calendar-widget-key': KEY, 'calendar-widget-url': BASE }, net: serve(items, over), widgetFamily: family, ...o });
  const { exports: api } = await runScript(WIDGET_SOURCE, f, { CALENDAR_WIDGET_TEST: true });
  api.now = () => now;
  await api.run();
  return { f, api, said: f.texts.map((t) => t.text), widget: f.widget.set };
}

const PAD = { x: 6, top: 6, bottom: 4 };
const GUTTER = 20;
const canvasOf = (d: { f: { texts: { text: string; where: string }[] } }) => d.f.texts.filter((t) => t.where === 'canvas').map((t) => t.text);
const heads = (d: { said: string[] }) => d.said.filter((t) => /^\p{L}{1,3} \d+$/u.test(t));
const hexOf = (c: any) => c.hex as string;
const mix = (hex: string, surface: string, a: number) => {
  const n = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [c, s2] = [n(hex), n(surface)];
  return '#' + c.map((v, i) => Math.round(v * a + s2[i]! * (1 - a)).toString(16).padStart(2, '0')).join('');
};

/** The box of the stack that holds the text, the way Scriptable would lay the tree out. */
function blockOf(d: { widget: unknown }, text: string) {
  const boxes = layoutOf(d.widget);
  const node = [...boxes.keys()].find((n: any) => n.kind === 'text' && n.text === text) as any;
  return node ? { ...boxes.get(node.parent)!, stack: node.parent } : undefined;
}

/** The geometry the script lays out for a widget of this size (the picture size minus the padding). */
async function gridFor(items: unknown[], size: [number, number], days: number, now = '08:00', hours: unknown = null, k = 1.1) {
  const { exports: api } = await runScript(WIDGET_SOURCE, fakeScriptable(), { CALENDAR_WIDGET_TEST: true });
  const nowMin = Number(now.slice(0, 2)) * 60 + Number(now.slice(3));
  return api.timelineGrid((items as any[]).map(api.entryOf), '2026-10-14', nowMin, 0, size[0] - 2 * PAD.x, size[1] - PAD.top - PAD.bottom, days, k, hours);
}
const MEDIUM: [number, number] = [338, 158];
const LARGE: [number, number] = [338, 354];
const SMALL: [number, number] = [158, 158];

describe('the widget script: Timeline in every size', () => {
  it('the small widget shows today as one column, whatever the day count is', async () => {
    const tomorrow = ev('Gym', '15 18:00', '15 19:00');
    const d = await draw([dentist, tomorrow], 'small', at('08:00'), {}, { widgetTimelineDays: 5 });
    expect(heads(d)).toEqual(['WED 14']);
    expect(d.said).toContain('09:00 Dentist');
    expect(d.said).not.toContain('18:00 Gym');
    const g = await gridFor([dentist, tomorrow], SMALL, 1);
    const b = blockOf(d, '09:00 Dentist')!;
    expect(b.y).toBeCloseTo(PAD.top + g.yOf(9 * 60));
    expect(b.h).toBeCloseTo(g.hourH - 1);
    expect(b.w).toBeCloseTo(g.colW - 3);
    expect(d.f.widget.completed).toBe(true);
  });

  it('the timeline shows the chosen days as columns from today, hours from top to bottom', async () => {
    const tomorrow = ev('Gym', '15 18:00', '15 19:00');
    const dinner = ev('Dinner', '17 19:00', '17 21:00');
    const d = await draw([dentist, tomorrow, dinner], 'medium', at('08:00'), {}, { widgetTimelineDays: 3 });
    expect(heads(d)).toEqual(['WED 14', 'THU 15', 'FRI 16']);
    expect(d.said).not.toContain('19:00 Dinner');
    const g = await gridFor([dentist, tomorrow, dinner], MEDIUM, 3);
    expect(g.colW).toBeCloseTo((MEDIUM[0] - 12 - GUTTER) / 3);
    expect([g.first, g.last]).toEqual([9, 19]);
    const a = blockOf(d, '09:00 Dentist')!;
    const b = blockOf(d, '18:00 Gym')!;
    expect(a.y).toBeCloseTo(PAD.top + g.yOf(9 * 60));
    expect(b.y).toBeCloseTo(PAD.top + g.yOf(18 * 60));
    expect(b.x - a.x).toBeCloseTo(g.colW);
    expect(a.x).toBeCloseTo(PAD.x + GUTTER + 1);
  });

  it('the timeline defaults to three days and fills the medium and the large widget', async () => {
    for (const fam of ['medium', 'large']) {
      const d = await draw([dentist], fam, at('08:00'));
      expect(heads(d)).toEqual(['WED 14', 'THU 15', 'FRI 16']);
      expect(d.said).toContain('09:00 Dentist');
    }
    for (const bad of [9, 0]) expect(heads(await draw([dentist], 'large', at('08:00'), {}, { widgetTimelineDays: bad }))).toHaveLength(3);
    expect(heads(await draw([dentist], 'large', at('08:00'), {}, { widgetTimelineDays: 1 }))).toHaveLength(1);
  });

  it('every day label is text, not only today, and no text is drawn into the picture', async () => {
    const d = await draw([dentist], 'large', at('08:00'));
    expect(heads(d)).toEqual(['WED 14', 'THU 15', 'FRI 16']);
    expect(canvasOf(d)).toEqual([]);
    const today = d.f.texts.find((t) => t.text === 'WED 14')!;
    const other = d.f.texts.find((t) => t.text === 'THU 15')!;
    expect(hexOf((today.color as any))).toBe('#ffffff');
    expect(hexOf((other.color as any).light)).toBe('#2f323a');
    expect(hexOf((other.color as any).dark)).toBe('#e3e5f0');
    const pill = blockOf(d, 'WED 14')!;
    expect(hexOf(pill.stack.backgroundColor)).toBe('#b3261e');
  });

  it('a stored standard layout still draws the timeline', async () => {
    const d = await draw([dentist], 'large', at('08:00'), {}, { widgetLayout: 'standard', widgetTimelineDays: 3 });
    expect(heads(d)).toEqual(['WED 14', 'THU 15', 'FRI 16']);
    expect(d.said).not.toContain('TODAY');
    expect(d.said).toContain('09:00 Dentist');
  });

  it('the timeline band shows all-day entries above the hours, and counts the ones that do not fit', async () => {
    const d = await draw([dentist, allDay('Holiday', '2026-10-14')], 'large', at('08:00'));
    const chip = blockOf(d, 'Holiday')!;
    expect(chip.y).toBeLessThan(blockOf(d, '09:00 Dentist')!.y);
    expect(hexOf(chip.stack.backgroundColor.light)).toBe(mix('#3367d6', '#faf9fe', 0.24));
    const many = await draw([allDay('A', '2026-10-14'), allDay('B', '2026-10-14'), allDay('C', '2026-10-14')], 'large', at('08:00'));
    expect(many.said).toContain('+2 more');
    expect((await draw([allDay('A', '2026-10-14'), allDay('B', '2026-10-14'), allDay('C', '2026-10-14')], 'large', at('08:00'), {}, { language: 'de' })).said).toContain('+2 weitere');
  });

  it('the widget fits the screen: the picture has the size Apple lists for the iPhone', async () => {
    const pic = async (fam: string, screen: [number, number]) => {
      const d = await draw([dentist], fam, at('08:00'), { screen });
      const picture = [...layoutOf(d.widget).keys()].map((n: any) => n.backgroundImage).find(Boolean);
      return [picture.size.width, picture.size.height, d.f.widget.presented];
    };
    expect(await pic('large', [430, 932])).toEqual([364, 382, null]);
    expect(await pic('medium', [375, 812])).toEqual([329, 155, null]);
    expect(await pic('small', [390, 844])).toEqual([158, 158, null]);
    expect(await pic('large', [414, 896])).toEqual([360, 379, null]);
    expect(await pic('large', [375, 667])).toEqual([321, 324, null]);
    // a screen the table lacks uses the row of the nearest smaller one; one below all uses the smallest
    expect(await pic('medium', [402, 874])).toEqual([338, 158, null]);
    expect(await pic('medium', [440, 956])).toEqual([364, 170, null]);
    expect(await pic('small', [320, 568])).toEqual([148, 148, null]);
    // landscape reports the same screen turned around
    expect(await pic('medium', [844, 390])).toEqual([338, 158, null]);
  });

  it('the timeline hours follow the days shown only', async () => {
    const night = ev('Night', '17 22:00', '17 23:00');
    const gym2 = ev('Gym', T14('18:00'), T14('19:00'));
    const two = await draw([dentist, gym2, night], 'large', at('08:00'), {}, { widgetTimelineDays: 2 });
    expect(two.said).toEqual(expect.arrayContaining(['09', '18']));
    expect(two.said).not.toContain('08');
    expect(two.said).not.toContain('19');
    const g2 = await gridFor([dentist, gym2, night], LARGE, 2);
    expect([g2.first, g2.last]).toEqual([9, 19]);
    const g4 = await gridFor([dentist, gym2, night], LARGE, 4);
    expect([g4.first, g4.last]).toEqual([9, 23]);
  });

  it('the timeline runs up to seven days from today and writes narrow day letters when the columns are thin', async () => {
    const review = ev('Review', '20 14:00', '20 15:00');
    const d = await draw([review], 'large', at('08:00'), {}, { widgetTimelineDays: 7 });
    expect(heads(d)).toEqual(['W 14', 'T 15', 'F 16', 'S 17', 'S 18', 'M 19', 'T 20']);
    expect(d.said).toContain('14:00 Review');
    expect(d.f.requests[0]!.url).toContain('from=2026-10-12&to=2026-10-21');
  });

  it('the timeline text size scales its texts and its hours still fit the height', async () => {
    const sizeOf = (d: any, text: string) => d.f.texts.find((t: any) => t.text === text).size;
    for (const [pct, k] of [[undefined, 1.1], [90, 0.9], [150, 1.5]] as const) {
      const d = await draw([dentist], 'medium', at('08:00'), {}, pct ? { widgetTimelineTextSize: pct } : {});
      expect(sizeOf(d, '09:00 Dentist'), `block at ${pct}`).toBeCloseTo(8 * k);
      expect(sizeOf(d, 'WED 14'), `day name at ${pct}`).toBeCloseTo(10 * k);
    }
    const g = await gridFor([dentist], MEDIUM, 3, '08:00', null, 1.5);
    expect(g.top + (g.last - g.first) * g.hourH).toBeLessThanOrEqual(MEDIUM[1] - PAD.top - PAD.bottom - 2 + 0.01);
    expect(g.hourH).toBeGreaterThan(8);
    const d = await draw([dentist], 'medium', at('08:00'), {}, { widgetTimelineTextSize: 150 });
    expect(blockOf(d, '09:00 Dentist')!.y).toBeCloseTo(PAD.top + g.yOf(9 * 60));
  });

  const fixed = (from: string, to: string) => ({ mode: 'fixed', from, to });
  const timelineAt = (items: unknown[], hours: unknown) => gridFor(items, LARGE, 3, '08:00', hours);

  it('a fixed range sets the hours and puts entries outside it as a marker at the edge of their day', async () => {
    const cinema = ev('Cinema', T14('19:00'), T14('21:00'));
    const early = ev('Run', T14('06:00'), T14('07:00'));
    const g = await timelineAt([dentist, early, cinema], fixed('08:00', '12:00'));
    expect([g.first, g.last]).toEqual([8, 12]);
    expect(g.cols[0].blocks.map((b: any) => b.e.title)).toEqual(['Dentist']);
    expect(g.cols[0].below.label).toBe('▾ Cinema 19:00');
    expect(g.cols[0].above.label).toBe('▴ Run 06:00');
    expect(g.cols[1].below).toBeNull();
    const d = await draw([dentist, early, cinema], 'large', at('08:00'), {}, { widgetTimelineHours: fixed('08:00', '12:00') });
    expect(d.said).toEqual(expect.arrayContaining(['▾ Cinema 19:00', '▴ Run 06:00', '09:00 Dentist']));
    const below = blockOf(d, '▾ Cinema 19:00')!;
    expect(below.y).toBeCloseTo(PAD.top + g.yOf(12 * 60) + 1, 0);
  });

  it('edge markers get their own strip, so the blocks stay on their hours and nothing runs past the bottom', async () => {
    const early = ev('Run', T14('06:00'), T14('07:00'));
    const first = ev('First', T14('08:00'), T14('09:00'));
    const last = ev('Last', T14('11:00'), T14('12:00'));
    const cinema = ev('Cinema', T14('19:00'), T14('21:00'));
    const hours = fixed('08:00', '12:00');
    const g = await timelineAt([early, first, last, cinema], hours);
    const d = await draw([early, first, last, cinema], 'large', at('07:30'), {}, { widgetTimelineHours: hours });
    expect(blockOf(d, '08:00 First')!.y).toBeCloseTo(PAD.top + g.yOf(8 * 60));
    expect(blockOf(d, '11:00 Last')!.y).toBeCloseTo(PAD.top + g.yOf(11 * 60));
    const above = blockOf(d, '▴ Run 06:00')!;
    const below = blockOf(d, '▾ Cinema 19:00')!;
    expect(above.y + above.h).toBeLessThanOrEqual(PAD.top + g.yOf(8 * 60) + 0.01);
    expect(below.y).toBeGreaterThanOrEqual(PAD.top + g.yOf(12 * 60) - 0.01);
    expect(below.y + below.h).toBeLessThanOrEqual(LARGE[1] - PAD.bottom + 0.01);
  });

  it('a block raised to the minimum height does not push the blocks after it', async () => {
    const tiny = ev('Tiny', T14('09:00'), T14('09:02'));
    const next = ev('Next', T14('09:02'), T14('09:30'));
    const later = ev('Later', T14('10:00'), T14('11:00'));
    const g = await gridFor([tiny, next, later], LARGE, 3);
    const d = await draw([tiny, next, later], 'large', at('08:00'));
    expect(blockOf(d, '10:00 Later')!.y).toBeCloseTo(PAD.top + g.yOf(10 * 60));
    const n = blockOf(d, '09:02 Next')!;
    expect(n.y + n.h).toBeCloseTo(PAD.top + g.yOf(9 * 60 + 30) - 1, 0);
  });

  it('an entry that reaches into the fixed range is clipped to it and gets no marker; several outside count as +n', async () => {
    const long = ev('Long', T14('07:00'), T14('09:30'));
    const a = ev('A', T14('20:00'), T14('21:00'));
    const b = ev('B', T14('22:00'), T14('23:00'));
    const g = await timelineAt([long, a, b], fixed('08:00', '18:00'));
    expect(g.cols[0].blocks[0].y).toBeCloseTo(g.yOf(8 * 60));
    expect(g.cols[0].above).toBeNull();
    expect(g.cols[0].below.label).toBe('▾ A 20:00 +1');
  });

  it('automatic, a missing or an unusable range keeps the hours that fit the entries', async () => {
    for (const h of [undefined, { mode: 'auto', from: '08:00', to: '12:00' }, fixed('12:00', '08:00'), fixed('8', '12:00'), fixed('08:00', '08:00')]) {
      const g = await timelineAt([dentist, gym], h);
      expect([g.first, g.last], JSON.stringify(h)).toEqual([9, 19]);
      expect(g.cols[0].below).toBeNull();
    }
    expect((await timelineAt([dentist], fixed('08:00', '12:30'))).last).toBe(13);
  });

  // iOS centres what does not fill a stack, so every stack is filled exactly or closed by a flexible spacer
  const drifting = (widget: unknown) => {
    const boxes = layoutOf(widget);
    return [...boxes.values()].filter(({ node: n }: any) => {
      if (n.kind !== 'stack' || !n.size || !n.kids.length || n.kids.some((k: any) => k.kind === 'spacer' && k.length == null)) return false;
      const main = (k: any) => (k.kind === 'spacer' ? k.length : n.horizontal ? boxes.get(k)!.w : boxes.get(k)!.h);
      return Math.abs(n.kids.reduce((a: number, k: any) => a + main(k), 0) - (n.horizontal ? n.size.width : n.size.height)) > 0.01;
    });
  };

  it('no stack can drift: each is filled exactly or ends with a flexible spacer', async () => {
    const busy = [dentist, ev('Gym', '14 18:55', '14 19:00'), ev('Early', '14 05:00', '14 06:00'), ev('Late', '14 22:00', '14 23:00'),
      allDay('Holiday', '2026-10-14'), allDay('Fair', '2026-10-14'), allDay('Trip', '2026-10-14'), ev('Talk', '15 10:00', '15 11:00'), ev('Call', '15 10:30', '15 12:00')];
    for (const family of ['small', 'medium', 'large']) {
      for (const [hours, size] of [[null, 110], [{ mode: 'fixed', from: '08:00', to: '19:00' }, 110], [{ mode: 'fixed', from: '00:00', to: '23:59' }, 150]]) {
        const d = await draw(busy, family, at('09:30'), {}, { widgetTimelineHours: hours, widgetTimelineDays: 3, widgetTimelineTextSize: size });
        expect(drifting(d.widget).map((b: any) => b.node.kids.map((k: any) => k.kind).join(','))).toEqual([]);
      }
    }
  });

  it('a short entry at the end of the range stays inside the hours', async () => {
    const d = await draw([dentist, ev('Gym', '14 18:55', '14 19:00')], 'medium', at('08:00'), {}, { widgetTimelineHours: { mode: 'fixed', from: '08:00', to: '19:00' } });
    const g = await gridFor([dentist], MEDIUM, 3, '08:00', { mode: 'fixed', from: '08:00', to: '19:00' });
    const b = blockOf(d, '18:55 Gym')!;
    expect(b.y + b.h).toBeLessThanOrEqual(PAD.top + g.yOf(19 * 60) + 0.01);
    expect(b.y).toBeCloseTo(PAD.top + g.yOf(18 * 60 + 55));
  });

  it('lays overlapping entries side by side and a short one as tall as the minimum length', async () => {
    const a = ev('A', T14('09:00'), T14('10:00'));
    const b = ev('B', T14('09:30'), T14('10:30'));
    const c = ev('C', T14('12:00'), T14('13:00'));
    const d = await draw([a, b, c], 'large', at('08:00'));
    const g = await gridFor([a, b, c], LARGE, 3);
    const [x, y, z] = ['09:00 A', '09:30 B', '12:00 C'].map((t) => blockOf(d, t)!);
    const [ga, gb, gc] = g.cols[0].blocks;
    expect(x.w).toBeCloseTo(y!.w);
    expect(y!.x - x.x).toBeCloseTo(ga.w + 1);
    for (const [box, geo] of [[x, ga], [y!, gb], [z!, gc]] as const) {
      expect(box.x).toBeCloseTo(PAD.x + geo.x);
      expect(box.y).toBeCloseTo(PAD.top + geo.y);
      expect(box.h).toBeCloseTo(geo.h);
    }
    const f = fakeScriptable();
    const { exports: api } = await runScript(WIDGET_SOURCE, f, { CALENDAR_WIDGET_TEST: true });
    const short = api.timelineGrid([api.entryOf(ev('Short', T14('09:00'), T14('09:05')))], '2026-10-14', 0, 30, 338, 354, 1);
    expect(short.cols[0].blocks[0].h).toBeCloseTo(short.hourH * 0.5 - 1);
  });

  it('a block is an opaque tint of its calendar colour that follows light and dark, with a bar in the full colour', async () => {
    const d = await draw([dentist], 'medium', at('08:00'));
    const b = blockOf(d, '09:00 Dentist')!;
    expect(hexOf(b.stack.backgroundColor.light)).toBe(mix('#d93025', '#faf9fe', 0.24));
    expect(hexOf(b.stack.backgroundColor.dark)).toBe(mix('#d93025', '#0d0e12', 0.24));
    expect(b.stack.backgroundColor.light.alpha).toBe(1);
    const bar = b.stack.kids[0];
    expect(hexOf(bar.backgroundColor)).toBe('#d93025');
    expect(layoutOf(d.widget).get(bar)!.w).toBe(3);
    // the bar is the block's left edge, also when the text is short
    expect(layoutOf(d.widget).get(bar)!.x).toBe(b.x);
    const ink = d.f.texts.find((t) => t.text === '09:00 Dentist')!.color as any;
    expect([hexOf(ink.light), hexOf(ink.dark)]).toEqual(['#2f323a', '#e3e5f0']);
    const root = d.widget;
    expect(hexOf(root.backgroundColor.light)).toBe('#faf9fe');
    expect(hexOf(root.backgroundColor.dark)).toBe('#0d0e12');
  });

  it('the timeline draws the red now-line into its picture, which holds only lines, and cuts a running entry with it', async () => {
    const d = await draw([dentist], 'medium', at('09:20'));
    const g = await gridFor([dentist], MEDIUM, 3, '09:20');
    const picture = [...layoutOf(d.widget).keys()].map((n: any) => n.backgroundImage).find(Boolean);
    expect(canvasOf(d)).toEqual([]);
    expect(picture.rects.length).toBe(g.last - g.first + 1);
    const lines = picture.rects.filter((r: any) => r.color === '#d93025');
    expect(lines).toHaveLength(1);
    expect(lines[0].x).toBeCloseTo(PAD.x + g.cols[0].x);
    expect(lines[0].y + 0.75).toBeCloseTo(PAD.top + g.yOf(9 * 60 + 20));
    expect(lines[0].w).toBeCloseTo(g.colW);
    for (const r of picture.rects.filter((x: any) => x.color !== '#d93025')) expect(r.alpha).toBeLessThan(1);
    const boxes = [...layoutOf(d.widget).values()];
    const stripe = boxes.find((b) => (b.node as any).backgroundColor?.hex === '#d93025' && b.h === 1.5)!;
    expect(stripe.y + 0.75).toBeCloseTo(PAD.top + g.yOf(9 * 60 + 20));
    expect(stripe.x).toBeCloseTo(PAD.x + g.cols[0].x);
    expect(stripe.w).toBeCloseTo(g.colW);
    const cut = boxes.filter((b) => (b.node as any).backgroundColor?.light?.hex === mix('#d93025', '#faf9fe', 0.24));
    expect(cut).toHaveLength(2);
    expect(cut[0]!.y + cut[0]!.h).toBeLessThanOrEqual(stripe.y + 0.01);
    expect(cut[1]!.y).toBeGreaterThanOrEqual(stripe.y + 1.5 - 0.01);
    expect(cut[0]!.y).toBeCloseTo(PAD.top + g.yOf(9 * 60));
    expect(cut[1]!.y + cut[1]!.h).toBeCloseTo(PAD.top + g.yOf(10 * 60) - 1, 0);
  });

  it('the stale note is added to the timeline as well', async () => {
    const cache = { '/lib/calendar-widget-data.json': JSON.stringify({ data: answer([dentist], { generatedAt: '2026-10-14T06:00:00+02:00' }), savedAt: at('06:00') }) };
    const d = await draw([], 'medium', at('08:00'), { net: undefined, files: cache });
    expect(d.said).toContain('09:00 Dentist');
    expect(d.said).toContain('Data from 06:00');
    const note = blockOf(d, 'Data from 06:00')!;
    expect(note.y).toBeGreaterThanOrEqual(PAD.top + 100);
  });
});

describe('the widget script: German', () => {
  const de = (o: Options = {}, over: object = {}) => ({ o: { language: 'en', ...o }, over: { language: 'de', ...over } });

  it('draws its texts in German when the app language is German, whatever the iPhone speaks', async () => {
    const tomorrow = ev('Gym', '15 18:00', '15 19:00');
    const { o, over } = de();
    const medium = await draw([dentist, tomorrow, allDay('Feiertag', '2026-10-14')], 'medium', at('08:00'), o, over);
    expect(heads(medium)).toEqual(['MI 14', 'DO 15', 'FR 16']);
    expect(medium.said).toEqual(expect.arrayContaining(['09:00 Dentist', '18:00 Gym', 'Feiertag']));
    const three = [allDay('A', '2026-10-14'), allDay('B', '2026-10-14'), allDay('C', '2026-10-14')];
    expect((await draw(three, 'small', at('08:00'), o, over)).said).toContain('+2 weitere');
    expect((await draw([dentist, gym], 'accessoryRectangular', at('09:20'), o, over)).said).toEqual(['Dentist · bis 10:00', 'Danach: Gym 18:00']);
  });

  it('follows the iPhone when the app language is auto, and reads the fun German variants as German', async () => {
    expect(heads(await draw([dentist], 'small', at('08:00'), { language: 'de-DE' }, { language: 'auto' }))[0]).toBe('MI 14');
    expect(heads(await draw([dentist], 'small', at('08:00'), { language: 'en-GB' }, { language: 'auto' }))[0]).toBe('WED 14');
    expect(heads(await draw([dentist], 'small', at('08:00'), { language: 'en' }, { language: 'de-x-mainfr' }))[0]).toBe('MI 14');
    expect(heads(await draw([dentist], 'small', at('08:00'), { language: 'fr' }, { language: 'auto' }))[0]).toBe('WED 14');
  });

  it('says the stale note, the countdown and every refusal in German', async () => {
    const cache = { '/lib/calendar-widget-data.json': JSON.stringify({ data: answer([dentist], { generatedAt: '2026-10-14T06:00:00+02:00', language: 'de' }), savedAt: at('06:00') }) };
    expect((await draw([], 'medium', at('08:00'), { net: undefined, files: cache })).said).toContain('Stand 06:00');
    const net: Net = () => ({ status: 401, body: JSON.stringify({ error: { code: 'WIDGET_KEY_REVOKED' } }) });
    expect((await draw([], 'medium', at('08:00'), { net, files: cache })).said).toEqual(['Dieses Widget wurde in der App entfernt. Füge es in den Einstellungen neu hinzu.']);
    expect((await draw([], 'medium', at('08:00'), { net: undefined, language: 'de' })).said).toEqual(['Noch keine Daten. Das Widget lädt sie, sobald dein iPhone eine Internetverbindung hat.']);
    expect((await draw([], 'medium', at('08:00'), { keychain: {}, language: 'de' })).said).toEqual(['Noch nicht eingerichtet. Starte zuerst den Installer in Scriptable.']);
    const circle = await draw([dentist], 'accessoryCircular', at('08:20'), { language: 'en' }, { language: 'de', widgetCircle: 'countdown' });
    expect(circle.said).toContain('in');
  });
});

describe('the week hour rule (the Android WeekLayoutTest cases)', () => {
  const week = (...m: number[]) => m.reduce<{ start: number; end: number }[]>((l, v, i) => (i % 2 ? l : [...l, { start: v, end: m[i + 1]! }]), []);
  it('fits the earliest start and latest end', () => { expect(hourRange(week(9 * 60 + 15, 10 * 60, 16 * 60, 16 * 60 + 30))).toEqual([9, 17]); });
  it('rounds the end up', () => { expect(hourRange(week(8 * 60, 9 * 60, 13 * 60, 14 * 60 + 1))).toEqual([8, 15]); });
  it('has a minimum span of six hours', () => {
    const r = hourRange(week(12 * 60, 13 * 60));
    expect(r[1] - r[0]).toBe(6);
    expect(r[0] <= 12 && r[1] >= 13).toBe(true);
  });
  it('stays within the day', () => {
    expect(hourRange(week(23 * 60, 24 * 60))).toEqual([18, 24]);
    expect(hourRange(week(0, 60))[0]).toBe(0);
  });
  it('shows 08 to 18 for an empty week', () => { expect(hourRange([])).toEqual([8, 18]); });
  it('is the shared function inside the script the server serves', () => {
    expect(WIDGET_SOURCE).toContain(hourRange.toString());
    expect(WIDGET_SOURCE).not.toContain('@inline');
  });
});

describe('the widget script: lock screen', () => {
  it('inline says the next entry and its time', async () => {
    const d = await draw([dentist], 'accessoryInline', at('08:00'));
    expect(d.said).toEqual(['Dentist · 09:00']);
  });

  it('circular shows the next start time by default, also with no setting in an older answer', async () => {
    for (const now of [at('08:20'), at('08:59') + 30000, at('07:30')]) {
      const d = await draw([dentist], 'accessoryCircular', now);
      expect(d.said).toEqual(['09:00']);
    }
    const d = await draw([dentist], 'accessoryCircular', at('08:20'));
    expect(d.widget.refreshAfterDate.getTime()).toBe(at('09:00'));
    expect((await draw([dentist], 'accessoryCircular', at('08:20'), {}, { widgetCircle: 'time' })).said).toEqual(['09:00']);
  });

  it('circular countdown counts down live to the next start with a relative date, not static minutes', async () => {
    const d = await draw([dentist], 'accessoryCircular', at('08:20'), {}, { widgetCircle: 'countdown' });
    const date = d.f.texts.find((t) => t.text.startsWith('date:'))!;
    expect(date.text).toBe(`date:${new Date(at('09:00')).toISOString()}`);
    expect(date.relative).toBe(true);
    expect(d.said).toContain('in');
    expect(d.said.join(' ')).not.toMatch(/\d+ min/);
    expect(d.widget.refreshAfterDate.getTime()).toBe(at('08:59'));
  });

  it('circular countdown says now in the last minute and then moves on to the following entry', async () => {
    const d = await draw([dentist, gym], 'accessoryCircular', at('08:59'), {}, { widgetCircle: 'countdown' });
    expect(d.said).toEqual(['now']);
    expect(d.widget.refreshAfterDate.getTime()).toBe(at('09:00'));
    const after = await draw([dentist, gym], 'accessoryCircular', at('09:02'), {}, { widgetCircle: 'countdown' });
    expect(after.said).toEqual(['18:00']);
  });

  it('circular countdown shows the start time when far away and redraws when it comes within the hour', async () => {
    const d = await draw([dentist], 'accessoryCircular', at('07:30'), {}, { widgetCircle: 'countdown' });
    expect(d.said).toEqual(['09:00']);
    expect(d.widget.refreshAfterDate.getTime()).toBe(at('08:00'));
  });

  it('rectangular says what is going on now and what is next, with no date line', async () => {
    const d = await draw([dentist, gym], 'accessoryRectangular', at('09:20'));
    expect(d.said).toEqual(['Dentist · until 10:00', 'After: Gym 18:00']);
    expect(d.said.join(' ')).not.toMatch(/\d{4}|Wed|\b14\b/);
  });

  it('rectangular names the next entry first when nothing is running, then the one after it', async () => {
    const d = await draw([dentist, gym], 'accessoryRectangular', at('08:00'));
    expect(d.said).toEqual(['Dentist · 09:00', 'After: Gym 18:00']);
    expect((await draw([dentist, gym], 'accessoryRectangular', at('08:00'), { language: 'de' })).said[1]).toBe('Danach: Gym 18:00');
  });

  it('shows no clock on any lock-screen size', async () => {
    for (const fam of ['accessoryInline', 'accessoryCircular', 'accessoryRectangular']) {
      const d = await draw([dentist, gym], fam, at('08:20'));
      expect(d.said.join(' ')).not.toContain('08:20');
    }
  });
});

describe('the widget script: offline, refusals, redraw, tap', () => {
  const cacheOf = (items: unknown[], savedAt: number) => ({ '/lib/calendar-widget-data.json': JSON.stringify({ data: answer(items, { generatedAt: '2026-10-14T06:00:00+02:00' }), savedAt }) });

  it('without a connection shows its last answer and says how old it is after two hours', async () => {
    const d = await draw([], 'medium', at('08:00'), { net: undefined, files: cacheOf([dentist], at('06:00')) });
    expect(d.said).toEqual(expect.arrayContaining(['09:00 Dentist', 'Data from 06:00']));
  });

  it('says nothing about its age when the answer is fresh or younger than two hours', async () => {
    expect((await draw([dentist], 'medium', at('08:00'))).said.join(' ')).not.toContain('Data from');
    const d = await draw([], 'medium', at('07:00'), { net: undefined, files: cacheOf([dentist], at('06:00')) });
    expect(d.said).toContain('09:00 Dentist');
    expect(d.said.join(' ')).not.toContain('Data from');
  });

  it('says it is waiting before the first answer', async () => {
    const d = await draw([], 'medium', at('08:00'), { net: undefined });
    expect(d.said).toEqual(['No data yet. The widget loads it as soon as your iPhone is online.']);
  });

  it('says the key was removed, drops the cached answer and shows nothing else', async () => {
    const net: Net = () => ({ status: 401, body: JSON.stringify({ error: { code: 'WIDGET_KEY_REVOKED' } }) });
    const d = await draw([], 'medium', at('08:00'), { net, files: cacheOf([dentist], at('07:00')) });
    expect(d.said).toEqual(['This widget was removed in the app. Add it again in Settings.']);
    expect(d.f.files.has('/lib/calendar-widget-data.json')).toBe(false);
  });

  it('shows only the refusal when there is no earlier answer', async () => {
    const net: Net = () => ({ status: 401, body: JSON.stringify({ error: { code: 'WIDGET_KEY_INVALID' } }) });
    const d = await draw([], 'medium', at('08:00'), { net });
    expect(d.said).toEqual(['This widget is not valid. Add it again in Settings.']);
  });

  it('asks to be redrawn at the next change in the day', async () => {
    const d = await draw([dentist], 'medium', at('09:20'));
    expect(d.widget.refreshAfterDate.getTime()).toBe(at('10:00'));
    const none = await draw([], 'medium', at('09:20'));
    expect(none.widget.refreshAfterDate.getTime()).toBe(at('09:20') + 3600e3);
  });

  it('a tap runs the widget in Scriptable, which loads fresh data, and opens no web page', async () => {
    for (const fam of ['small', 'medium', 'large']) {
      const d = await draw([dentist], fam, at('09:20'));
      expect(d.widget.url).toBe('scriptable:///run/Calendar');
    }
    expect((await draw([dentist], 'medium', at('09:20'), { scriptName: 'My Calendar' })).widget.url).toBe('scriptable:///run/My%20Calendar');
  });

  it('shows the large preview when it runs in the app', async () => {
    const d = await draw([dentist], 'ignored', at('09:20'), { widgetFamily: null });
    expect(d.f.widget.presented).toBe('large');
    expect(heads(d)).toHaveLength(3);
  });

  it('explains how to set it up instead of failing when there is no key', async () => {
    const d = await draw([], 'medium', at('09:20'), { keychain: {}, net: undefined });
    expect(d.said).toEqual(['Not set up yet. Run the installer in Scriptable first.']);
    expect(d.f.requests).toEqual([]);
  });

  it('sends the key as a bearer header and logs nothing', async () => {
    const d = await draw([dentist], 'small', at('08:00'));
    expect(d.f.requests[0]!.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(WIDGET_SOURCE).not.toContain('console.');
  });
});

describe('the widget script: one cache for every size', () => {
  it('asks for the same range in every size and draws the full week offline after a small widget wrote the cache', async () => {
    const monday = ev('Standup', '12 09:30', '12 10:00');
    const friday = ev('Retro', '16 15:00', '16 16:00');
    const small = await draw([monday, friday, dentist], 'small', at('08:00'));
    expect(small.f.requests[0]!.url).toContain('from=2026-10-12&to=2026-10-21');
    for (const fam of ['medium', 'large', 'accessoryRectangular']) {
      expect((await draw([], fam, at('08:00'))).f.requests[0]!.url).toContain('from=2026-10-12&to=2026-10-21');
    }
    const files = Object.fromEntries(small.f.files);
    const large = await draw([], 'large', at('08:00'), { net: undefined, files, widgetFamily: 'large' });
    expect(large.said).toEqual(expect.arrayContaining(['09:00 Dentist', '15:00 Retro']));
  });

  it('keeps the range within what the server allows, on a Sunday as well', async () => {
    const f = fakeScriptable();
    const { exports: api } = await runScript(WIDGET_SOURCE, f, { CALENDAR_WIDGET_TEST: true });
    expect(api.rangeFor('2026-10-18')).toEqual(['2026-10-12', '2026-10-25']);
    expect(api.rangeFor('2026-10-12')).toEqual(['2026-10-11', '2026-10-19']);
  });
});

describe('the widget script: updates itself', () => {
  it('saves a newer script and keeps drawing today as before', async () => {
    const d = await draw([dentist], 'small', at('08:00'), {}, { scriptVersion: 8 });
    expect(d.f.files.get('/docs/Calendar.js')).toMatch(/^\/\/ calendar-widget version=8\n/);
    expect(d.said).toContain('09:00 Dentist');
  });

  it('keeps the old script when the download breaks off', async () => {
    const net: Net = (url) => { if (url.includes('/script')) throw new Error('broke off'); return ok(answer([dentist], { scriptVersion: 8 })); };
    const d = await draw([dentist], 'small', at('08:00'), { net });
    expect(d.f.files.has('/docs/Calendar.js')).toBe(false);
    expect(d.said).toContain('09:00 Dentist');
  });

  it('does not save a truncated download that lacks the end marker', async () => {
    const net: Net = (url) => (url.includes('/script') ? { status: 200, body: '// calendar-widget version=8\nconst x = 1;\n' } : ok(answer([dentist], { scriptVersion: 8 })));
    const d = await draw([dentist], 'small', at('08:00'), { net });
    expect(d.f.files.has('/docs/Calendar.js')).toBe(false);
  });

  it('does not save a download whose first line is not a newer version', async () => {
    const net: Net = (url) => (url.includes('/script') ? { status: 200, body: '<html>captive portal</html>' } : ok(answer([dentist], { scriptVersion: 8 })));
    const d = await draw([dentist], 'small', at('08:00'), { net });
    expect(d.f.files.has('/docs/Calendar.js')).toBe(false);
  });

  it('ends with the marker line the updater checks', () => {
    expect(WIDGET_SOURCE.trimEnd().split('\n').at(-1)).toBe('// calendar-widget end');
  });

  it('has the version its first line names', () => {
    expect(WIDGET_SOURCE.split('\n')[0]).toBe('// calendar-widget version=7');
    expect(WIDGET_SOURCE).not.toMatch(/cwk_|@example/);
  });
});

describe('the installer', () => {
  const install = async (o: Options) => {
    const f = fakeScriptable(o);
    await runScript(widgetInstaller(BASE + '/', KEY), f);
    return f;
  };
  const script = '// calendar-widget version=1\n// calendar-widget end\n';

  it('starts with the words Calendar widget installer and has the key and the server URL in it', () => {
    const text = widgetInstaller(BASE, KEY);
    expect(text.split('\n')[0]).toBe('// Calendar widget installer');
    expect(text).toContain(JSON.stringify(KEY));
    expect(text).toContain(JSON.stringify(BASE));
    expect(text).not.toMatch(/YOUR|<|fill in|TODO/i);
  });

  it('saves the script as Calendar, keeps key and URL in the Keychain and says to add the widget', async () => {
    const f = await install({ net: () => ({ status: 200, body: script }) });
    expect(f.files.get('/docs/Calendar.js')).toBe(script);
    expect(f.keychain.get('calendar-widget-key')).toBe(KEY);
    expect(f.keychain.get('calendar-widget-url')).toBe(BASE);
    expect(f.requests[0]).toEqual({ url: `${BASE}/api/widget/script`, headers: { Authorization: `Bearer ${KEY}` } });
    expect(f.alerts[0]!.message).toBe('Installed');
    expect(f.files.get('/docs/Calendar.js')).not.toContain(KEY);
  });

  it('deletes itself after a good install', async () => {
    const f = await install({ net: () => ({ status: 200, body: script }), files: { '/docs/Untitled Script.js': 'installer text' } });
    expect(f.files.has('/docs/Untitled Script.js')).toBe(false);
    expect(f.alerts.map((a) => a.message)).toEqual(['Installed']);
  });

  it('asks the person to delete it when it cannot, in German too', async () => {
    const f = await install({ net: () => ({ status: 200, body: script }), files: { '/docs/Untitled Script.js': 'installer text' }, removeFails: true });
    expect(f.alerts.map((a) => a.message)).toEqual(['Installed\n\nPlease delete this installer in Scriptable.']);
    const g = await install({ net: () => ({ status: 200, body: script }), files: { '/docs/Untitled Script.js': 'x' }, removeFails: true, language: 'de' });
    expect(g.alerts[0]!.message).toBe('Installiert\n\nLösche bitte diesen Installer in Scriptable.');
  });

  it('keeps nothing from a truncated script', async () => {
    const f = await install({ net: () => ({ status: 200, body: '// calendar-widget version=1\n' }) });
    expect(f.files.has('/docs/Calendar.js')).toBe(false);
    expect(f.alerts[0]!.message).toBe('The calendar is not reachable. Try again in a few minutes.');
  });

  it('falls back to the local folder when iCloud is off', async () => {
    const f = await install({ net: () => ({ status: 200, body: script }), icloud: false });
    expect(f.files.has('/docs/Calendar.js')).toBe(true);
  });

  it.each([
    ['unknown', { status: 401, body: JSON.stringify({ error: { code: 'WIDGET_KEY_INVALID' } }) }, 'This widget is not valid. Add it again in Settings.'],
    ['removed', { status: 401, body: JSON.stringify({ error: { code: 'WIDGET_KEY_REVOKED' } }) }, 'This widget was removed in the app. Add it again in Settings.'],
    ['busy', { status: 429, body: '' }, 'Too many tries. Wait a minute and tap ▶ again.'],
    ['server', { status: 502, body: '<html>bad gateway</html>' }, 'The calendar is not reachable. Try again in a few minutes.'],
  ])('says what to do after a %s answer and saves nothing', async (_n, reply, message) => {
    const f = await install({ net: () => reply });
    expect(f.alerts.map((a) => a.message)).toEqual([message]);
    expect(f.files.size).toBe(0);
    expect(f.keychain.size).toBe(0);
  });

  it('says what to do without a connection and saves nothing', async () => {
    const f = await install({});
    expect(f.alerts.map((a) => a.message)).toEqual(['No connection. Connect to the internet and tap ▶ again.']);
    expect(f.files.size + f.keychain.size).toBe(0);
  });

  it('says what to do when the server does not answer', async () => {
    const f = fakeScriptable({ net: () => { throw new Error('x'); } });
    f.globals.Request = class { headers = {}; response = null; constructor(readonly url: string) {} async loadString() { throw new Error('The request timed out.'); } };
    await runScript(widgetInstaller(BASE, KEY), f);
    expect(f.alerts.map((a) => a.message)).toEqual(['The calendar is not reachable. Try again in a few minutes.']);
  });

  it('speaks German when the app language is German, even on an English iPhone', async () => {
    const f = fakeScriptable({ net: () => ({ status: 200, body: script }), language: 'en' });
    await runScript(widgetInstaller(BASE, KEY, 'de'), f);
    expect(f.alerts[0]!.message).toBe('Installiert');
    const g = fakeScriptable({ net: () => ({ status: 200, body: script }), language: 'de' });
    await runScript(widgetInstaller(BASE, KEY, 'auto'), g);
    expect(g.alerts[0]!.message).toBe('Installiert');
    const h = fakeScriptable({ net: () => ({ status: 401, body: '{}' }), language: 'fr' });
    await runScript(widgetInstaller(BASE, KEY, 'auto'), h);
    expect(h.alerts[0]!.message).toBe('This widget is not valid. Add it again in Settings.');
  });

  it('speaks German on a German iPhone', async () => {
    const f = await install({ net: () => ({ status: 200, body: script }), language: 'de' });
    expect(f.alerts[0]!.message).toBe('Installiert');
  });
});

describe('the widget picture (look at the layout without a phone)', () => {
  it('draws each entry where the layout puts it, with its bar colour and title', async () => {
    const d = await draw([dentist, gym], 'medium', at('08:00'));
    const svg = widgetSvg(d.widget);
    const b = blockOf(d, '09:00 Dentist')!;
    expect(svg).toContain(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"`);
    expect(svg).toMatch(/fill="#d93025"/);
    expect(svg).toMatch(/>09:00 Dentist<\/text>/);
  });

  it('draws dark mode with the dark side of the colours', async () => {
    const d = await draw([dentist], 'medium', at('08:00'));
    expect(widgetSvg(d.widget, true)).not.toBe(widgetSvg(d.widget));
  });
});
