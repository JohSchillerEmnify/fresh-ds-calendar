// calendar-widget version=5
// Calendar widget for the Scriptable app (iPhone). It holds no key and no person: the installer put both in the Keychain.
// The home screen shows the Timeline in every size (small = today, medium and large = 1 to 7 days from today as columns); a tap runs this script. The lock screen shows the next entry (the circle: start time or countdown, as chosen in Settings). No clock of its own.
const VERSION = 5;
const KEY_ID = 'calendar-widget-key';
const URL_ID = 'calendar-widget-url';
const CACHE_FILE = 'calendar-widget-data.json';
const STALE_AFTER_MS = 2 * 3600e3;
const MAX_AHEAD_MS = 3600e3;
const GREY = '#8a8a8a';
const PAD = { x: 6, top: 6, bottom: 4 };
const NOTE_H = 12;
// Apple's widget sizes in points by screen size [screen w, screen h, small side, wide width, large height] (developer.apple.com/design/human-interface-guidelines/widgets); medium is wide x small side
const WIDGET_SIZES = [[430, 932, 170, 364, 382], [428, 926, 170, 364, 382], [414, 896, 169, 360, 379], [393, 852, 158, 338, 354], [390, 844, 158, 338, 354], [375, 812, 155, 329, 345], [375, 667, 148, 321, 324]];
// the app's light and dark surface and ink (web/src/theme/tokens.css), because a widget has no CSS to follow
const LIGHT = { surface: '#faf9fe', ink: '#2f323a' };
const DARK = { surface: '#0d0e12', ink: '#e3e5f0' };
const LINE = '#8e8e93';
const RED = '#d93025';

const TEXTS = {
  en: {
    more: (n) => `+${n} more`, after: 'After', nothing: 'Nothing planned',
    until: 'until', now: 'now', inWord: 'in',
    from: (t) => `Data from ${t}`, noData: 'No data yet. The widget loads it as soon as your iPhone is online.',
    revoked: 'This widget was removed in the app. Add it again in Settings.', invalid: 'This widget is not valid. Add it again in Settings.',
    setup: 'Not set up yet. Run the installer in Scriptable first.',
  },
  de: {
    more: (n) => `+${n} weitere`, after: 'Danach', nothing: 'Nichts geplant',
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
  const base = { title: item.title, color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : GREY, allDay: item.allDay };
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
  let id = 0;
  const sorted = [...day].sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster = [];
  let clusterEnd = 0;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((g) => g.lane + 1));
    cluster.forEach((g) => { g.lanes = n; });
    cluster = [];
    id++;
  };
  for (const g of sorted) {
    if (cluster.length && g.start >= clusterEnd) flush();
    const taken = cluster.filter((x) => x.end > g.start).map((x) => x.lane);
    g.lane = 0;
    g.cluster = id;
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
 * cannot scroll). Pure geometry in points; the stacks follow it.
 */
function dayGrid(entries, today, from, count, nowMin, minLen, W, H, k = 1, fixed = null) {
  const colW = (W - WEEK.gutter) / count;
  const days = Array.from({ length: count }, (_, i) => addDays(from, i));
  const all = days.map((date) => entriesOn(entries, date).filter((e) => !e.allDay).map((e) => segmentOn(e, date, minLen)));
  const [first, last] = fixed || hourRange(all.flat());
  // a fixed range keeps what overlaps it (clipped); the rest becomes an edge marker of its day
  const segs = all.map((day) => (fixed ? day.filter((g) => g.end > first * 60 && g.start < last * 60).map((g) => ({ ...g, start: Math.max(g.start, first * 60), end: Math.min(g.end, last * 60) })) : day));
  const edge = (day, date, above) => {
    const out = fixed ? day.filter((g) => (above ? g.end <= first * 60 : g.start >= last * 60)).sort((a, b) => (above ? b.end - a.end : a.start - b.start)) : [];
    if (!out.length) return null;
    const e = out[0].e;
    const more = out.length > 1 ? ` +${out.length - 1}` : '';
    return { e, label: `${above ? '\u25B4' : '\u25BE'} ${e.title}${e.startDate === date ? ` ${e.startTime}` : ''}${more}` };
  };
  const chips = days.map((date) => entriesOn(entries, date).filter((e) => e.allDay));
  const rows = Math.min(WEEK.maxChips, Math.max(0, ...chips.map((c) => c.length)));
  const head = WEEK.head * k, chip = WEEK.chip * k;
  const aboves = all.map((day, i) => edge(day, days[i], true));
  const belows = all.map((day, i) => edge(day, days[i], false));
  // a stack cannot overlap, so edge markers get their own strip above or below the hours, only when there is one
  const markH = 9 * k;
  const aboveStrip = aboves.some(Boolean) ? markH + 1 : 0;
  const belowStrip = belows.some(Boolean) ? markH + 1 : 0;
  const top = head + 2 + rows * chip + (rows ? 2 : 0) + aboveStrip;
  const hourH = (H - 2 - top - belowStrip) / (last - first);
  const yOf = (min) => top + ((min - first * 60) / 60) * hourH;
  const cols = days.map((date, i) => {
    const x = WEEK.gutter + i * colW;
    const blocks = [];
    for (const g of lanes(segs[i])) {
      const s = g.start;
      const en = g.end;
      const w = (colW - 2) / g.lanes;
      blocks.push({ e: g.e, lane: g.lane, lanes: g.lanes, cluster: g.cluster, label: `${g.e.startDate === date ? g.e.startTime : ''} ${g.e.title}`.trim(), x: x + 1 + g.lane * w, y: yOf(s), w: w - 1, h: Math.max(8, yOf(en) - yOf(s) - 1) });
    }
    // a block raised to the minimum height ends where the next one in its lane or a later cluster starts (stacks cannot overlap)
    for (const b of blocks) {
      const next = blocks.filter((o) => o !== b && o.y >= b.y && (o.cluster !== b.cluster || o.lane === b.lane) && !(o.y === b.y && o.cluster === b.cluster));
      if (next.length) b.h = Math.max(0.5, Math.min(b.h, Math.min(...next.map((o) => o.y)) - b.y));
    }
    // the last chip row says how many more there are, so the band keeps its height
    const shown = chips[i].length > WEEK.maxChips ? chips[i].slice(0, WEEK.maxChips - 1) : chips[i];
    return { date, x, today: date === today, blocks, chips: shown, moreChips: chips[i].length - shown.length, above: aboves[i], below: belows[i] };
  });
  const nowLine = nowMin >= first * 60 && nowMin <= last * 60 ? { y: yOf(nowMin), col: cols.findIndex((c) => c.today) } : null;
  return { first, last, hourH, top, colW, cols, nowLine, yOf, k, head, chip, markH };
}

/** The Timeline: `days` (1 to 7, else 3) columns from today. */
const timelineGrid = (entries, today, nowMin, minLen, W, H, days, k = 1, hours = null) => dayGrid(entries, today, today, timelineDays(days), nowMin, minLen, W, H, k, fixedHours(hours));

/** The whole hours `[first, last)` of the fixed range the data carries ({ mode: 'fixed', from, to } as HH:MM), else null (automatic). */
function fixedHours(h) {
  const ok = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if (!h || h.mode !== 'fixed' || !ok(h.from) || !ok(h.to)) return null;
  const first = Number(h.from.slice(0, 2));
  const last = Math.min(24, Number(h.to.slice(0, 2)) + (h.to.slice(3) === '00' ? 0 : 1));
  return last > first ? [first, last] : null;
}

/** The text size in percent the data carries (90 to 150 in steps of 5, else 110) as a factor. */
const textScale = (p) => (Number.isInteger(p) && p >= 90 && p <= 150 && p % 5 === 0 ? p : 110) / 100;

const timelineDays = (n) => (Number.isInteger(n) && n >= 1 && n <= 7 ? n : 3);

/** An element of a fixed size in a stack; every element of the grid has one, so stacks line up with the geometry. */
function fixedStack(parent, w, h, horizontal) {
  const s = parent.addStack();
  s.size = new Size(w, h);
  s.setPadding(0, 0, 0, 0);
  if (horizontal) s.layoutHorizontally(); else s.layoutVertically();
  return s;
}

/** Walks along a stack: `to(y)` adds the spacer up to y, `done(len)` moves past what was placed (a stack has no absolute positions). */
function flow(origin = 0) {
  let at = origin;
  return { to(parent, y) { if (y > at) parent.addSpacer(y - at); at = Math.max(at, y); }, done(len) { at += len; } };
}

/** `c` mixed into a surface by the share `a` (the app's tinted entries: 24 % of the colour), per sRGB channel; Scriptable has no colour mixing. */
function mix(hex, surface, a) {
  const part = (h, i) => parseInt(h.slice(i, i + 2), 16);
  return '#' + [1, 3, 5].map((i) => Math.round(part(hex, i) * a + part(surface, i) * (1 - a)).toString(16).padStart(2, '0')).join('');
}

const ink = () => dyn(LIGHT.ink, DARK.ink);

/** A block as the app draws a tinted entry: an opaque tint of its colour that follows light and dark, a bar in the full colour, ink text. */
function entryBlock(parent, box, color, label, size) {
  const s = fixedStack(parent, box.w, box.h, true);
  s.backgroundColor = dyn(mix(color, LIGHT.surface, 0.24), mix(color, DARK.surface, 0.24));
  s.cornerRadius = 2;
  s.topAlignContent();
  fixedStack(s, Math.min(3, box.w / 4), box.h, false).backgroundColor = new Color(color);
  s.addSpacer(2);
  if (label) {
    const t = addLine(s, label, size, { color: ink(), lines: Math.max(1, Math.floor((box.h - 1) / (size * 1.2))) });
    t.minimumScaleFactor = 0.8;
  }
  return s;
}

/** The hour numbers, each in a fixed box centred on its line. */
function hourLabels(parent, g, H) {
  const gutter = fixedStack(parent, WEEK.gutter, H, false);
  const f = flow();
  const step = g.hourH < 18 * g.k ? 2 : 1;
  const half = 5 * g.k;
  for (let h = g.first; h < g.last; h += step) {
    f.to(gutter, g.yOf(h * 60) - half);
    const slot = fixedStack(gutter, WEEK.gutter, 2 * half, true);
    addLine(slot, pad2(h), 8 * g.k, { color: new Color(GREY) });
    f.done(2 * half);
  }
}

/** The pieces of one column's blocks, cut at the now-line (a stripe is drawn between them) so the line also shows across a running entry. */
function piecesAt(blocks, nowY) {
  const half = 0.75;
  return blocks.flatMap((b) => {
    if (nowY === null || b.y + b.h <= nowY - half) return [{ ...b, section: 0 }];
    if (b.y >= nowY + half) return [{ ...b, section: 1 }];
    const top = nowY - half - b.y;
    const bottom = b.y + b.h - nowY - half;
    const out = [];
    if (top > 0.5) out.push({ ...b, h: top, label: top >= bottom ? b.label : '', section: 0 });
    if (bottom > 0.5) out.push({ ...b, y: nowY + half, h: bottom, label: top >= bottom ? '' : b.label, section: 1 });
    return out;
  });
}

/** Overlapping blocks of one cluster: lanes side by side, each lane a stack with spacers to the block's top. */
function blockGroup(col, g, group, size) {
  const y0 = Math.min(...group.map((p) => p.y));
  const y1 = Math.max(...group.map((p) => p.y + p.h));
  const row = fixedStack(col, g.colW, y1 - y0, true);
  row.addSpacer(1);
  const laneW = (g.colW - 2) / group[0].lanes;
  for (let lane = 0; lane < group[0].lanes; lane++) {
    const stack = fixedStack(row, laneW, y1 - y0, false);
    const f = flow(y0);
    for (const p of group.filter((x) => x.lane === lane).sort((a, b) => a.y - b.y)) {
      f.to(stack, p.y);
      entryBlock(stack, p, p.e.color, p.label, size);
      f.done(p.h);
    }
  }
  return { y0, y1 };
}

/** One day: its label (today a red pill), the all-day band, the blocks and an edge marker where a fixed range hides entries. */
function dayColumn(parent, g, c, o) {
  const { H, nowY, lang, T } = o;
  const col = fixedStack(parent, g.colW, H, false);
  const f = flow();
  const head = fixedStack(col, g.colW - 2, g.head, true);
  head.cornerRadius = 3;
  if (c.today) head.backgroundColor = new Color('#b3261e');
  head.addSpacer(2);
  const label = g.colW >= 56 ? dayName(c.date, lang) : `${weekdayName(c.date, lang, 'narrow')} ${Number(c.date.slice(8))}`;
  addLine(head, label, 10 * g.k, { bold: true, color: c.today ? new Color('#ffffff') : ink() });
  f.done(g.head);
  c.chips.forEach((e, i) => {
    f.to(col, g.head + 2 + i * g.chip);
    entryBlock(col, { w: g.colW - 2, h: g.chip - 1 }, e.color, e.title, 8 * g.k);
    f.done(g.chip - 1);
  });
  if (c.moreChips > 0) {
    f.to(col, g.head + 2 + c.chips.length * g.chip);
    const more = fixedStack(col, g.colW - 2, g.chip - 1, true);
    more.addSpacer(2);
    addLine(more, T.more(c.moreChips), 8 * g.k, { color: new Color(GREY) });
    f.done(g.chip - 1);
  }
  const bottom = g.yOf(g.last * 60);
  const marker = (m, y) => { f.to(col, y); entryBlock(col, { w: g.colW - 2, h: g.markH }, m.e.color, m.label, 7 * g.k); f.done(g.markH); };
  if (c.above) marker(c.above, g.top - g.markH - 1);
  const groups = new Map();
  for (const p of piecesAt(c.blocks, nowY)) {
    const key = `${p.cluster}:${p.section}`;
    groups.set(key, [...(groups.get(key) || []), p]);
  }
  let striped = nowY === null;
  const stripe = () => {
    f.to(col, nowY - 0.75);
    fixedStack(col, g.colW, 1.5, false).backgroundColor = new Color(RED);
    f.done(1.5);
    striped = true;
  };
  for (const group of [...groups.values()].sort((a, b) => a[0].y - b[0].y)) {
    if (!striped && group[0].section === 1) stripe();
    f.to(col, Math.min(...group.map((p) => p.y)));
    const { y0, y1 } = blockGroup(col, g, group, 8 * g.k);
    f.done(y1 - y0);
  }
  if (!striped) stripe();
  if (c.below) marker(c.below, bottom + 1);
  return col;
}

/** The hour lines and the now-line: the only things drawn into the picture (a DrawContext cannot hold dynamic colours and its text would not follow dark mode). */
function linesPicture(W, H, g) {
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  ctx.setFillColor(new Color(LINE, 0.4));
  for (let h = g.first; h < g.last; h++) ctx.fillRect(new Rect(PAD.x + WEEK.gutter, PAD.top + g.yOf(h * 60), g.cols.length * g.colW, 0.5));
  if (g.nowLine && g.nowLine.col >= 0) {
    ctx.setFillColor(new Color(RED));
    ctx.fillRect(new Rect(PAD.x + g.cols[g.nowLine.col].x, PAD.top + g.nowLine.y - 0.75, g.colW, 1.5));
  }
  return ctx.getImage();
}

/** The widget size in points from Apple's table, by the iPhone's screen; a screen the table lacks uses the nearest smaller one. */
function widgetSize(size) {
  const s = Device.screenSize();
  const [w, h] = [Math.min(s.width, s.height), Math.max(s.width, s.height)];
  const [, , side, wide, tall] = WIDGET_SIZES.find((r) => r[0] <= w && r[1] <= h) || WIDGET_SIZES[WIDGET_SIZES.length - 1];
  return size === 'small' ? [side, side] : size === 'medium' ? [wide, side] : [wide, tall];
}

/** The Timeline as a widget of `size`: stacks (text, tinted blocks) over a picture of the lines; small shows today only. */
function gridWidget(size, { entries, today, nowMin, lang, T, data, note }) {
  const [W, H] = widgetSize(size);
  const gh = H - PAD.top - PAD.bottom - (note ? NOTE_H : 0);
  const g = timelineGrid(entries, today, nowMin, data.minEventMinutes, W - 2 * PAD.x, gh, size === 'small' ? 1 : timelineDays(data.widgetTimelineDays), textScale(data.widgetTimelineTextSize), data.widgetTimelineHours);
  const w = new ListWidget();
  w.setPadding(0, 0, 0, 0);
  w.backgroundColor = dyn(LIGHT.surface, DARK.surface);
  const page = fixedStack(w, W, H, false);
  page.backgroundImage = linesPicture(W, H, g);
  page.addSpacer(PAD.top);
  const row = fixedStack(page, W, gh, true);
  row.addSpacer(PAD.x);
  hourLabels(row, g, gh);
  g.cols.forEach((c, i) => dayColumn(row, g, c, { H: gh, nowY: g.nowLine && g.nowLine.col === i ? g.nowLine.y : null, lang, T }));
  if (note) {
    const line = fixedStack(page, W, NOTE_H, true);
    line.addSpacer(PAD.x);
    addLine(line, note, 9, { color: new Color(GREY), lines: 1 });
  }
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

/** The home-screen widget of a size: the Timeline in every size; `note` is the stale text. */
function homeWidget(family, { entries, today, nowMs, offset, data }, lang, T, note) {
  const size = family === 'small' || family === 'medium' ? family : 'large';
  return gridWidget(size, { entries, today, nowMin: localNow(nowMs, offset).minutes, lang, T, data, note });
}

/** Builds the widget for a size from one answer; `note` (the stale text) is added to the home-screen sizes. */
function buildWidget(family, data, nowMs, lang, T, note) {
  const offset = offsetMinutesOf(data.generatedAt);
  const today = localNow(nowMs, offset).date;
  const entries = data.items.map(entryOf).filter(Boolean);
  const w = family.startsWith('accessory') ? lockWidget(family, entries, nowMs, T, data.widgetCircle) : homeWidget(family, { entries, today, nowMs, offset, data }, lang, T, note);
  w.refreshAfterDate = new Date(nextRedraw(entries, nowMs, offset, family === 'accessoryCircular' ? data.widgetCircle : null));
  return { w, today, entries, offset, data };
}

async function run() {
  const T0 = TEXTS[pickLanguage()];
  // in the app (a tap on the widget runs it there) there is no family: show the large preview
  const family = config.widgetFamily || 'large';
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
  const stale = got.fail && nowMs - cached.savedAt >= STALE_AFTER_MS;
  const built = buildWidget(family, data, nowMs, lang, T, stale ? T.from(data.generatedAt.slice(11, 16)) : null);
  const w = built.w;
  // a tap runs this script, which loads fresh data; a link would open Safari (iOS cannot open the installed web app)
  w.url = family.startsWith('accessory') ? `${base}/day/${built.today}` : `scriptable:///run/${encodeURIComponent(Script.name())}`;
  finish(w);
}

const api = {
  now: () => Date.now(), VERSION, TEXTS, entryOf, nowAndNext, timelineGrid, textScale, hourRange, nextRedraw, localNow, weekStart, addDays, rangeFor, buildWidget, fetchData, updateScript, run,
};
module.exports = api;
if (typeof CALENDAR_WIDGET_TEST === 'undefined') await run();
// calendar-widget end

