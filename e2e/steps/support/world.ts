import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { Api } from './api.js';
import { installIosTouchModel } from './iosTouch.js';

export const DEFAULT_POLL_MS = 30_000;

/** CSS attribute selector with a safely quoted value. */
export const attr = (name: string, value: string) =>
  `[${name}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
export const tid = (id: string) => attr('data-testid', id);

/** Regex that matches the whole (trimmed) text exactly. */
export const exactText = (s: string) => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

/** Page-side recorders (see support/probes.ts for the readers). Runs before any app code. */
function installProbes() {
  const w = window as unknown as ProbeWindow;
  // `new Event().timeStamp` is a native monotonic clock that page.clock does not fake (unlike Date / performance.now).
  const nativeNow = () => new Event('t').timeStamp;
  w.__haptics = [];
  const originalVibrate = navigator.vibrate?.bind(navigator);
  Object.defineProperty(Navigator.prototype, 'vibrate', {
    configurable: true,
    writable: true,
    value: (pattern: number | number[]) => {
      w.__haptics!.push(pattern);
      return originalVibrate ? originalVibrate(pattern) : true;
    },
  });
  w.__rewardLog = [];
  // Every now-card node ever inserted gets a sequence number (for "the now card stayed in place").
  w.__nowCardInserts = 0;
  const open = new Map<Element, RewardLogEntry>();
  const scan = (node: Node, added: boolean) => {
    if (!(node instanceof Element)) return;
    if (added) {
      const cards = node.matches('[data-testid="now-card"]') ? [node] : [];
      node.querySelectorAll('[data-testid="now-card"]').forEach((e) => cards.push(e));
      for (const c of cards) (c as Element & { __nowCardSeq?: number }).__nowCardSeq = ++w.__nowCardInserts!;
    }
    // The support cat is logged too (kind `support-cat`): it is a one-off overlay like the reward effects.
    const sel = '[data-testid="reward-effect"], [data-testid="support-cat"]';
    const effects = node.matches(sel) ? [node] : [];
    node.querySelectorAll(sel).forEach((e) => effects.push(e));
    for (const el of effects) {
      if (added) {
        const kind = el.getAttribute('data-kind') ?? el.getAttribute('data-testid') ?? '';
        const entry: RewardLogEntry = { kind, insertedAt: nativeNow() };
        open.set(el, entry);
        w.__rewardLog!.push(entry);
      } else if (open.has(el)) {
        open.get(el)!.removedAt = nativeNow();
        open.delete(el);
      }
    }
  };
  const start = () => {
    new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => scan(n, true));
        r.removedNodes.forEach((n) => scan(n, false));
      }
    }).observe(document, { childList: true, subtree: true });
  };
  start();
}

export interface RewardLogEntry { kind: string; insertedAt: number; removedAt?: number }
export interface ProbeWindow extends Window {
  __haptics?: (number | number[])[];
  __rewardLog?: RewardLogEntry[];
  __nowCardInserts?: number;
}

/** CSP violations seen by the current scenario's pages (filled via `prepareContext`, checked and cleared in `dispose`; a worker runs one scenario at a time). */
const cspViolations: string[] = [];

export interface BrowserMemory { heap: number; nodes: number; listeners: number }

/**
 * Per-scenario state shared by all steps (playwright-bdd world fixture, cucumber style: `this` in steps).
 * `page` is mutable because "I switch to another device" replaces it.
 */
export class World {
  page: Page;
  context: BrowserContext;
  readonly api: Api;
  /** Extra contexts created by "I switch to another device"; closed on dispose. */
  private ownContexts: BrowserContext[] = [];
  colorScheme: 'light' | 'dark' | null = null;
  pollIntervalMs = DEFAULT_POLL_MS;
  /** Epoch ms by which Google's slow-down ("Google asks the app to slow down ...") has ended at the latest. */
  slowDownUntil = 0;
  /** Epoch ms the app clock currently shows (set by "the time is ... and the clock is running"). */
  clockNowMs?: number;

  // Results remembered between steps.
  /** A pointer/touch press kept down by "I pick up ..."; released by "I release ...". */
  held?: () => Promise<void>;
  /** Where "I pick up ..." pressed (page coordinates). */
  heldAt?: { x: number; y: number };
  /** Moves the held pointer or finger to a point in steps over a time (set by the hold steps that can move on). */
  heldMove?: (to: { x: number; y: number }, steps: number, ms: number) => Promise<void>;
  /** Scroll position of the time grid noted by "I swipe up quickly starting on the event ...". */
  gridScrollBefore?: number;
  /** The next finger drag holds perfectly still during the long press (iPhone model: no small moves). */
  stillFinger?: boolean;
  /** The person of the last sign-in step ("they" in the sign-in scenarios). */
  person?: string;
  /** The week the last "without signing in" step opened. */
  weekOpened?: string;
  /** App sign-in (signin.steps.ts): the deep link the system browser ended on, the code in it, and the last exchange's HTTP status/body. */
  appLink?: string;
  appCode?: string;
  /** The app's secret of an app sign-in; only its SHA-256 (the challenge) goes through the browser. */
  appVerifier?: string;
  appExchange?: { status: number; text: string };
  /** Hour height of the time grid captured before the last pinch ("as before" / "at the start"). */
  hourHeightBefore?: number;
  lastResponse?: { status: number; json: unknown; url: string; headers?: Record<string, string>; text?: string };
  /** The first-open check-in of the page opened by "I open the app" (settles to undefined when none comes). */
  firstCheckIn?: Promise<unknown>;
  browserMemory?: BrowserMemory;
  serverRss?: number;
  requestCount?: number;
  lighthouseScore?: number;
  /** The top bar's control boxes noted before switching to left-handed mode (feature header-layout), relative to the bar. */
  topBarBoxes?: { width: number; boxes: Record<string, { x: number; y: number; w: number; h: number }> };

  constructor(
    page: Page,
    readonly request: APIRequestContext,
    readonly browser: Browser,
    readonly testInfo: TestInfo,
  ) {
    this.page = page;
    this.context = page.context();
    this.api = new Api(request);
  }

  get baseURL(): string {
    return (this.testInfo.project.use.baseURL ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  get isPhoneProject(): boolean {
    return this.testInfo.project.name === 'mobile';
  }

  /** Give a slow step more time without touching the global timeout. */
  extendTimeout(ms: number) {
    this.testInfo.setTimeout(this.testInfo.timeout + ms);
  }

  // --- locators ------------------------------------------------------------------------------------------------
  byTestId(id: string, extra = ''): Locator {
    return this.page.locator(`${tid(id)}${extra}`);
  }

  eventChips(title: string, date?: string): Locator {
    return this.byTestId('event-chip', attr('data-title', title) + (date ? attr('data-date', date) : ''));
  }

  eventBars(title: string): Locator {
    return this.byTestId('event-bar', attr('data-title', title));
  }

  /** True when a visible multi-day bar of the event covers the date (bars replace per-day chips). */
  async barCovers(title: string, date: string): Promise<boolean> {
    return this.eventBars(title).locator('visible=true').evaluateAll(
      (els, d) => els.some((e) => (e as HTMLElement).dataset.start! <= d && d <= (e as HTMLElement).dataset.end!), date);
  }

  /** First visible chip segment of an event (several segments for multi-day events). */
  eventChip(title: string, date?: string): Locator {
    return this.eventChips(title, date).locator('visible=true').first();
  }

  taskCards(title: string, date?: string): Locator {
    return this.byTestId('tasklist-card', attr('data-title', title) + (date ? attr('data-date', date) : ''));
  }

  taskCard(title: string, date?: string): Locator {
    return this.taskCards(title, date).locator('visible=true').first();
  }

  get expanded(): Locator {
    return this.byTestId('tasklist-expanded');
  }

  expandedItem(title: string): Locator {
    return this.expanded
      .getByTestId('tasklist-item')
      .filter({ has: this.page.getByTestId('tasklist-item-title').filter({ hasText: exactText(title) }) });
  }

  /** Time-grid column (week or day view) for a date. */
  dayColumn(date: string): Locator {
    return this.page.locator(
      `${tid('week-day-column')}${attr('data-date', date)}, ${tid('day-column')}${attr('data-date', date)}`,
    ).first();
  }

  // --- waiting -------------------------------------------------------------------------------------------------
  /** One of the three calendar views is rendered. */
  async calendarShown() {
    await expect(
      this.page.locator(`${tid('month-view')}, ${tid('week-view')}, ${tid('day-view')}, ${tid('year-view')}`).first(),
    ).toBeVisible();
  }

  /**
   * The app finished its current fetch: `sync-status` is not `syncing` and either reports an error or has completed a
   * sync at least once. Used before negative assertions so "not visible" does not pass on an empty, loading page.
   */
  async settled() {
    await this.calendarShown();
    await expect
      .poll(async () => {
        const s = this.page.getByTestId('sync-status').first();
        if (!(await s.count())) return 'missing sync-status';
        const state = await s.getAttribute('data-state');
        const last = await s.getAttribute('data-last-sync');
        if (state === 'syncing') return 'syncing';
        return state === 'error' || last ? 'settled' : 'never synced';
      }, { message: 'app has settled (sync-status)' })
      .toBe('settled');
  }

  /** Date shown by the week view for a weekday name (`data-week-start` + offset). */
  async weekStart(): Promise<string> {
    const week = this.byTestId('week-view');
    await expect(week).toHaveAttribute('data-week-start', /^\d{4}-\d{2}-\d{2}$/);
    return (await week.getAttribute('data-week-start'))!;
  }

  // --- pages / contexts ----------------------------------------------------------------------------------------
  /** Scripts every page of the scenario gets before any app code runs. */
  static async prepareContext(context: BrowserContext) {
    // Records when the first month cell becomes visible (for "the month view was rendered within N ms").
    await context.addInitScript(installProbes);
    // iPhone project: a model of iOS WebKit's touch handling drives the finger (STEPS.md "Drag and drop")
    if (context.browser()?.browserType().name() === 'webkit') await context.addInitScript(installIosTouchModel);
    // The server sends a Content-Security-Policy (server/src/lib/securityHeaders.ts): any violation fails the scenario.
    await context.exposeFunction('__reportCspViolation', (v: string) => { cspViolations.push(v); });
    await context.addInitScript(() => {
      window.addEventListener('securitypolicyviolation', (e) => {
        // DOMPurify parses the deliberately unsafe theme picture (sneaky.svg) and its blocked on* attributes are reported: expected
        if (e.violatedDirective.startsWith('script-src-attr') && /purify/.test(e.sourceFile)) return;
        (window as unknown as { __reportCspViolation(v: string): void }).__reportCspViolation(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'} (${e.sourceFile || location.pathname}:${e.lineNumber})`);
      }, true);
    });
    await context.addInitScript(() => {
      const w = window as unknown as { __monthRenderedAt?: number };
      const check = () => {
        const cell = document.querySelector('[data-testid="month-cell"]');
        if (cell && cell.getBoundingClientRect().width > 0) {
          w.__monthRenderedAt = performance.now();
          obs.disconnect();
        }
      };
      const obs = new MutationObserver(check);
      obs.observe(document, { childList: true, subtree: true });
      setTimeout(() => obs.disconnect(), 30_000);
    });
  }

  /** "I switch to another device": fresh context with the same project options, no shared storage. */
  async switchDevice() {
    const use = this.testInfo.project.use;
    const context = await this.browser.newContext({
      baseURL: use.baseURL,
      viewport: use.viewport,
      isMobile: use.isMobile,
      hasTouch: use.hasTouch,
      userAgent: use.userAgent,
      deviceScaleFactor: use.deviceScaleFactor,
      locale: use.locale,
      timezoneId: use.timezoneId,
      colorScheme: this.colorScheme ?? use.colorScheme,
    });
    await World.prepareContext(context);
    this.ownContexts.push(context);
    this.context = context;
    this.page = await context.newPage();
  }

  /** Closes this context when the scenario ends (e.g. a second person's API session). */
  track(context: BrowserContext) {
    this.ownContexts.push(context);
  }

  async dispose() {
    await this.held?.().catch(() => {});
    this.heldMove = undefined;
    for (const c of this.ownContexts) await c.close().catch(() => {});
    // Leave the shared backend clean (outage, clock, poll interval) for the next scenario.
    if (this.api.usedTestApi) await this.api.reset().catch(() => {});
    const violations = cspViolations.splice(0);
    if (violations.length) throw new Error(`Content-Security-Policy violations:\n${violations.join('\n')}`);
  }
}
