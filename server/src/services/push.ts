/**
 * Web Push reminders (feature reminders, slice 2). Stores each browser's push subscription and
 * the reminder plan the app sent for it (`users/<sub>/push.json`), and sends every planned push at its time from one timer
 * loop (like `BackupService`): a push missed by up to {@link CATCH_UP_MS} is still sent, and a key is never sent twice.
 */
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import type { Clock } from '../lib/clock.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { listUserSubs, userDir } from '../auth/people.js';

/** A planned push may be sent this late (server was down, loop was busy); later ones are dropped. */
export const CATCH_UP_MS = 10 * 60_000;
/** How often the loop looks for due pushes. */
export const TICK_MS = 30_000;
/** Sent keys are remembered this long, so a re-sent plan never repeats a push. */
const SENT_KEEP_MS = 24 * 3_600_000;
/** Most subscriptions (browsers) one person can have, and most plan entries per browser. */
export const MAX_SUBSCRIPTIONS = 10;
export const MAX_PLAN = 500;

/** The browser's push endpoint and its encryption keys, as `PushSubscription.toJSON()` returns them. */
export interface PushTarget { endpoint: string; keys: { p256dh: string; auth: string } }
/** What a push is about; the service worker shows each kind with its own icon (absent in plans stored before kinds). */
export type PushKind = 'event' | 'tasklist' | 'summary' | 'bedtime';
/** One push to send at `at` (epoch ms). */
export interface PlanEntry { at: number; title: string; body: string; key: string; kind?: PushKind }
interface StoredSubscription extends PushTarget { plan: PlanEntry[]; sent: Array<{ key: string; at: number }> }
interface StoredPush { subscriptions: StoredSubscription[] }
/** What one tick did for one browser: the keys it sent and whether the push service said the subscription is gone. */
interface SendJob { sub: string; endpoint: string; sent: Array<{ key: string; at: number }>; gone: boolean; open: boolean }

/** Sends one push message; rejects with an object carrying `statusCode` when the push service refuses. */
export interface PushSender { send(target: PushTarget, payload: string): Promise<void> }

/** The VAPID key pair identifying this server to push services. */
export interface VapidKeys { publicKey: string; privateKey: string }

/**
 * Reads the VAPID keys: from the environment, else from `DATA_DIR/vapid.json`, generated on first start.
 *
 * @param dataDir The data directory.
 * @param env Environment with the optional `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
 */
export function loadVapid(dataDir: string, env: NodeJS.ProcessEnv = process.env): VapidKeys {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const file = path.join(dataDir, 'vapid.json');
  const stored = readJson<Partial<VapidKeys>>(file);
  if (stored?.publicKey && stored.privateKey) return { publicKey: stored.publicKey, privateKey: stored.privateKey };
  const keys = webpush.generateVAPIDKeys();
  writeJsonAtomic(file, keys, 0o600);
  return keys;
}

/** Every push to a push service gives up after this long. */
export const SEND_TIMEOUT_MS = 10_000;
/** One tick stops waiting for slow endpoints after this long; what finished is saved, the rest is tried again next tick. */
export const TICK_BUDGET_MS = 25_000;
/** The only host a TEST_MODE server also accepts (the e2e fake push service; it is never contacted). */
export const TEST_PUSH_HOST = 'push.example.test';

/** The push services of the browsers: Chrome/Edge (FCM), Firefox, Safari and the legacy Windows one. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/];

/**
 * Whether a subscription endpoint is a real push service: https, port 443, no credentials, no IP literal, and a host of
 * FCM, Mozilla, Apple or Windows. Stops the server from being used to call internal addresses (SSRF).
 *
 * @param endpoint The endpoint URL the browser reported.
 * @param testMode Also accept {@link TEST_PUSH_HOST} (TEST_MODE only).
 */
export function isPushEndpointAllowed(endpoint: string, testMode = false): boolean {
  let u: URL;
  try { u = new URL(endpoint); } catch { return false; }
  if (u.protocol !== 'https:' || (u.port !== '' && u.port !== '443') || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (host.includes(':') || /^[0-9.]+$/.test(host)) return false;
  return PUSH_HOSTS.some((re) => re.test(host)) || (testMode && host === TEST_PUSH_HOST);
}

/**
 * The real sender: the `web-push` library builds the signed, encrypted request, and it is sent with a hard timeout,
 * without following redirects and without reading the answer (a hostile endpoint cannot hold the loop or fill memory).
 * An endpoint outside the allow-list (stored before it existed) is reported as gone (410), so it is dropped.
 *
 * @param vapid The server's VAPID key pair.
 * @param subject The VAPID subject (a `mailto:` or https URL).
 * @param o Test hooks: the fetch to use and the timeout.
 */
export function webPushSender(vapid: VapidKeys, subject: string, o: { fetchFn?: typeof fetch; timeoutMs?: number } = {}): PushSender {
  const fetchFn = o.fetchFn ?? fetch;
  return {
    async send(target, payload) {
      if (!isPushEndpointAllowed(target.endpoint)) throw Object.assign(new Error('Push endpoint is not a known push service'), { statusCode: 410 });
      const d = webpush.generateRequestDetails(target, payload, { vapidDetails: { subject, ...vapid }, TTL: CATCH_UP_MS / 1000, urgency: 'high' });
      const res = await fetchFn(d.endpoint, { method: d.method, headers: d.headers as Record<string, string>, body: d.body ? new Uint8Array(d.body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(o.timeoutMs ?? SEND_TIMEOUT_MS) });
      void res.body?.cancel().catch(() => undefined);
      if (res.status < 200 || res.status > 299) throw Object.assign(new Error(`Push service answered ${res.status}`), { statusCode: res.status });
    },
  };
}

/** E2E sender: records every push instead of calling a push service (`GET /api/__test/pushes`). */
export class RecordingSender implements PushSender {
  readonly sent: Array<{ endpoint: string; title: string; body: string; key: string; kind?: PushKind }> = [];
  async send(target: PushTarget, payload: string): Promise<void> {
    this.sent.push({ endpoint: target.endpoint, ...(JSON.parse(payload) as { title: string; body: string; key: string; kind?: PushKind }) });
  }
  reset(): void { this.sent.length = 0; }
}

/** Constructor inputs of {@link PushService}. */
export interface PushDeps {
  dataDir: string; clock: Clock; sender: PushSender; vapidPublicKey: string; log?: (m: string) => void;
  /** False for a person taken off the allow-list: their pushes are not sent. Default: everybody. */
  isPermitted?: (sub: string) => boolean;
  /** How long a tick waits for slow endpoints (default {@link TICK_BUDGET_MS}). */
  budgetMs?: number;
}

/** Subscriptions, plans and the timer loop that sends the pushes. */
export class PushService {
  private interval: NodeJS.Timeout | null = null;
  private ticking: Promise<number> | null = null;

  constructor(private readonly d: PushDeps) {}

  /** The public VAPID key the browser subscribes with. */
  get publicKey(): string { return this.d.vapidPublicKey; }

  private file(sub: string): string { return path.join(userDir(this.d.dataDir, sub), 'push.json'); }
  private read(sub: string): StoredPush {
    const p = readJson<Partial<StoredPush>>(this.file(sub));
    return { subscriptions: Array.isArray(p?.subscriptions) ? p.subscriptions : [] };
  }
  private write(sub: string, p: StoredPush): void {
    if (p.subscriptions.length) writeJsonAtomic(this.file(sub), p, 0o600);
    else fs.rmSync(this.file(sub), { force: true });
  }

  /** Adds a browser's subscription (an existing one with the same endpoint keeps its plan). Returns false when the person has too many. */
  subscribe(sub: string, target: PushTarget): boolean {
    const p = this.read(sub);
    const old = p.subscriptions.find((s) => s.endpoint === target.endpoint);
    if (old) old.keys = target.keys;
    else if (p.subscriptions.length >= MAX_SUBSCRIPTIONS) return false;
    else p.subscriptions.push({ ...target, plan: [], sent: [] });
    this.write(sub, p);
    return true;
  }

  /** Removes a browser's subscription; true when there was one. */
  unsubscribe(sub: string, endpoint: string): boolean {
    const p = this.read(sub);
    const rest = p.subscriptions.filter((s) => s.endpoint !== endpoint);
    if (rest.length === p.subscriptions.length) return false;
    this.write(sub, { subscriptions: rest });
    return true;
  }

  /** Replaces the plan of one subscribed browser; false when that browser is not subscribed. */
  setPlan(sub: string, endpoint: string, plan: PlanEntry[]): boolean {
    const p = this.read(sub);
    const s = p.subscriptions.find((x) => x.endpoint === endpoint);
    if (!s) return false;
    s.plan = plan;
    this.write(sub, p);
    return true;
  }

  /** The subscriptions of everyone (test hook), without keys. */
  all(): Array<{ sub: string; endpoint: string; plan: PlanEntry[] }> {
    return this.people().flatMap((sub) => this.read(sub).subscriptions.map((s) => ({ sub, endpoint: s.endpoint, plan: s.plan })));
  }

  /** The people with a `push.json`, found on disk like the backup does. */
  private people(): string[] {
    return listUserSubs(this.d.dataDir).filter((u) => fs.existsSync(this.file(u)));
  }

  /** Sends every due push (at <= now, at most {@link CATCH_UP_MS} late, key not sent yet). Returns how many were sent. */
  tick(): Promise<number> {
    this.ticking ??= this.run().finally(() => { this.ticking = null; });
    return this.ticking;
  }

  private async run(): Promise<number> {
    const now = this.d.clock.nowMs();
    const jobs: SendJob[] = [];
    const tasks: Array<Promise<void>> = [];
    // every browser is served on its own, so an endpoint that never answers holds back nobody else
    for (const sub of this.people()) {
      if (this.d.isPermitted && !this.d.isPermitted(sub)) continue;
      for (const s of this.read(sub).subscriptions) {
        const job: SendJob = { sub, endpoint: s.endpoint, sent: [], gone: false, open: true };
        jobs.push(job);
        tasks.push(this.sendDue(s, now, job));
      }
    }
    let timer: NodeJS.Timeout | undefined;
    const budget = new Promise<void>((resolve) => { timer = setTimeout(resolve, this.d.budgetMs ?? TICK_BUDGET_MS); });
    await Promise.race([Promise.allSettled(tasks), budget]);
    clearTimeout(timer);
    // what is still in flight after the budget is not recorded; its keys are sent again next tick
    for (const j of jobs) j.open = false;
    let count = 0;
    for (const sub of new Set(jobs.map((j) => j.sub))) {
      const p = this.read(sub);
      let changed = false;
      const alive: StoredSubscription[] = [];
      for (const s of p.subscriptions) {
        const job = jobs.find((j) => j.sub === sub && j.endpoint === s.endpoint);
        // entries too old to catch up are dropped, as are sent keys no re-sent plan can repeat any more
        const kept = s.plan.filter((e) => now - e.at <= CATCH_UP_MS);
        if (kept.length !== s.plan.length) { s.plan = kept; changed = true; }
        const sentBefore = s.sent.length;
        s.sent = s.sent.filter((x) => now - x.at <= SENT_KEEP_MS);
        if (s.sent.length !== sentBefore) changed = true;
        if (job?.sent.length) { s.sent.push(...job.sent); count += job.sent.length; changed = true; }
        if (job?.gone) { changed = true; continue; }
        alive.push(s);
      }
      if (changed) this.write(sub, { subscriptions: alive });
    }
    return count;
  }

  /** Sends one browser's due pushes in order; results go into `job`. A 404/410 marks the subscription gone. */
  private async sendDue(s: StoredSubscription, now: number, job: SendJob): Promise<void> {
    for (const e of s.plan) {
      if (e.at > now || now - e.at > CATCH_UP_MS || s.sent.some((x) => x.key === e.key)) continue;
      try {
        await this.d.sender.send(s, JSON.stringify({ title: e.title, body: e.body, key: e.key, kind: e.kind }));
        if (job.open) job.sent.push({ key: e.key, at: e.at });
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { if (job.open) job.gone = true; return; }
        this.d.log?.(`push: sending to ${new URL(s.endpoint).host} failed: ${(err as Error).message}`);
      }
    }
  }

  /** Starts the timer loop. Called by the server, not by tests. */
  start(): void {
    this.interval = setInterval(() => void this.tick(), TICK_MS);
    this.interval.unref();
  }

  /** Stops the timer loop. */
  close(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  /** Forgets every subscription (test reset). */
  reset(): void {
    for (const sub of this.people()) fs.rmSync(this.file(sub), { force: true });
  }
}
