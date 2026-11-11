import { describe, expect, it } from 'vitest';
import { widgetInstaller } from '@calendar/shared/widget-installer';
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

const answer = (items: unknown[], over: object = {}) => ({
  generatedAt: '2026-10-14T08:00:00+02:00', today: '2026-10-14', scriptVersion: 1, items, minEventMinutes: 0, weekSideBySide: false, taskCategories: false, ...over });
const ok = (body: unknown): { status: number; body: string } => ({ status: 200, body: JSON.stringify(body) });
const serve = (items: unknown[], over: object = {}): Net => (url) => (url.includes('/api/widget/data') ? ok(answer(items, over)) : { status: 200, body: '// calendar-widget version=2\nconst x = 1;\n' });

/** Runs the widget once at `nowMs` and returns what it drew. */
async function draw(items: unknown[], family: string, now: number, o: Options = {}, over: object = {}) {
  const f = fakeScriptable({ keychain: { 'calendar-widget-key': KEY, 'calendar-widget-url': BASE }, net: serve(items, over), widgetFamily: family, ...o });
  const { exports: api } = await runScript(WIDGET_SOURCE, f, { CALENDAR_WIDGET_TEST: true });
  api.now = () => now;
  await api.run();
  return { f, api, said: f.texts.map((t) => t.text), widget: f.widget.set };
}

describe('the widget script: Day view', () => {
  it('the small widget shows the Day view with the date and the next entry as a block', async () => {
    const d = await draw([dentist], 'small', at('08:00'));
    expect(d.said).toEqual(expect.arrayContaining(['14', 'Wed', 'Dentist', '09:00 – 10:00']));
    expect(d.f.widget.completed).toBe(true);
    expect(d.said.join(' ')).not.toMatch(/Tomorrow/);
  });

  it('the medium widget shows today and tomorrow, with no time strip', async () => {
    const tomorrow = ev('Gym', '15 18:00', '15 19:00');
    const d = await draw([dentist, tomorrow], 'medium', at('08:00'));
    expect(d.said).toEqual(expect.arrayContaining(['14', 'Dentist', '09:00 – 10:00', 'Tomorrow', '18:00 Gym']));
    expect(d.f.texts.some((t) => t.where === 'canvas')).toBe(false);
  });

  it('says how many more entries do not fit', async () => {
    const more = [10, 11, 12, 13, 14, 15].map((h) => ev(`More ${h}`, T14(`${h}:00`), T14(`${h}:30`)));
    const d = await draw([dentist, ...more], 'small', at('08:00'));
    expect(d.said).toEqual(expect.arrayContaining(['Dentist', 'then More 10', '+5 more']));
  });

  it('colours the next entry with its calendar colour and leaves ended entries out', async () => {
    const d = await draw([dentist, gym], 'small', at('11:00'));
    expect(d.said).toContain('Gym');
    expect(d.said).not.toContain('Dentist');
  });

  it('follows the iPhone language', async () => {
    const d = await draw([dentist, ev('Gym', '15 18:00', '15 19:00')], 'medium', at('08:00'), { language: 'de' });
    expect(d.said).toEqual(expect.arrayContaining(['Mi', 'Morgen']));
  });
});

describe('the widget script: Week view', () => {
  it('shows the week of the Monday with the start time in bold above the title and "all day"', async () => {
    const d = await draw([dentist, allDay('Holiday', '2026-10-14')], 'large', at('08:00'));
    const canvas = d.f.texts.filter((t) => t.where === 'canvas');
    expect(canvas.map((t) => t.text)).toEqual(expect.arrayContaining(['M 12', 'W 14', 'S 18', '09:00', 'Dentist', 'all day', 'Holiday']));
    expect(canvas.find((t) => t.text === '09:00')!.bold).toBe(true);
    expect(canvas.map((t) => t.text).indexOf('09:00')).toBeLessThan(canvas.map((t) => t.text).indexOf('Dentist'));
    expect(d.f.requests[0]!.url).toContain('from=2026-10-12&to=2026-10-19');
  });
});

describe('the widget script: lock screen', () => {
  it('inline says the next entry and its time', async () => {
    const d = await draw([dentist], 'accessoryInline', at('08:00'));
    expect(d.said).toEqual(['Dentist · 09:00']);
  });

  it('circular says the minutes until the next entry starts', async () => {
    const d = await draw([dentist], 'accessoryCircular', at('08:20'));
    expect(d.said).toEqual(['in 40 min']);
  });

  it('rectangular says what is going on now and what is next, with no date line', async () => {
    const d = await draw([dentist, gym], 'accessoryRectangular', at('09:20'));
    expect(d.said).toEqual(['Dentist · 40 min left', 'Next: Gym 18:00']);
    expect(d.said.join(' ')).not.toMatch(/\d{4}|Wed|\b14\b/);
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
    expect(d.said).toEqual(['No data yet. Open the widget once with a connection.']);
  });

  it('says the key was removed and still shows the last answer greyed out', async () => {
    const net: Net = () => ({ status: 401, body: JSON.stringify({ error: { code: 'WIDGET_KEY_REVOKED' } }) });
    const d = await draw([], 'medium', at('08:00'), { net, files: cacheOf([dentist], at('07:00')) });
    expect(d.said).toEqual(expect.arrayContaining(['Dentist', 'This widget was removed in the app. Add it again in Settings.']));
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

  it('does not save a download whose first line is not a newer version', async () => {
    const net: Net = (url) => (url.includes('/script') ? { status: 200, body: '<html>captive portal</html>' } : ok(answer([dentist], { scriptVersion: 2 })));
    const d = await draw([dentist], 'small', at('08:00'), { net });
    expect(d.f.files.has('/docs/Calendar.js')).toBe(false);
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
  const script = '// calendar-widget version=1\n';

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

  it('speaks German on a German iPhone', async () => {
    const f = await install({ net: () => ({ status: 200, body: script }), language: 'de' });
    expect(f.alerts[0]!.message).toBe('Installiert');
  });
});
