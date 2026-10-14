/**
 * Web Push reminders (ARCHITECTURE "Reminders, several per event", slice 2). Stores each browser's push subscription and
 * the reminder plan the app sent for it (`users/<sub>/push.json`), and sends every planned push at its time from one timer
 * loop (like `BackupService`): a push missed by up to {@link CATCH_UP_MS} is still sent, and a key is never sent twice.
 */
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import type { Clock } from '../lib/clock.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { userDir } from '../auth/people.js';

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
/** One push to send at `at` (epoch ms). */
export interface PlanEntry { at: number; title: string; body: string; key: string }
interface StoredSubscription extends PushTarget { plan: PlanEntry[]; sent: Array<{ key: string; at: number }> }
interface StoredPush { subscriptions: StoredSubscription[] }

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

/** The real sender: the `web-push` library, signing with the VAPID keys. */
export function webPushSender(vapid: VapidKeys, subject: string): PushSender {
  return {
    async send(target, payload) {
      await webpush.sendNotification(target, payload, { vapidDetails: { subject, ...vapid }, TTL: CATCH_UP_MS / 1000, urgency: 'high' });
    },
  };
}

/** E2E sender: records every push instead of calling a push service (`GET /api/__test/pushes`). */
export class RecordingSender implements PushSender {
  readonly sent: Array<{ endpoint: string; title: string; body: string; key: string }> = [];
  async send(target: PushTarget, payload: string): Promise<void> {
    this.sent.push({ endpoint: target.endpoint, ...(JSON.parse(payload) as { title: string; body: string; key: string }) });
  }
  reset(): void { this.sent.length = 0; }
}

/** Constructor inputs of {@link PushService}. */
export interface PushDeps { dataDir: string; clock: Clock; sender: PushSender; vapidPublicKey: string; log?: (m: string) => void }

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
    const users = path.join(this.d.dataDir, 'users');
    if (!fs.existsSync(users)) return [];
    return fs.readdirSync(users).filter((u) => /^[A-Za-z0-9_-]{1,64}$/.test(u) && fs.existsSync(this.file(u)));
  }

  /** Sends every due push (at <= now, at most {@link CATCH_UP_MS} late, key not sent yet). Returns how many were sent. */
  tick(): Promise<number> {
    this.ticking ??= this.run().finally(() => { this.ticking = null; });
    return this.ticking;
  }

  private async run(): Promise<number> {
    const now = this.d.clock.nowMs();
    let count = 0;
    for (const sub of this.people()) {
      const p = this.read(sub);
      let changed = false;
      const alive: StoredSubscription[] = [];
      for (const s of p.subscriptions) {
        let gone = false;
        // entries too old to catch up are dropped, as are sent keys no re-sent plan can repeat any more
        const kept = s.plan.filter((e) => now - e.at <= CATCH_UP_MS);
        if (kept.length !== s.plan.length) { s.plan = kept; changed = true; }
        const sentBefore = s.sent.length;
        s.sent = s.sent.filter((x) => now - x.at <= SENT_KEEP_MS);
        if (s.sent.length !== sentBefore) changed = true;
        for (const e of s.plan) {
          if (e.at > now || s.sent.some((x) => x.key === e.key)) continue;
          try {
            await this.d.sender.send(s, JSON.stringify({ title: e.title, body: e.body, key: e.key }));
            s.sent.push({ key: e.key, at: e.at });
            changed = true;
            count++;
          } catch (err) {
            const code = (err as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) { gone = true; changed = true; break; }
            this.d.log?.(`push: sending to ${new URL(s.endpoint).host} failed: ${(err as Error).message}`);
          }
        }
        if (!gone) alive.push(s);
      }
      if (changed) this.write(sub, { subscriptions: alive });
    }
    return count;
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
