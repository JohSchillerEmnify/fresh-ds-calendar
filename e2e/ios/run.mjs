/**
 * Real iOS Safari (simulator, Appium XCUITest) against a TEST_MODE server: open a task list's "..." menu and tap Delete
 * with real touches (GitHub issue #9). Every tap records what happened (menu, element under the finger, events seen).
 *
 * Env: BASE_URL (default http://localhost:3000), APPIUM_URL (default http://127.0.0.1:4723), UDID, PLATFORM_VERSION,
 *      DEVICE_NAME, ARTIFACTS (default ./artifacts).
 * Exit 1 when a normal case fails; the "forced inside the sheet" case is informational and never fails the run.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { remote } from 'webdriverio';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const APPIUM = new URL(process.env.APPIUM_URL ?? 'http://127.0.0.1:4723');
const OUT = process.env.ARTIFACTS ?? 'artifacts';
const DAY = '2026-10-14';
mkdirSync(OUT, { recursive: true });

const api = async (method, path, body) => {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
};
const seed = async (title) => {
  await api('POST', '/api/__test/reset', { seed: false });
  await api('POST', '/api/tasklists', { title, date: DAY, items: [{ title: 'Milk', done: false }, { title: 'Bread', done: false }] });
  await api('POST', '/api/tasklists', { title: `${title} undated`, date: null, items: [{ title: 'Eggs', done: false }] });
};

// --- page side: recorder and probes ---------------------------------------------------------------------------------
/** Runs in the page: records events and console output, optionally makes the menu think the pointer is not coarse. */
function installRecorder(forceInside) {
  const describe = (n) => {
    if (!n || !n.tagName) return String(n);
    const tid = n.getAttribute?.('data-testid');
    return `${n.tagName.toLowerCase()}${tid ? `[${tid}]` : ''}${n.getAttribute?.('role') ? `(${n.getAttribute('role')})` : ''}`;
  };
  window.__describe = describe;
  window.__diag = [];
  window.__console = [];
  for (const type of ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'pointercancel', 'click']) {
    document.addEventListener(type, (e) => {
      const p = e.changedTouches?.[0] ?? e;
      window.__diag.push({ type, target: describe(e.target), x: Math.round(p.clientX), y: Math.round(p.clientY) });
    }, true);
  }
  for (const level of ['log', 'warn', 'error']) {
    const orig = console[level].bind(console);
    console[level] = (...a) => { window.__console.push(`${level}: ${a.map(String).join(' ')}`); orig(...a); };
  }
  window.addEventListener('error', (e) => window.__console.push(`uncaught: ${e.message}`));
  if (forceInside) {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/pointer:\s*coarse/.test(q) && !/hover/.test(q) ? Object.assign(mm('not all'), { media: q }) : mm(q));
  }
}

/** Runs in the page: where a CSS-pixel point lands and what is there. */
function probeAt(el, x, y) {
  const under = document.elementFromPoint(x, y);
  return { under: window.__describe(under), hitsTarget: !!under && (el === under || el.contains(under) || under.contains(el)) };
}

// --- driver helpers ------------------------------------------------------------------------------------------------
const results = [];
let browser;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  await browser.saveScreenshot(`${OUT}/${name}.png`).catch(() => {});
  // the real Safari chrome around the page, as the owner would see it
  if (process.env.UDID) try { execFileSync('xcrun', ['simctl', 'io', process.env.UDID, 'screenshot', `${OUT}/${name}-device.png`]); } catch { /* optional */ }
};
const find = (css) => browser.$(css);
const waitFor = async (css, ms = 8000) => { try { await find(css).waitForExist({ timeout: ms }); return true; } catch { return false; } };

/** Runs a native-context action and returns to the web view afterwards. */
async function inNative(fn) {
  const web = await browser.getContext();
  await browser.switchContext('NATIVE_APP');
  try { return await fn(); } finally { await browser.switchContext(web); }
}

/** A real finger tap at a native screen point (points), given in the native context. */
const nativeTap = (x, y) => inNative(() => browser.execute('mobile: tap', { x, y }));

/** The web view's frame in screen points (native context): CSS px map onto it from the page's top-left. */
const webViewFrame = () => inNative(async () => {
  // Safari keeps several web view elements around: the visible page is the biggest one
  const rects = await Promise.all((await browser.$$('-ios class chain:**/XCUIElementTypeWebView')).map((w) => w.getElementRect()));
  return rects.sort((a, b) => b.width * b.height - a.width * a.height)[0];
});

/** Safari's one-time tip bubble sits over the bottom bar and swallows taps: close it when it shows. */
async function dismissSafariTip() {
  await inNative(async () => {
    writeFileSync(`${OUT}/native-source.xml`, await browser.getPageSource());
    const tip = await browser.$('-ios predicate string:label CONTAINS "View Bookmarks" OR name CONTAINS "View Bookmarks"');
    if (!(await tip.isExisting())) { console.log('  no Safari tip bubble'); return; }
    // the tip's close button is the lower one of the "Close" buttons
    const closes = await browser.$$('-ios predicate string:type == "XCUIElementTypeButton" AND (label == "Close" OR name == "Close" OR label == "Dismiss")');
    if (closes.length) {
      const rects = await Promise.all(closes.map((c) => c.getElementRect()));
      const lowest = rects.reduce((m, r, i) => (r.y > rects[m].y ? i : m), 0);
      await closes[lowest].click(); console.log('  closed the Safari tip bubble'); return;
    }
    const { width, height } = await browser.getWindowSize();
    await browser.execute('mobile: tap', { x: Math.round(width * 0.906), y: Math.round(height * 0.71) });
    console.log('  tapped the Safari tip bubble close by position');
  });
}

/** A real touch tap on an element: one finger down and up in the middle of it. Logs the hit test of the tap point first. */
async function tap(log, label, css, { scroll = true } = {}) {
  const el = await find(css);
  await el.waitForExist({ timeout: 8000 });
  if (scroll) await browser.execute((e) => e.scrollIntoView({ block: 'center' }), el);
  const rect = await browser.execute((e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, iw: innerWidth }; }, el);
  const hit = await browser.execute(probeAt, el, rect.x, rect.y);
  await browser.execute(() => { window.__diag.length = 0; });
  // the touch goes through the native layer at screen coordinates: web view origin + CSS point (scaled by points per CSS px)
  const frame = await webViewFrame();
  const k = frame.width / rect.iw;
  const screen = { x: Math.round(frame.x + rect.x * k), y: Math.round(frame.y + rect.y * k) };
  await nativeTap(screen.x, screen.y);
  await sleep(600);
  const events = await browser.execute(() => window.__diag.splice(0));
  const entry = { step: label, css, point: { x: Math.round(rect.x), y: Math.round(rect.y) }, screen, webView: frame, size: { w: Math.round(rect.w), h: Math.round(rect.h) }, ...hit, events };
  log.push(entry);
  console.log(`  tap ${label}: point ${entry.point.x},${entry.point.y} screen ${screen.x},${screen.y} (webview ${JSON.stringify(frame)}) under ${hit.under} (target hit: ${hit.hitsTarget}) events: ${events.map((e) => `${e.type}>${e.target}@${e.x},${e.y}`).join(' ') || 'NONE'}`);
  return entry;
}

/** What the open menu looks like right now. */
const menuState = () => browser.execute(() => {
  const m = document.querySelector('[role="menu"]');
  if (!m) return { open: false };
  const b = m.getBoundingClientRect();
  const cs = getComputedStyle(m);
  return {
    open: true, parent: window.__describe(m.parentElement), rect: [b.x, b.y, b.width, b.height].map(Math.round),
    visibility: cs.visibility, pointerEvents: cs.pointerEvents, viewport: [innerWidth, innerHeight], coarse: matchMedia('(pointer: coarse)').matches,
  };
});

/** One case: a fresh list, then the path to its delete menu item, a real tap on it, and what the app did. */
async function runCase(name, { url, title, forceInside = false, informational = false, steps }) {
  console.log(`\n== ${name}`);
  const log = [];
  const res = { name, informational, ok: false, log, notes: [] };
  results.push(res);
  try {
    await seed(title);
    // the "Add to Home Screen" banner is dismissed through its own persisted flag, set before the app loads
    await browser.url(`${BASE}/`);
    await browser.execute(() => { try { localStorage.setItem('cal.iosHintDismissed', '1'); } catch { /* ignore */ } });
    await browser.url(BASE + url);
    await dismissSafariTip();
    await browser.execute(installRecorder, forceInside);
    await sleep(1500);
    await shot(`${name}-1-loaded`);
    await steps(log, res);
    await shot(`${name}-9-end`);
  } catch (e) {
    const titled = await browser.execute(() => [...document.querySelectorAll('[data-title]')].map((n) => `${n.getAttribute('data-testid')}:${n.getAttribute('data-title')}`)).catch(() => []);
    res.notes.push(`error: ${e.message} (titled elements: ${titled.join(', ') || 'none'})`);
    console.log(`  ERROR ${e.message}`);
    await shot(`${name}-error`);
  }
  res.console = await browser.execute(() => window.__console ?? []).catch(() => []);
}

/** Taps "..." then Delete on the list; fills in the verdict. */
async function overflowDelete(log, res, overflowCss, title) {
  await tap(log, 'overflow button', overflowCss);
  const menu = await menuState();
  res.menu = menu;
  console.log(`  menu: ${JSON.stringify(menu)}`);
  await shot(`${res.name}-2-menu`);
  if (!menu.open) { res.notes.push('menu did not open after the tap'); return; }
  const del = await tap(log, 'delete item', '[role="menu"] [data-testid="tasklist-delete"]', { scroll: false });
  const gone = await browser.waitUntil(() => browser.execute((t) => !document.querySelector(`[data-testid="tasks-item"][data-title="${t}"], [data-testid="tasklist-card"][data-title="${t}"]`), title), { timeout: 5000 }).catch(() => false);
  const undo = await waitFor('[data-testid="undo-snackbar"]', 3000);
  res.after = { menuStillOpen: (await menuState()).open, listGone: !!gone, undoSnackbar: undo, deleteTapHitMenuItem: del.hitsTarget, deleteTapSawClick: del.events.some((e) => e.type === 'click') };
  console.log(`  after delete: ${JSON.stringify(res.after)}`);
  await shot(`${res.name}-3-after`);
  res.ok = !!gone && undo;
  if (!res.ok) res.notes.push('Delete did nothing visible (list still there or no undo snackbar)');
}

const sheetSteps = (title) => async (log, res) => {
  await tap(log, 'card', `[data-testid="task-tray-item"][data-title="${title}"]`);
  const sheet = '[data-testid="tasklist-expanded"]:not([data-presentation="overlay"])';
  if (!(await waitFor(sheet))) { res.notes.push('list sheet did not open'); return; }
  await sleep(800);
  await shot(`${res.name}-1b-sheet`);
  await overflowDelete(log, res, `${sheet} [data-testid="tasklist-overflow"]`, title);
};

async function main() {
  const caps = {
    platformName: 'iOS', browserName: 'Safari', 'appium:automationName': 'XCUITest',
    'appium:deviceName': process.env.DEVICE_NAME ?? 'iPhone', 'appium:udid': process.env.UDID,
    'appium:platformVersion': process.env.PLATFORM_VERSION, 'appium:wdaLaunchTimeout': 300000, 'appium:wdaConnectionTimeout': 300000,
    'appium:safariIgnoreFraudWarning': true, 'appium:newCommandTimeout': 300, 'appium:connectHardwareKeyboard': false,
    'appium:showSafariConsoleLog': true,
  };
  for (const k of Object.keys(caps)) if (caps[k] === undefined) delete caps[k];
  browser = await remote({ hostname: APPIUM.hostname, port: Number(APPIUM.port), path: '/', logLevel: 'warn', capabilities: caps, connectionRetryCount: 1, connectionRetryTimeout: 600000 });
  try {
    await runCase('sheet-menu', { url: `/day/${DAY}`, title: 'Groceries', steps: sheetSteps('Groceries') });
    await runCase('card-menu', {
      url: '/tasks', title: 'Chores',
      steps: (log, res) => overflowDelete(log, res, '[data-testid="tasks-item"][data-title="Chores"] [data-testid="tasklist-overflow"]', 'Chores'),
    });
    // the pre-fix behaviour: the menu is hosted inside the sheet again. Shows whether the simulator can see the bug at all.
    await runCase('sheet-menu-forced-inside', { url: `/day/${DAY}`, title: 'Errands', forceInside: true, informational: true, steps: sheetSteps('Errands') });
    for (const lt of ['syslog']) {
      const lines = await browser.getLogs(lt).catch((e) => [`unavailable: ${e.message}`]);
      writeFileSync(`${OUT}/${lt}.log`, lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n'));
    }
  } finally {
    await browser.deleteSession().catch(() => {});
  }
}

try { await main(); } catch (e) { console.error(e); results.push({ name: 'setup', ok: false, notes: [e.message], informational: false }); }
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
console.log('\n== SUMMARY');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}${r.informational ? ' (informational)' : ''}  ${r.name}  ${r.notes.join('; ')}`);
const forced = results.find((r) => r.name === 'sheet-menu-forced-inside');
if (forced) console.log(`Bug reproduces with the menu inside the sheet: ${forced.ok ? 'NO (simulator may not see it)' : 'YES'}`);
// the same verdicts on the run's summary page
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = results.map((r) => `| ${r.name} | ${r.ok ? 'pass' : 'FAIL'}${r.informational ? ' (informational)' : ''} | ${r.notes.join('; ') || ''} |`);
  const verdict = forced ? `Bug reproduces with the menu inside the sheet: **${forced.ok ? 'no (the simulator may not see it)' : 'yes'}**` : '';
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### iOS Safari simulator\n\n| case | result | notes |\n|---|---|---|\n${rows.join('\n')}\n\n${verdict}\n`);
}

process.exit(results.some((r) => !r.ok && !r.informational) ? 1 : 0);
