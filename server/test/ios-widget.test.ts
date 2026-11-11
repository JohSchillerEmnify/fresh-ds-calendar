/* eslint-disable @typescript-eslint/no-explicit-any -- the script and the API answers are untyped JavaScript objects */
import { describe, expect, it } from 'vitest';
import { widgetInstaller } from '@calendar/shared/widget-installer';
import { hourRange } from '@calendar/shared/week-hours';
import { fakeScriptable, runScript, WIDGET_SOURCE, type Net, type Options } from './scriptable-fake.js';

const BASE = 'https://cal.example.test';
const KEY = 'cwk_AAAAAAAA_' + 'B'.repeat(43);
const ev = (title: string, start: string, end: string, color = '#3367d6', over: object = {}) => ({
  kind: 'event', id: title, calendarId: 'c', title, allDay: false, start: `2026-10-${start.slice(0, 2)}T${start.slice(3)}:00+02:00`, end: `2026-10-${end.slice(0, 2)}T${end.slice(3)}:00+02:00`, color, ...over });
const T14 = (h: string) => `14 ${h}`; // day 14 at hh:mm
const dentist = ev('Dentist', T14('09:00'), T14('10:00'), '#d93025');
const gym = ev('Gym', T14('18:00'), T14('19:00'), '#188038');
const allDay = (title: string, date: string) => ({ ...ev(title, T14('00:00'), T14('00:00')), allDay: true, start: date, end: date.replace(/\d\d$/, (d) => String(Number(d) + 1)) });
const at = (h: string, day = '14') => Date.parse(`2026-10-${day}T${h}:00+02:00`);

const SCRIPT_2 = '// calendar-widget version=2\nconst x = 1;\n// calendar-widget end\n';
const answer = (items: unknown[], over: object = {}) => ({
  generatedAt: '2026-10-14T08:00:00+02:00', today: '2026-10-14', scriptVersion: 1, items, minEventMinutes: 0, weekSideBySide: false, taskCategories: false, ...over });
const ok = (body: unknown): { status: number; body: string } => ({ status: 200, body: JSON.stringify(body) });
const serve = (items: unknown[], over: object = {}): Net => (url) => (url.includes('/api/widget/data') ? ok(answer(items, over)) : { status: 200, body: SCRIPT_2 });

/** Runs the widget once at `nowMs` and returns what it drew. */
async function draw(items: unknown[], family: string, now: number, o: Options = {}, over: object = {}) {
  const f = fakeScriptable({ keychain: { 'calendar-widget-key': KEY, 'calendar-widget-url': BASE }, net: serve(items, over), widgetFamily: family, ...o });
  const { exports: api } = await runScript(WIDGET_SOURCE, f, { CALENDAR_WIDGET_TEST: true });
  api.now = () => now;
  await api.run();
  return { f, api, said: f.texts.map((t) => t.text), widget: f.widget.set };
}

describe('the widget script: Day view', () => {
  it('the small widget shows today in one compact header and rows in calendar colours', async () => {
    const d = await draw([dentist], 'small', at('08:00'));
    expect(d.said).toEqual(['WED 14', '09:00', 'Dentist']);
    expect(d.f.widget.completed).toBe(true);
  });

  it('the medium widget shows today and tomorrow as two identical columns, with no time strip', async () => {
    const tomorrow = ev('Gym', '15 18:00', '15 19:00');
    const d = await draw([dentist, tomorrow], 'medium', at('08:00'));
    expect(d.said).toEqual(['TODAY · WED 14', '09:00', 'Dentist', 'TOMORROW · THU 15', '18:00', 'Gym']);
    expect(d.f.texts.filter((t) => t.text === '09:00' || t.text === '18:00').every((t) => t.bold)).toBe(true);
    expect(d.f.texts.some((t) => t.where === 'canvas')).toBe(false);
  });

  it('puts all-day entries of a medium column in a band and says how many more rows do not fit', async () => {
    const many = [10, 11, 12, 13, 14].map((h) => ev(`More ${h}`, T14(`${h}:00`), T14(`${h}:30`)));
    const d = await draw([allDay('Holiday', '2026-10-14'), dentist, ...many], 'medium', at('08:00'));
    expect(d.said).toEqual(expect.arrayContaining(['Holiday', 'Dentist', 'More 10', 'More 11', '+3 more']));
    expect(d.said).not.toContain('More 12');
  });

  it('says how many more entries do not fit', async () => {
    const more = [10, 11, 12, 13, 14, 15, 16, 17].map((h) => ev(`More ${h}`, T14(`${h}:00`), T14(`${h}:30`)));
    const d = await draw([dentist, ...more], 'small', at('08:00'));
    expect(d.said).toEqual(expect.arrayContaining(['Dentist', 'More 10', 'More 14', '+3 more']));
    expect(d.said).not.toContain('More 15');
  });

  it('leaves entries that are over out and keeps their calendar colour on the rest', async () => {
    const d = await draw([dentist, gym], 'small', at('11:00'));
    expect(d.said).toEqual(['WED 14', '18:00', 'Gym']);
  });

  it('says nothing is planned on an empty day', async () => {
    expect((await draw([], 'small', at('08:00'))).said).toEqual(['WED 14', 'Nothing planned']);
  });

  it('follows the iPhone language', async () => {
    const d = await draw([dentist, ev('Gym', '15 18:00', '15 19:00')], 'medium', at('08:00'), { language: 'de' });
    expect(d.said).toEqual(expect.arrayContaining(['HEUTE · MI 14', 'MORGEN · DO 15']));
  });
});

describe('the widget script: German', () => {
  const de = (o: Options = {}, over: object = {}) => ({ o: { language: 'en', ...o }, over: { language: 'de', ...over } });

  it('draws its texts in German when the app language is German, whatever the iPhone speaks', async () => {
    const tomorrow = ev('Gym', '15 18:00', '15 19:00');
    const { o, over } = de();
    const medium = await draw([dentist, tomorrow, allDay('Feiertag', '2026-10-14')], 'medium', at('08:00'), o, over);
    expect(medium.said).toEqual(expect.arrayContaining(['HEUTE · MI 14', 'MORGEN · DO 15', '09:00', '18:00']));
    const small = await draw([dentist, ...[10, 11, 12, 13, 14, 15, 16].map((h) => ev(`M${h}`, T14(`${h}:00`), T14(`${h}:30`)))], 'small', at('08:00'), o, over);
    expect(small.said).toContain('+2 weitere');
    expect((await draw([dentist, gym], 'accessoryRectangular', at('09:20'), o, over)).said).toEqual(['Dentist · bis 10:00', 'Danach: Gym 18:00']);
    expect((await draw([], 'small', at('08:00'), o, over)).said).toEqual(['MI 14', 'Nichts geplant']);
  });

  it('follows the iPhone when the app language is auto, and reads the fun German variants as German', async () => {
    expect((await draw([dentist], 'small', at('08:00'), { language: 'de-DE' }, { language: 'auto' })).said[0]).toBe('MI 14');
    expect((await draw([dentist], 'small', at('08:00'), { language: 'en-GB' }, { language: 'auto' })).said[0]).toBe('WED 14');
    expect((await draw([dentist], 'small', at('08:00'), { language: 'en' }, { language: 'de-x-mainfr' })).said[0]).toBe('MI 14');
    expect((await draw([dentist], 'small', at('08:00'), { language: 'fr' }, { language: 'auto' })).said[0]).toBe('WED 14');
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

describe('the widget script: Week view', () => {
  const grid = (items: unknown[], now = '08:00') => {
    const f = fakeScriptable();
    return runScript(WIDGET_SOURCE, f, { CALENDAR_WIDGET_TEST: true }).then(({ exports: api }) => {
      const entries = (items as any[]).map(api.entryOf);
      const nowMin = Number(now.slice(0, 2)) * 60 + Number(now.slice(3));
      return api.weekGrid(entries, '2026-10-14', nowMin, 0, 338, 354);
    });
  };

  it('the week grid places an entry by its start and as tall as it lasts, in the week of the Monday', async () => {
    const d = await draw([dentist, gym, allDay('Holiday', '2026-10-14')], 'large', at('08:00'));
    const g = await grid([dentist, gym, allDay('Holiday', '2026-10-14')]);
    expect([g.first, g.last]).toEqual([9, 19]);
    const col = g.cols[2];
    expect(col.date).toBe('2026-10-14');
    const dent = col.blocks.find((b: any) => b.e.title === 'Dentist');
    expect(dent.y).toBeCloseTo(g.yOf(9 * 60));
    expect(dent.h).toBeCloseTo(g.hourH - 1);
    expect(col.blocks.find((b: any) => b.e.title === 'Gym').y).toBeCloseTo(g.yOf(18 * 60));
    expect(g.cols.map((c: any) => c.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    const canvas = d.f.texts.filter((t) => t.where === 'canvas').map((t) => t.text);
    expect(canvas).toEqual(expect.arrayContaining(['M 12', 'W 14', 'S 18', '09:00 Dentist', '18:00 Gym', 'Holiday', '09', '18']));
    const holiday = d.f.texts.find((t) => t.text === 'Holiday')!;
    expect(holiday.rect!.y).toBeLessThan(g.top);
    expect(d.f.requests[0]!.url).toContain('from=2026-10-12&to=2026-10-21');
  });

  it('the week grid draws the red now-line in today\'s column only', async () => {
    const d = await draw([ev('Dentist', T14('09:00'), T14('10:00'))], 'large', at('09:20'));
    const g = await grid([ev('Dentist', T14('09:00'), T14('10:00'))], '09:20');
    const lines = d.f.rects.filter((r) => r.color === '#d93025');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.x).toBeCloseTo(g.cols[2].x);
    expect(lines[0]!.y + 0.75).toBeCloseTo(g.yOf(9 * 60 + 20));
    expect(lines[0]!.w).toBeCloseTo(g.colW);
  });

  it('the week hours follow the Android rule and show every timed entry', async () => {
    const early = ev('Early', T14('06:00'), T14('07:00'));
    const late = ev('Late', T14('19:00'), T14('20:00'));
    const g = await grid([early, late]);
    expect([g.first, g.last]).toEqual([6, 20]);
    expect(g.cols[2].blocks.map((b: any) => b.e.title)).toEqual(['Early', 'Late']);
    const d = await draw([early, late], 'large', at('08:00'));
    expect(d.f.texts.filter((t) => t.where === 'canvas').map((t) => t.text)).toEqual(expect.arrayContaining(['06:00 Early', '19:00 Late']));
  });

  it('lays overlapping entries side by side and a short one as tall as the minimum length', async () => {
    const a = ev('A', T14('09:00'), T14('10:00'));
    const b = ev('B', T14('09:30'), T14('10:30'));
    const g = await grid([a, b]);
    const [x, y] = g.cols[2].blocks;
    expect(x.w).toBeCloseTo(y.w);
    expect(x.x).not.toBeCloseTo(y.x);
    const f = fakeScriptable();
    const { exports: api } = await runScript(WIDGET_SOURCE, f, { CALENDAR_WIDGET_TEST: true });
    const short = api.weekGrid([api.entryOf(ev('Short', T14('09:00'), T14('09:05')))], '2026-10-14', 0, 30, 338, 354);
    expect(short.cols[2].blocks[0].h).toBeCloseTo(short.hourH * 0.5 - 1);
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
    expect(d.said).toEqual(expect.arrayContaining(['Dentist', 'Data from 06:00']));
  });

  it('says nothing about its age when the answer is fresh or younger than two hours', async () => {
    expect((await draw([dentist], 'medium', at('08:00'))).said.join(' ')).not.toContain('Data from');
    const d = await draw([], 'medium', at('07:00'), { net: undefined, files: cacheOf([dentist], at('06:00')) });
    expect(d.said).toContain('Dentist');
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

  it('opens the app at the day view of today when tapped', async () => {
    const d = await draw([dentist], 'medium', at('09:20'));
    expect(d.widget.url).toBe(`${BASE}/day/2026-10-14`);
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
    const canvas = large.f.texts.filter((t) => t.where === 'canvas').map((t) => t.text);
    expect(canvas).toEqual(expect.arrayContaining(['09:30 Standup', '09:00 Dentist', '15:00 Retro']));
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
    const d = await draw([dentist], 'small', at('08:00'), {}, { scriptVersion: 2 });
    expect(d.f.files.get('/docs/Calendar.js')).toMatch(/^\/\/ calendar-widget version=2\n/);
    expect(d.said).toContain('Dentist');
  });

  it('keeps the old script when the download breaks off', async () => {
    const net: Net = (url) => { if (url.includes('/script')) throw new Error('broke off'); return ok(answer([dentist], { scriptVersion: 2 })); };
    const d = await draw([dentist], 'small', at('08:00'), { net });
    expect(d.f.files.has('/docs/Calendar.js')).toBe(false);
    expect(d.said).toContain('Dentist');
  });

  it('does not save a truncated download that lacks the end marker', async () => {
    const net: Net = (url) => (url.includes('/script') ? { status: 200, body: '// calendar-widget version=2\nconst x = 1;\n' } : ok(answer([dentist], { scriptVersion: 2 })));
    const d = await draw([dentist], 'small', at('08:00'), { net });
    expect(d.f.files.has('/docs/Calendar.js')).toBe(false);
  });

  it('does not save a download whose first line is not a newer version', async () => {
    const net: Net = (url) => (url.includes('/script') ? { status: 200, body: '<html>captive portal</html>' } : ok(answer([dentist], { scriptVersion: 2 })));
    const d = await draw([dentist], 'small', at('08:00'), { net });
    expect(d.f.files.has('/docs/Calendar.js')).toBe(false);
  });

  it('ends with the marker line the updater checks', () => {
    expect(WIDGET_SOURCE.trimEnd().split('\n').at(-1)).toBe('// calendar-widget end');
  });

  it('has the version its first line names', () => {
    expect(WIDGET_SOURCE.split('\n')[0]).toBe('// calendar-widget version=1');
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
