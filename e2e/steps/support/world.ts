import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { Api } from './api.js';

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
  const open = new Map<Element, RewardLogEntry>();
  const scan = (node: Node, added: boolean) => {
    if (!(node instanceof Element)) return;
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
}

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
  /** Epoch ms the app clock currently shows (set by "the time is ... and the clock is running"). */
  clockNowMs?: number;

  // Results remembered between steps.
  /** A pointer/touch press kept down by "I pick up ..."; released by "I release ...". */
  held?: () => Promise<void>;
  /** The person of the last sign-in step ("they" in the sign-in scenarios). */
  person?: string;
  /** The week the last "without signing in" step opened. */
  weekOpened?: string;
  lastResponse?: { status: number; json: unknown; url: string };
  browserMemory?: BrowserMemory;
  serverRss?: number;
  requestCount?: number;
  lighthouseScore?: number;

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

  async dispose() {
    await this.held?.().catch(() => {});
    for (const c of this.ownContexts) await c.close().catch(() => {});
    // Leave the shared backend clean (outage, clock, poll interval) for the next scenario.
    if (this.api.usedTestApi) await this.api.reset().catch(() => {});
  }
}
