// calendar-widget version=1
// Calendar widget for the Scriptable app (iPhone). It holds no key and no person: the installer put both in the Keychain.
// Small = the day, medium = today and tomorrow, large = the week; the lock screen shows the next entry. No clock of its own.
const VERSION = 1;
const KEY_ID = 'calendar-widget-key';
const URL_ID = 'calendar-widget-url';
const CACHE_FILE = 'calendar-widget-data.json';
const STALE_AFTER_MS = 2 * 3600e3;
const MAX_AHEAD_MS = 3600e3;
const GREY = '#8a8a8a';
const SIZES = { small: [158, 158], medium: [338, 158], large: [338, 354] };

const TEXTS = {
  en: {
    tomorrow: 'Tomorrow', allDay: 'all day', more: (n) => `+${n} more`, then: 'then', next: 'Next', nothing: 'Nothing planned',
    inMin: (n) => `in ${n} min`, inHours: (n) => `in ${n} h`, left: (n) => `${n} min left`,
    from: (t) => `Data from ${t}`, noData: 'No data yet. Open the widget once with a connection.',
    revoked: 'This widget was removed in the app. Add it again in Settings.', invalid: 'This widget is not valid. Add it again in Settings.',
    setup: 'Not set up yet. Run the installer in Scriptable first.',
  },
  de: {
    tomorrow: 'Morgen', allDay: 'ganztägig', more: (n) => `+${n} weitere`, then: 'danach', next: 'Als Nächstes', nothing: 'Nichts geplant',
    inMin: (n) => `in ${n} Min.`, inHours: (n) => `in ${n} Std.`, left: (n) => `noch ${n} Min.`,
    from: (t) => `Stand ${t}`, noData: 'Noch keine Daten. Öffne das Widget einmal mit Internetverbindung.',
    revoked: 'Dieses Widget wurde in der App entfernt. Füge es in den Einstellungen neu hinzu.',
    invalid: 'Dieses Widget ist ungültig. Füge es in den Einstellungen neu hinzu.',
    setup: 'Noch nicht eingerichtet. Starte zuerst den Installer in Scriptable.',
  },
};

function offsetMinutesOf(iso) {
  const m = /([+-])(\d{2}):(\d{2})$/.exec(iso || '');
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** The calendar's local date and minutes since midnight, from the device clock and the answer's UTC offset. */
function localNow(nowMs, offsetMin) {
  const d = new Date(nowMs + offsetMin * 60000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekStart(date) {
  return addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
}

/** One calendar event as the widget draws it; other kinds (task lists) are not drawn. */
function entryOf(item) {
  if (item.kind !== 'event') return null;
  const base = { title: item.title, color: item.color || GREY, allDay: item.allDay };
  if (item.allDay) return { ...base, startDate: item.start, endDate: addDays(item.end, -1), startMs: null, endMs: null };
  const startDate = item.start.slice(0, 10);
  let endDate = item.end.slice(0, 10);
  if (item.end.slice(11, 16) === '00:00' && endDate > startDate) endDate = addDays(endDate, -1);
  return { ...base, startDate, endDate, startTime: item.start.slice(11, 16), endTime: item.end.slice(11, 16), startMs: Date.parse(item.start), endMs: Date.parse(item.end) };
}

const byStart = (a, b) => (a.allDay === b.allDay ? (a.startMs ?? 0) - (b.startMs ?? 0) : a.allDay ? -1 : 1);

function entriesOn(entries, date) {
  return entries.filter((e) => e.startDate <= date && date <= e.endDate).sort(byStart);
}

/** What the start of an entry reads on `date`: its time, or "all day" for an all-day or continuing entry. */
function startLabel(e, date, T) {
  return e.allDay || e.startDate < date ? T.allDay : e.startTime;
}

function rangeLabel(e) {
  return e.allDay ? '' : `${e.startTime} – ${e.endTime}`;
}

/** The rest of today that is not over yet, timed entries first; the first one is the next entry. */
function dayModel(entries, nowMs, today) {
  const remaining = entriesOn(entries, today).filter((e) => e.allDay || e.endMs > nowMs).sort((a, b) => (a.allDay === b.allDay ? byStart(a, b) : a.allDay ? 1 : -1));
  return { today, next: remaining[0] || null, rest: remaining.slice(1), tomorrow: entriesOn(entries, addDays(today, 1)) };
}

/** How many lines of the rest of today and of tomorrow fit; `more` counts what is left out. */
function planLines(model, restMax, tomorrowMax) {
  const rest = model.rest.slice(0, restMax);
  const tomorrow = model.tomorrow.slice(0, tomorrowMax);
  return { rest, tomorrow, more: model.rest.length - rest.length + (tomorrowMax ? model.tomorrow.length - tomorrow.length : 0) };
}

/** The next entry that has not started yet and the one running now, over the whole loaded range. */
function nowAndNext(entries, nowMs) {
  const timed = entries.filter((e) => !e.allDay).sort(byStart);
  return { now: timed.find((e) => e.startMs <= nowMs && e.endMs > nowMs) || null, next: timed.find((e) => e.startMs > nowMs) || null };
}

const minutesUntil = (ms, nowMs) => Math.max(1, Math.ceil((ms - nowMs) / 60000));

/** When iOS is asked to redraw: the next start or end of an entry or midnight, at most an hour ahead. */
function nextRedraw(entries, nowMs, offsetMin) {
  const day = localNow(nowMs, offsetMin).date;
  const midnight = Date.parse(`${addDays(day, 1)}T00:00:00Z`) - offsetMin * 60000;
  const changes = entries.flatMap((e) => [e.startMs, e.endMs]).filter((ms) => ms !== null && ms > nowMs);
  return Math.min(nowMs + MAX_AHEAD_MS, midnight, ...changes);
}

function textColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6 ? '#1b1b1f' : '#ffffff';
}

const dyn = (light, dark) => Color.dynamic(new Color(light), new Color(dark));

function addLine(parent, s, size, opts = {}) {
  const t = parent.addText(s);
  t.font = opts.bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = opts.color || dyn('#1b1b1f', '#f2f0f4');
  t.lineLimit = opts.lines || 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

function weekdayName(date, lang, style) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(lang, { weekday: style, timeZone: 'UTC' });
}

function monthName(date, lang) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(lang, { month: 'long', timeZone: 'UTC' });
}

/** The big date: day number, weekday and month. */
function addDate(parent, date, lang, wide) {
  const col = parent.addStack();
  col.layoutVertically();
  addLine(col, String(Number(date.slice(8))), wide ? 40 : 30, { bold: true });
  addLine(col, weekdayName(date, lang, 'short'), 13, { bold: true, color: dyn('#b3261e', '#f2b8b5') });
  if (wide) addLine(col, monthName(date, lang), 12);
}

/** The next entry as a large block in its calendar's colour. */
function addNextBlock(parent, e, today, T, dim) {
  const block = parent.addStack();
  block.layoutVertically();
  block.setPadding(6, 8, 6, 8);
  block.cornerRadius = 10;
  const color = dim ? GREY : e.color;
  block.backgroundColor = new Color(color);
  const ink = new Color(dim ? '#ffffff' : textColor(color));
  addLine(block, e.title, 15, { bold: true, color: ink, lines: 2 });
  addLine(block, e.allDay ? T.allDay : rangeLabel(e), 12, { color: ink });
}

function addSmallLine(parent, e, date, T, dim) {
  addLine(parent, `${startLabel(e, date, T)} ${e.title}`, 11, dim ? { color: new Color(GREY) } : {});
}

function dayWidget(model, family, lang, T, dim) {
  const w = new ListWidget();
  w.setPadding(10, 10, 10, 10);
  const medium = family === 'medium';
  const lines = planLines(model, medium ? 2 : 1, medium ? 2 : 0);
  const body = medium ? w.addStack() : w;
  if (medium) body.layoutHorizontally();
  addDate(body, model.today, lang, medium);
  if (medium) body.addSpacer(10);
  const col = medium ? body.addStack() : w;
  if (medium) col.layoutVertically();
  if (model.next) addNextBlock(col, model.next, model.today, T, dim);
  else addLine(col, T.nothing, 13);
  if (!medium && lines.rest.length) addLine(col, `${T.then} ${lines.rest[0].title}`, 11);
  else lines.rest.forEach((e) => addSmallLine(col, e, model.today, T, dim));
  if (lines.tomorrow.length) {
    addLine(col, T.tomorrow, 11, { bold: true, color: dyn('#b3261e', '#f2b8b5') });
    lines.tomorrow.forEach((e) => addSmallLine(col, e, addDays(model.today, 1), T, dim));
  }
  if (lines.more) addLine(col, T.more(lines.more), 11);
  return w;
}

const WEEK_ROWS = 12;

/** The week in seven columns; each entry has its start time in bold above the title. */
function weekWidget(entries, today, lang, T, dim) {
  const [W, H] = SIZES.large;
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const colW = W / 7;
  const start = weekStart(today);
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const x = i * colW;
    ctx.setTextColor(date === today ? new Color('#b3261e') : dyn('#1b1b1f', '#f2f0f4'));
    ctx.setFont(Font.boldSystemFont(11));
    ctx.drawTextInRect(`${weekdayName(date, lang, 'narrow')} ${Number(date.slice(8))}`, new Rect(x + 2, 2, colW - 4, 16));
    const day = entriesOn(entries, date);
    let y = 22;
    for (const e of day.slice(0, WEEK_ROWS)) {
      const color = dim ? GREY : e.color;
      if (y + 34 > H) break;
      ctx.setFillColor(new Color(color));
      ctx.fillRect(new Rect(x + 1, y, colW - 2, 32));
      ctx.setTextColor(new Color(dim ? '#ffffff' : textColor(color)));
      ctx.setFont(Font.boldSystemFont(9));
      ctx.drawTextInRect(startLabel(e, date, T), new Rect(x + 3, y + 1, colW - 6, 11));
      ctx.setFont(Font.systemFont(9));
      ctx.drawTextInRect(e.title, new Rect(x + 3, y + 12, colW - 6, 20));
      y += 34;
    }
    if (day.length > WEEK_ROWS || y + 34 > H) {
      ctx.setTextColor(dyn('#1b1b1f', '#f2f0f4'));
      ctx.drawTextInRect(T.more(Math.max(1, day.length - Math.floor((H - 22) / 34))), new Rect(x + 2, H - 14, colW - 4, 12));
    }
  }
  const w = new ListWidget();
  w.setPadding(8, 6, 4, 6);
  const img = w.addImage(ctx.getImage());
  img.imageSize = new Size(W - 12, H - 12);
  return w;
}

/** Inline, circular and rectangular lock-screen widgets: the next entry, never a clock or a date line. */
function lockWidget(family, entries, nowMs, T) {
  const w = new ListWidget();
  const { now, next } = nowAndNext(entries, nowMs);
  if (family === 'accessoryInline') {
    w.addText(next ? `${next.title} · ${next.startTime}` : T.nothing);
  } else if (family === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    const mins = next ? minutesUntil(next.startMs, nowMs) : null;
    addLine(w, mins === null ? '–' : mins < 60 ? T.inMin(mins) : T.inHours(Math.round(mins / 60)), 13, { bold: true });
  } else {
    if (now) addLine(w, `${now.title} · ${T.left(minutesUntil(now.endMs, nowMs))}`, 13, { bold: true });
    if (next) addLine(w, `${T.next}: ${next.title} ${next.startTime}`, 12);
    else if (!now) addLine(w, T.nothing, 13, { bold: true });
  }
  return w;
}

function messageWidget(text) {
  const w = new ListWidget();
  addLine(w, text, 12, { lines: 6 });
  return w;
}

// ---------- data, cache, update ----------

function docsFileManager() {
  try {
    const f = FileManager.iCloud();
    f.documentsDirectory();
    return f;
  } catch (e) {
    return FileManager.local();
  }
}

function cacheFile() {
  const fm = FileManager.local();
  return { fm, path: fm.joinPath(fm.libraryDirectory(), CACHE_FILE) };
}

function readCache() {
  const { fm, path } = cacheFile();
  try {
    return fm.fileExists(path) ? JSON.parse(fm.readString(path)) : null;
  } catch (e) {
    return null;
  }
}

function writeCache(saved) {
  const { fm, path } = cacheFile();
  try { fm.writeString(path, JSON.stringify(saved)); } catch (e) { /* the next draw simply asks again */ }
}

async function get(base, key, path) {
  const r = new Request(base + path);
  r.headers = { Authorization: `Bearer ${key}` };
  r.timeoutInterval = 20;
  let text;
  try { text = await r.loadString(); } catch (e) { return { status: 0, text: '' }; }
  return { status: r.response ? r.response.statusCode : 0, text };
}

/** Asks for the data: `{ data }`, or `{ fail }` = revoked, invalid or offline (also for a busy or silent server). */
async function fetchData(base, key, from, to) {
  const r = await get(base, key, `/api/widget/data?from=${from}&to=${to}`);
  if (r.status === 200) {
    try { return { data: JSON.parse(r.text) }; } catch (e) { return { fail: 'offline' }; }
  }
  if (r.status === 401) {
    let code = '';
    try { code = JSON.parse(r.text).error.code; } catch (e) { /* an unreadable refusal counts as invalid */ }
    return { fail: code === 'WIDGET_KEY_REVOKED' ? 'revoked' : 'invalid' };
  }
  return { fail: 'offline' };
}

/** Saves a newer script over this one, only after its first line names a newer version; a failure keeps the old one. */
async function updateScript(base, key, offered) {
  if (!(offered > VERSION)) return false;
  try {
    const r = await get(base, key, '/api/widget/script');
    const n = Number((/^\/\/ calendar-widget version=(\d+)/.exec(r.text) || [])[1]);
    if (r.status !== 200 || !(n > VERSION)) return false;
    const fm = docsFileManager();
    fm.writeString(fm.joinPath(fm.documentsDirectory(), `${Script.name()}.js`), r.text);
    return true;
  } catch (e) {
    return false;
  }
}

function rangeFor(family, deviceDate) {
  return family === 'large' ? [weekStart(deviceDate), addDays(weekStart(deviceDate), 7)] : [addDays(deviceDate, -1), addDays(deviceDate, 7)];
}

function language() {
  return String(Device.language()).toLowerCase().startsWith('de') ? 'de' : 'en';
}

/** Builds the widget for a size from one answer; `note` is the stale or refusal text, `dim` greys the picture. */
function buildWidget(family, data, nowMs, lang, T) {
  const offset = offsetMinutesOf(data.generatedAt);
  const today = localNow(nowMs, offset).date;
  const entries = data.items.map(entryOf).filter(Boolean);
  let w;
  if (family.startsWith('accessory')) w = lockWidget(family, entries, nowMs, T);
  else if (family === 'large' || family === 'extraLarge') w = weekWidget(entries, today, lang, T, false);
  else w = dayWidget(dayModel(entries, nowMs, today), family === 'medium' ? 'medium' : 'small', lang, T, false);
  w.refreshAfterDate = new Date(nextRedraw(entries, nowMs, offset));
  return { w, today, entries, offset };
}

async function run() {
  const lang = language();
  const T = TEXTS[lang];
  const family = config.widgetFamily || 'medium';
  const finish = (w) => {
    if (config.runsInWidget) Script.setWidget(w);
    else if (family.startsWith('accessory')) w.presentAccessoryRectangular();
    else (family === 'small' ? w.presentSmall() : family === 'large' ? w.presentLarge() : w.presentMedium());
    Script.complete();
  };
  if (!Keychain.contains(KEY_ID) || !Keychain.contains(URL_ID)) return finish(messageWidget(T.setup));
  const base = Keychain.get(URL_ID);
  const key = Keychain.get(KEY_ID);
  const nowMs = api.now();
  const cached = readCache();
  const [from, to] = rangeFor(family, localNow(nowMs, cached ? offsetMinutesOf(cached.data.generatedAt) : 0).date);
  const got = await fetchData(base, key, from, to);
  if (got.data) {
    writeCache({ data: got.data, savedAt: nowMs });
    await updateScript(base, key, got.data.scriptVersion);
  }
  const data = got.data || (cached && cached.data);
  if (!data) return finish(messageWidget(got.fail === 'offline' ? T.noData : T[got.fail]));
  const dim = got.fail === 'revoked' || got.fail === 'invalid';
  const built = buildWidget(family, data, nowMs, lang, T);
  let w = built.w;
  if (dim || (got.fail && nowMs - cached.savedAt >= STALE_AFTER_MS)) {
    const note = dim ? T[got.fail] : T.from(data.generatedAt.slice(11, 16));
    w = withNote(family, built, lang, T, dim, note);
  }
  w.url = `${base}/day/${built.today}`;
  finish(w);
}

/** The same picture with the stale or refusal note added (greyed when the key is gone). */
function withNote(family, built, lang, T, dim, note) {
  const { w, today, entries } = built;
  if (family.startsWith('accessory')) return dim ? messageWidget(note) : w;
  const again = (family === 'large' || family === 'extraLarge') ? weekWidget(entries, today, lang, T, dim)
    : dayWidget(dayModel(entries, api.now(), today), family === 'medium' ? 'medium' : 'small', lang, T, dim);
  addLine(again, note, 10, { color: dim ? new Color('#b3261e') : new Color(GREY), lines: 2 });
  again.refreshAfterDate = w.refreshAfterDate;
  return again;
}

const api = {
  now: () => Date.now(), VERSION, TEXTS, entryOf, dayModel, planLines, nowAndNext, nextRedraw, localNow, weekStart, addDays, buildWidget, fetchData, updateScript, run,
};
module.exports = api;
if (typeof CALENDAR_WIDGET_TEST === 'undefined') await run();
