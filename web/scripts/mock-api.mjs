#!/usr/bin/env node
/**
 * Tiny dev/test mock of spec/API.md for the web app (no server/ needed): serves `dist/` and `/api/*` in memory.
 *   node scripts/mock-api.mjs [port=4173]   (PROVIDER=mock, frozen clock 2026-10-12T06:00Z unless CLOCK=running)
 * Used for visual checks (screenshots) and manual runs. Not a test double for unit tests (those mock fetch).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = Number(process.argv[2] ?? 4173);
const dist = path.resolve(import.meta.dirname, '../dist');
const NOW = '2026-10-12T06:00:00.000Z';
const cats = [
  { id: 'shopping', name: 'Shopping', color: '#0b8043', icon: '🛒', googleColorId: '10' },
  { id: 'todo', name: 'To-do', color: '#3f51b5', icon: '✅', googleColorId: '9' },
  { id: 'work', name: 'Work', color: '#8e24aa', icon: '💼', googleColorId: '3' },
  { id: 'home', name: 'Home', color: '#f4511e', icon: '🏠', googleColorId: '6' },
];
let settings = {
  themeMode: 'system', seedColor: '#1a73e8', defaultView: 'month', defaultEventColorId: null, animationLevel: 'full', sounds: false,
  calmMode: false, ignoreSystemMotion: false, transitionWarningMinutes: 10, streakFlame: true, garden: 'plant', scene: 'sunflowers', categories: cats,
  updated: NOW, version: 1,
};
const ev = (id, title, start, end, color = '#039be5', allDay = false) => ({
  kind: 'event', id, calendarId: 'primary', title, description: '', location: '', allDay, start, end, colorId: null, color, etag: 'e' + id, updated: NOW,
});
const tl = (id, title, date, time, items, categoryId, color) => ({
  kind: 'tasklist', id, calendarId: 'primary', title, date, time, items: items.map(([t, d], i) => ({ id: 'i' + i, title: t, done: d })),
  doneCount: items.filter((i) => i[1]).length, totalCount: items.length, estimateMinutes: null, recurrence: null, categoryId, tags: [], color,
  etag: 't' + id, updated: NOW,
});
const items = [
  ev('1', 'Team standup', '2026-10-12T09:00:00+02:00', '2026-10-12T09:30:00+02:00'),
  ev('2', 'Dentist', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00', '#e67c73'),
  ev('3', 'Design review', '2026-10-14T09:30:00+02:00', '2026-10-14T11:00:00+02:00', '#8e24aa'),
  ev('4', 'Lunch with Anna', '2026-10-14T12:00:00+02:00', '2026-10-14T13:00:00+02:00', '#33b679'),
  ev('5', 'Gym', '2026-10-15T18:00:00+02:00', '2026-10-15T19:00:00+02:00', '#f4511e'),
  ev('6', 'Berlin trip', '2026-10-16', '2026-10-19', '#3f51b5', true),
  ev('7', 'Mia birthday', '2026-10-20', '2026-10-21', '#f6bf26', true),
  ev('8', 'Planning', '2026-10-21T14:00:00+02:00', '2026-10-21T15:30:00+02:00'),
  tl('9', 'Groceries', '2026-10-14', null, [['Milk', true], ['Eggs', false], ['Bread', false]], 'shopping', '#0b8043'),
  tl('10', 'Weekend chores', '2026-10-17', '10:00', [['Laundry', false], ['Vacuum', false]], 'home', '#f4511e'),
];
const toDate = (s) => s.slice(0, 10);
function days(it) {
  if (it.kind === 'tasklist') return [it.date];
  const out = []; let d = new Date(toDate(it.start) + 'T00:00:00Z'); const end = new Date(toDate(it.end) + 'T00:00:00Z');
  do { out.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 864e5); } while (d < end);
  return out;
}
const json = (res, code, body, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(body)); };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (p.startsWith('/api/')) {
    let body = '';
    for await (const c of req) body += c;
    const data = body ? JSON.parse(body) : {};
    if (p === '/api/config') return json(res, 200, { now: NOW, clockFrozen: process.env.CLOCK !== 'running', timeZone: 'Europe/Berlin', weekStartsOn: 1, pollIntervalMs: 30000, provider: 'mock', testMode: false, publicUrl: null, version: 'mock' });
    if (p === '/api/health') return json(res, 200, { status: 'ok', provider: 'mock', providerStatus: 'ok', version: 'mock', time: NOW, testMode: false });
    if (p === '/api/settings') {
      if (req.method === 'PATCH') settings = { ...settings, ...data, version: settings.version + 1 };
      return json(res, 200, settings);
    }
    if (p === '/api/categories' && req.method === 'POST') {
      settings = { ...settings, categories: [...settings.categories, { id: Math.random().toString(36).slice(2, 10), icon: null, googleColorId: '7', ...data }], version: settings.version + 1 };
      return json(res, 201, settings);
    }
    if (p === '/api/items') {
      const from = url.searchParams.get('from'), to = url.searchParams.get('to');
      return json(res, 200, { items: items.filter((i) => days(i).some((d) => d >= from && d < to)), from, to, syncedAt: NOW });
    }
    if (p === '/api/summary') {
      const from = url.searchParams.get('from'), to = url.searchParams.get('to'); const out = {};
      for (const i of items) for (const d of days(i)) if (d >= from && d < to) {
        const s = (out[d] ??= { events: 0, tasklists: 0, openTasklists: 0, density: 0 });
        if (i.kind === 'event') s.events++; else { s.tasklists++; if (i.doneCount < i.totalCount) s.openTasklists++; }
        const n = s.events + s.tasklists; s.density = n >= 4 ? 3 : n >= 2 ? 2 : 1;
      }
      return json(res, 200, { days: out });
    }
    if (p === '/api/motivation') return json(res, 200, { streak: { current: 3, best: 5, lastCheckIn: '2026-10-12', checkedInToday: true }, plant: { growth: 90, stage: 'Small plant', stageIndex: 2, nextStageAt: 140, todayPoints: 10, lastWatered: '2026-10-12', flowers: 2, vitality: 100, mood: 'happy', message: 'Your plant is happy' } });
    if (p === '/api/calendars') return json(res, 200, { calendars: [{ id: 'primary', name: 'Personal', color: '#039be5', primary: true, writable: true }] });
    if (p === '/api/demo/reset') return json(res, 200, {});
    return json(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
  }
  let file = path.join(dist, p === '/' ? 'index.html' : p);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`mock on http://localhost:${port}`));
