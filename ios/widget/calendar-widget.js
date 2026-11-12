// calendar-widget version=2
// Calendar widget for the Scriptable app (iPhone). It holds no key and no person: the installer put both in the Keychain.
// Small = today, medium = today and tomorrow (the same rows), large = the week as a time grid (or, as chosen in Settings, medium and large show the Timeline: 1 to 7 days from today as columns); the lock screen shows the next entry (the circle: start time or countdown, as chosen in Settings). No clock of its own.
const VERSION = 2;
const KEY_ID = 'calendar-widget-key';
const URL_ID = 'calendar-widget-url';
const CACHE_FILE = 'calendar-widget-data.json';
const STALE_AFTER_MS = 2 * 3600e3;
const MAX_AHEAD_MS = 3600e3;
const GREY = '#8a8a8a';
const SIZES = { small: [158, 158], medium: [338, 158], large: [338, 354] };

const TEXTS = {
  en: {
    today: 'TODAY', tomorrow: 'TOMORROW', allDay: 'all day', more: (n) => `+${n} more`, after: 'After', nothing: 'Nothing planned',
    until: 'until', now: 'now', inWord: 'in',
    from: (t) => `Data from ${t}`, noData: 'No data yet. The widget loads it as soon as your iPhone is online.',
    revoked: 'This widget was removed in the app. Add it again in Settings.', invalid: 'This widget is not valid. Add it again in Settings.',
    setup: 'Not set up yet. Run the installer in Scriptable first.',
  },
  de: {
    today: 'HEUTE', tomorrow: 'MORGEN', allDay: 'ganztägig', more: (n) => `+${n} weitere`, after: 'Danach', nothing: 'Nichts geplant',
    until: 'bis', now: 'jetzt', inWord: 'in',
    from: (t) => `Stand ${t}`, noData: 'Noch keine Daten. Das Widget lädt sie, sobald dein iPhone eine Internetverbindung hat.',
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

/** The next entry that has not started yet and the one running now, over the whole loaded range. */
function nowAndNext(entries, nowMs) {
  const timed = entries.filter((e) => !e.allDay).sort(byStart);
  return { now: timed.find((e) => e.startMs <= nowMs && e.endMs > nowMs) || null, next: timed.find((e) => e.startMs > nowMs) || null };
}

/** When iOS is asked to redraw: the next start or end of an entry or midnight, at most an hour ahead. */
function nextRedraw(entries, nowMs, offsetMin, circle) {
  const day = localNow(nowMs, offsetMin).date;
  const midnight = Date.parse(`${addDays(day, 1)}T00:00:00Z`) - offsetMin * 60000;
  const changes = entries.flatMap((e) => [e.startMs, e.endMs]).filter((ms) => ms !== null && ms > nowMs);
  const next = circle === 'countdown' ? nowAndNext(entries, nowMs).next : null;
  return Math.min(nowMs + MAX_AHEAD_MS, midnight, ...changes, ...(next ? [circleRedraw(next, nowMs)] : []));
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

const dayName = (date, lang) => `${weekdayName(date, lang, 'short').replace(/\.$/, '').toUpperCase()} ${Number(date.slice(8))}`;

/** One day: a compact bold header, the all-day band, one coloured row per entry ("<start> <title>") and "+N more". */
function dayColumn(parent, header, headerColor, entries, T, dim, maxRows) {
  const col = parent.addStack();
  col.layoutVertically();
  col.spacing = 2;
  addLine(col, header, 12, { bold: true, color: headerColor });
  const bands = entries.filter((e) => e.allDay);
  const timed = entries.filter((e) => !e.allDay);
  const band = bands.length ? col.addStack() : null;
  if (band) {
    band.layoutVertically();
    band.setPadding(1, 4, 1, 4);
    band.cornerRadius = 4;
    band.backgroundColor = dyn('#e8e8ee', '#2c2c32');
    bands.slice(0, 1).forEach((e) => addLine(band, e.title, 10));
  }
  if (!entries.length) addLine(col, T.nothing, 10);
  const room = maxRows - (band ? 1 : 0);
  timed.slice(0, room).forEach((e) => {
    const row = col.addStack();
    row.layoutHorizontally();
    row.setPadding(2, 4, 2, 4);
    row.cornerRadius = 4;
    const color = dim ? GREY : e.color;
    row.backgroundColor = new Color(color);
    const ink = new Color(dim ? '#ffffff' : textColor(color));
    addLine(row, e.startTime, 10, { bold: true, color: ink });
    row.addSpacer(4);
    addLine(row, e.title, 10, { color: ink });
  });
  const more = timed.length - room + Math.max(0, bands.length - 1);
  if (more > 0) addLine(col, T.more(more), 10);
  return col;
}

/** What is still to come today: entries that have not ended and the all-day ones. */
const remainingToday = (entries, today, nowMs) => entriesOn(entries, today).filter((e) => e.allDay || e.endMs > nowMs);

const red = () => dyn('#b3261e', '#f2b8b5');

/** The small widget: today only, in the same rows as the medium columns. */
function smallWidget(entries, nowMs, today, lang, T, dim) {
  const w = new ListWidget();
  w.setPadding(10, 10, 10, 10);
  dayColumn(w, dayName(today, lang), red(), remainingToday(entries, today, nowMs), T, dim, 6);
  return w;
}

/** The medium widget: today and tomorrow as two identical columns with a thin divider. */
function mediumWidget(entries, nowMs, today, lang, T, dim) {
  const w = new ListWidget();
  w.setPadding(10, 10, 10, 10);
  const body = w.addStack();
  body.layoutHorizontally();
  const tomorrow = addDays(today, 1);
  dayColumn(body, `${T.today} · ${dayName(today, lang)}`, red(), remainingToday(entries, today, nowMs), T, dim, 4);
  body.addSpacer(8);
  const rule = body.addStack();
  rule.size = new Size(1, 0);
  rule.backgroundColor = dyn('#d8d8de', '#3a3a40');
  body.addSpacer(8);
  dayColumn(body, `${T.tomorrow} · ${dayName(tomorrow, lang)}`, new Color(GREY), entriesOn(entries, tomorrow), T, dim, 4);
  return w;
}

const WEEK = { gutter: 20, head: 16, chip: 11, maxChips: 2 };

/** One entry's part on one day, in minutes since that day's midnight (a shorter entry counts as `minLen` long). */
function segmentOn(e, date, minLen) {
  const s = e.startDate === date ? Number(e.startTime.slice(0, 2)) * 60 + Number(e.startTime.slice(3)) : 0;
  const end = e.endDate === date ? Number(e.endTime.slice(0, 2)) * 60 + Number(e.endTime.slice(3)) : 1440;
  return { e, start: s, end: Math.min(1440, Math.max(end, s + Math.max(minLen || 0, 1))) };
}

// @inline hourRange

/** Side-by-side lanes for the overlapping blocks of one day. */
function lanes(day) {
  const sorted = [...day].sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster = [];
  let clusterEnd = 0;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((g) => g.lane + 1));
    cluster.forEach((g) => { g.lanes = n; });
    cluster = [];
  };
  for (const g of sorted) {
    if (cluster.length && g.start >= clusterEnd) flush();
    const taken = cluster.filter((x) => x.end > g.start).map((x) => x.lane);
    g.lane = 0;
    while (taken.includes(g.lane)) g.lane++;
    cluster.push(g);
    clusterEnd = Math.max(clusterEnd, g.end);
  }
  flush();
  return sorted;
}

/**
 * Days as a time grid (like the Android week widget): one column per day from `from`, an all-day band, an hour scale and a
 * block per timed entry placed by its start and as tall as it lasts. The hours fit the entries of these days only (a widget
 * cannot scroll). Pure geometry in points; drawing follows it.
 */
function dayGrid(entries, today, from, count, nowMin, minLen, W, H) {
  const colW = (W - WEEK.gutter) / count;
  const days = Array.from({ length: count }, (_, i) => addDays(from, i));
  const segs = days.map((date) => entriesOn(entries, date).filter((e) => !e.allDay).map((e) => segmentOn(e, date, minLen)));
  const [first, last] = hourRange(segs.flat());
  const chips = days.map((date) => entriesOn(entries, date).filter((e) => e.allDay));
  const rows = Math.min(WEEK.maxChips, Math.max(0, ...chips.map((c) => c.length)));
  const top = WEEK.head + 2 + rows * WEEK.chip + (rows ? 2 : 0);
  const hourH = (H - 2 - top) / (last - first);
  const yOf = (min) => top + ((min - first * 60) / 60) * hourH;
  const cols = days.map((date, i) => {
    const x = WEEK.gutter + i * colW;
    const blocks = [];
    for (const g of lanes(segs[i])) {
      const s = g.start;
      const en = g.end;
      const w = (colW - 2) / g.lanes;
      blocks.push({ e: g.e, label: `${g.e.startDate === date ? g.e.startTime : ''} ${g.e.title}`.trim(), x: x + 1 + g.lane * w, y: yOf(s), w: w - 1, h: Math.max(8, yOf(en) - yOf(s) - 1) });
    }
    const shown = chips[i].slice(0, WEEK.maxChips);
    return { date, x, today: date === today, blocks, chips: shown, moreChips: chips[i].length - shown.length };
  });
  const nowLine = nowMin >= first * 60 && nowMin <= last * 60 ? { y: yOf(nowMin), col: cols.findIndex((c) => c.today) } : null;
  return { first, last, hourH, top, colW, cols, nowLine, yOf };
}

/** The week of today's Monday, seven columns. */
const weekGrid = (entries, today, nowMin, minLen, W, H) => dayGrid(entries, today, weekStart(today), 7, nowMin, minLen, W, H);

/** The Timeline: `days` (1 to 7, else 3) columns from today. */
const timelineGrid = (entries, today, nowMin, minLen, W, H, days) => dayGrid(entries, today, today, timelineDays(days), nowMin, minLen, W, H);

const timelineDays = (n) => (Number.isInteger(n) && n >= 1 && n <= 7 ? n : 3);

/** Draws the text `s` into a rectangle with the font and colour given. */
function drawText(ctx, s, rect, size, bold, color) {
  ctx.setFont(bold ? Font.boldSystemFont(size) : Font.systemFont(size));
  ctx.setTextColor(color);
  ctx.drawTextInRect(s, new Rect(...rect));
}

/** The hour scale with its faint hour lines. */
function drawHours(ctx, g, W) {
  const faint = dyn('#d8d8de', '#3a3a40');
  const step = g.hourH < 18 ? 2 : 1;
  for (let h = g.first; h < g.last; h++) {
    const y = g.yOf(h * 60);
    ctx.setFillColor(faint);
    ctx.fillRect(new Rect(WEEK.gutter, y, W - WEEK.gutter, 0.5));
    if ((h - g.first) % step === 0) drawText(ctx, pad2(h), [0, y - 1, WEEK.gutter - 3, 10], 8, false, new Color(GREY));
  }
}

/** One day column: its header, all-day chips and blocks. */
function drawColumn(ctx, g, c, lang, T, dim) {
  const ink = dyn('#1b1b1f', '#f2f0f4');
  if (c.today) {
    ctx.setFillColor(new Color('#b3261e'));
    ctx.fillRect(new Rect(c.x + 1, 0, g.colW - 2, WEEK.head));
  }
  const head = g.colW >= 56 ? dayName(c.date, lang) : `${weekdayName(c.date, lang, 'narrow')} ${Number(c.date.slice(8))}`;
  drawText(ctx, head, [c.x + 2, 2, g.colW - 4, WEEK.head - 2], 10, true, c.today ? new Color('#ffffff') : ink);
  const paint = (e, rect, label, size) => {
    const color = dim ? GREY : e.color;
    ctx.setFillColor(new Color(color));
    ctx.fillRect(new Rect(...rect));
    drawText(ctx, label, [rect[0] + 1, rect[1], rect[2] - 2, rect[3]], size, false, new Color(dim ? '#ffffff' : textColor(color)));
  };
  c.chips.forEach((e, k) => paint(e, [c.x + 1, WEEK.head + 2 + k * WEEK.chip, g.colW - 2, WEEK.chip - 1], e.title, 8));
  if (c.moreChips > 0) drawText(ctx, T.more(c.moreChips), [c.x + 2, WEEK.head + 2 + WEEK.maxChips * WEEK.chip - 1, g.colW - 4, 9], 7, false, ink);
  c.blocks.forEach((b) => paint(b.e, [b.x, b.y, b.w, b.h], b.label, 8));
}

/** The grid as one picture in a widget of `size`: the week, or the Timeline when `days` is given. */
function gridWidget(size, entries, today, nowMin, minLen, lang, T, dim, days) {
  const [W, H] = SIZES[size];
  const g = days ? timelineGrid(entries, today, nowMin, minLen, W, H, days) : weekGrid(entries, today, nowMin, minLen, W, H);
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  drawHours(ctx, g, W);
  g.cols.forEach((c) => drawColumn(ctx, g, c, lang, T, dim));
  if (g.nowLine && g.nowLine.col >= 0) {
    ctx.setFillColor(new Color('#d93025'));
    ctx.fillRect(new Rect(g.cols[g.nowLine.col].x, g.nowLine.y - 0.75, g.colW, 1.5));
  }
  const w = new ListWidget();
  w.setPadding(6, 6, 4, 6);
  const img = w.addImage(ctx.getImage());
  img.imageSize = new Size(W - 12, H - 10);
  return w;
}

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * The circle: the next start time, or with the "countdown" setting a live countdown (WidgetDate's relative style, which
 * iOS keeps updating; not confirmed for lock screens in the docs), "now" in the last minute, the start time beyond an hour.
 */
function addCircle(w, mode, next, nowMs, T) {
  if (!next) return addLine(w, '–', 15, { bold: true });
  const left = next.startMs - nowMs;
  if (mode !== 'countdown' || left > 3600e3) return addLine(w, next.startTime, 15, { bold: true });
  if (left <= 60000) return addLine(w, T.now, 14, { bold: true });
  addLine(w, T.inWord, 10);
  const d = w.addDate(new Date(next.startMs));
  d.applyRelativeStyle();
  d.font = Font.boldSystemFont(13);
  d.minimumScaleFactor = 0.6;
  d.lineLimit = 1;
  return d;
}

/** When the circle's drawing changes: the countdown starts an hour ahead and ends a minute before and after the start. */
function circleRedraw(next, nowMs) {
  const left = next.startMs - nowMs;
  return left <= 60000 ? next.startMs + 60000 : left <= 3600e3 ? next.startMs - 60000 : next.startMs - 3600e3;
}

/** Inline, circular and rectangular lock-screen widgets: the next entry, never a clock or a date line. */
function lockWidget(family, entries, nowMs, T, circle) {
  const w = new ListWidget();
  const { now, next } = nowAndNext(entries, nowMs);
  if (family === 'accessoryInline') {
    w.addText(next ? `${next.title} · ${next.startTime}` : T.nothing);
  } else if (family === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    addCircle(w, circle, next, nowMs, T);
  } else {
    // the first line is the running entry or else the next one; the second is the one after it
    const upcoming = entries.filter((e) => !e.allDay && e.startMs > nowMs).sort(byStart);
    const first = now ? null : upcoming[0];
    const after = now ? upcoming[0] : upcoming[1];
    if (now) addLine(w, `${now.title} · ${T.until} ${now.endTime}`, 13, { bold: true });
    else if (first) addLine(w, `${first.title} · ${first.startTime}`, 13, { bold: true });
    else addLine(w, T.nothing, 13, { bold: true });
    if (after) addLine(w, `${T.after}: ${after.title} ${after.startTime}`, 12);
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
  } catch {
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
  } catch {
    return null;
  }
}

function dropCache() {
  const { fm, path } = cacheFile();
  try { if (fm.fileExists(path)) fm.remove(path); } catch { /* nothing more to forget */ }
}

function writeCache(saved) {
  const { fm, path } = cacheFile();
  try { fm.writeString(path, JSON.stringify(saved)); } catch { /* the next draw simply asks again */ }
}

async function get(base, key, path) {
  const r = new Request(base + path);
  r.headers = { Authorization: `Bearer ${key}` };
  r.timeoutInterval = 20;
  let text;
  try { text = await r.loadString(); } catch { return { status: 0, text: '' }; }
  return { status: r.response ? r.response.statusCode : 0, text };
}

/** Asks for the data: `{ data }`, or `{ fail }` = revoked, invalid or offline (also for a busy or silent server). */
async function fetchData(base, key, from, to) {
  const r = await get(base, key, `/api/widget/data?from=${from}&to=${to}`);
  if (r.status === 200) {
    try { return { data: JSON.parse(r.text) }; } catch { return { fail: 'offline' }; }
  }
  if (r.status === 401) {
    let code = '';
    try { code = JSON.parse(r.text).error.code; } catch { /* an unreadable refusal counts as invalid */ }
    return { fail: code === 'WIDGET_KEY_REVOKED' ? 'revoked' : 'invalid' };
  }
  return { fail: 'offline' };
}

/** Whether a downloaded script is whole: its first line names a version and its last line is the end marker. */
function wholeScript(text) {
  return /^\/\/ calendar-widget version=\d+/.test(text) && /\n\/\/ calendar-widget end\s*$/.test(text);
}

/** Saves a newer script over this one, only after it is whole and newer; a failure keeps the old one. */
async function updateScript(base, key, offered) {
  if (!(offered > VERSION)) return false;
  try {
    const r = await get(base, key, '/api/widget/script');
    const n = Number((/^\/\/ calendar-widget version=(\d+)/.exec(r.text) || [])[1]);
    if (r.status !== 200 || !wholeScript(r.text) || !(n > VERSION)) return false;
    const fm = docsFileManager();
    fm.writeString(fm.joinPath(fm.documentsDirectory(), `${Script.name()}.js`), r.text);
    return true;
  } catch {
    return false;
  }
}

/** One range for every size, so any size can draw offline from the one cache: the week and yesterday to a week ahead. */
function rangeFor(deviceDate) {
  const monday = weekStart(deviceDate);
  const from = [monday, addDays(deviceDate, -1)].sort()[0];
  const to = [addDays(monday, 7), addDays(deviceDate, 7)].sort().pop();
  return [from, to];
}

/** German or English: the app's language setting, else the iPhone's; the fun German variants read as German. */
function pickLanguage(setting) {
  for (const code of [setting, Device.language()]) {
    const c = String(code || '').toLowerCase();
    if (c.startsWith('de')) return 'de';
    if (c.startsWith('en')) return 'en';
  }
  return 'en';
}

/** The home-screen widget of a size: small = today; medium and large = the Timeline when chosen, else two columns and the week. */
function homeWidget(family, { entries, today, nowMs, offset, data }, lang, T) {
  const big = family === 'large' || family === 'extraLarge';
  const nowMin = localNow(nowMs, offset).minutes;
  if (data.widgetLayout === 'timeline' && (big || family === 'medium')) return gridWidget(big ? 'large' : 'medium', entries, today, nowMin, data.minEventMinutes, lang, T, false, timelineDays(data.widgetTimelineDays));
  if (big) return gridWidget('large', entries, today, nowMin, data.minEventMinutes, lang, T, false);
  return family === 'medium' ? mediumWidget(entries, nowMs, today, lang, T, false) : smallWidget(entries, nowMs, today, lang, T, false);
}

/** Builds the widget for a size from one answer; `note` is the stale or refusal text, `dim` greys the picture. */
function buildWidget(family, data, nowMs, lang, T) {
  const offset = offsetMinutesOf(data.generatedAt);
  const today = localNow(nowMs, offset).date;
  const entries = data.items.map(entryOf).filter(Boolean);
  const w = family.startsWith('accessory') ? lockWidget(family, entries, nowMs, T, data.widgetCircle) : homeWidget(family, { entries, today, nowMs, offset, data }, lang, T);
  w.refreshAfterDate = new Date(nextRedraw(entries, nowMs, offset, family === 'accessoryCircular' ? data.widgetCircle : null));
  return { w, today, entries, offset, data };
}

async function run() {
  const T0 = TEXTS[pickLanguage()];
  const family = config.widgetFamily || 'medium';
  const finish = (w) => {
    if (config.runsInWidget) Script.setWidget(w);
    else if (family.startsWith('accessory')) w.presentAccessoryRectangular();
    else if (family === 'small') w.presentSmall();
    else if (family === 'large') w.presentLarge();
    else w.presentMedium();
    Script.complete();
  };
  if (!Keychain.contains(KEY_ID) || !Keychain.contains(URL_ID)) return finish(messageWidget(T0.setup));
  const base = Keychain.get(URL_ID);
  const key = Keychain.get(KEY_ID);
  const nowMs = api.now();
  const cached = readCache();
  const [from, to] = rangeFor(localNow(nowMs, cached ? offsetMinutesOf(cached.data.generatedAt) : 0).date);
  const got = await fetchData(base, key, from, to);
  if (got.data) {
    writeCache({ data: got.data, savedAt: nowMs });
    await updateScript(base, key, got.data.scriptVersion);
  }
  if (got.fail === 'revoked' || got.fail === 'invalid') {
    // a removed device keeps no calendar data: the cache goes, only the message stays
    const gone = TEXTS[pickLanguage(cached && cached.data.language)][got.fail];
    dropCache();
    return finish(messageWidget(gone));
  }
  const data = got.data || (cached && cached.data);
  if (!data) return finish(messageWidget(T0.noData));
  const lang = pickLanguage(data.language);
  const T = TEXTS[lang];
  const built = buildWidget(family, data, nowMs, lang, T);
  let w = built.w;
  if (got.fail && nowMs - cached.savedAt >= STALE_AFTER_MS) w = withNote(family, built, lang, T, T.from(data.generatedAt.slice(11, 16)));
  w.url = `${base}/day/${built.today}`;
  finish(w);
}

/** The same picture with the stale note added. */
function withNote(family, built, lang, T, note) {
  const { w } = built;
  if (family.startsWith('accessory')) return w;
  const again = homeWidget(family, { ...built, nowMs: api.now() }, lang, T);
  addLine(again, note, 10, { color: new Color(GREY), lines: 2 });
  again.refreshAfterDate = w.refreshAfterDate;
  return again;
}

const api = {
  now: () => Date.now(), VERSION, TEXTS, entryOf, nowAndNext, weekGrid, timelineGrid, hourRange, nextRedraw, localNow, weekStart, addDays, rangeFor, buildWidget, fetchData, updateScript, run,
};
module.exports = api;
if (typeof CALENDAR_WIDGET_TEST === 'undefined') await run();
// calendar-widget end

