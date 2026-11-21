import path from 'node:path';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import type { Clock } from '../lib/clock.js';
import { logEvent } from '../lib/diag.js';
import { nanoid } from '../lib/ids.js';

/** How long an invitation waits for an answer. */
const INVITATION_DAYS = 7;
const DAY_MS = 86_400_000;

/** One invitation to share a task list or a category (feature shared-lists, ADR 0047). It belongs to the address it was sent to, so it waits for a person who has not signed in yet. */
export interface Invitation {
  id: string;
  kind: 'list' | 'category';
  /** The id of the task list (Google event id or `shared:...`) or of the category. */
  target: string;
  /** Google `sub` of the person who invited. */
  owner: string;
  /** The title of the list or the name of the category as it was when sent. */
  title: string;
  /** The typed address, trimmed and lower case. */
  address: string;
  expires: number;
  /** The invited person said no: it stays for the sender (who is told nothing) until it is withdrawn, lapses or is sent again. */
  declined?: true;
}

type Draft = Pick<Invitation, 'kind' | 'target' | 'owner' | 'title' | 'address'>;

const isInvitation = (v: unknown): v is Invitation => typeof v === 'object' && v !== null
  && typeof (v as Invitation).id === 'string' && ((v as Invitation).kind === 'list' || (v as Invitation).kind === 'category')
  && typeof (v as Invitation).target === 'string' && typeof (v as Invitation).owner === 'string' && typeof (v as Invitation).title === 'string'
  && typeof (v as Invitation).address === 'string' && typeof (v as Invitation).expires === 'number';

/** The invitations store (`DATA_DIR/shared/invitations.json`); expired ones are dropped whenever the file is read or written. */
export class Invitations {
  private readonly file: string;
  private items: Invitation[];

  constructor(dataDir: string, private readonly clock: Clock) {
    this.file = path.join(dataDir, 'shared', 'invitations.json');
    this.items = this.load();
  }

  private load(): Invitation[] {
    const raw = readJson<unknown>(this.file);
    return Array.isArray(raw) ? raw.filter(isInvitation) : [];
  }

  private live(): Invitation[] {
    const now = this.clock.nowMs();
    const kept = this.items.filter((i) => i.expires > now);
    if (kept.length !== this.items.length) this.save(kept);
    return kept;
  }

  private save(items: Invitation[]): void {
    this.items = items;
    writeJsonAtomic(this.file, items);
  }

  /** Reads the file again (after a restore wrote it behind the store's back). */
  reload(): void {
    this.items = this.load();
  }

  /** Sends an invitation; one still unanswered sent again changes nothing, a declined one is replaced by a new one (declining answers only that invitation). */
  send(d: Draft): void {
    const same = (i: Invitation) => i.owner === d.owner && i.kind === d.kind && i.target === d.target && i.address === d.address;
    const all = this.live();
    if (all.some((i) => same(i) && !i.declined)) return;
    this.save([...all.filter((i) => !same(i)), { ...d, id: nanoid(16), expires: this.clock.nowMs() + INVITATION_DAYS * DAY_MS }]);
    logEvent('invitation_sent', { kind: d.kind });
  }

  /** Whether this very invitation (same sender, kind, target and address) is open. */
  has(d: Draft): boolean {
    return this.live().some((i) => i.owner === d.owner && i.kind === d.kind && i.target === d.target && i.address === d.address);
  }

  /** What waits for this address: invitations not declined. */
  incoming(address: string): Invitation[] {
    return this.live().filter((i) => i.address === address && !i.declined);
  }

  /** What this person sent and nobody withdrew, declined ones included. */
  sent(owner: string): Invitation[] {
    return this.live().filter((i) => i.owner === owner);
  }

  get(id: string): Invitation | undefined {
    return this.live().find((i) => i.id === id);
  }

  remove(id: string): void {
    this.save(this.live().filter((i) => i.id !== id));
  }

  decline(id: string): void {
    this.save(this.live().map((i) => (i.id === id ? { ...i, declined: true as const } : i)));
  }

  /** A list moved (into or out of the shared store) and got a new id: its pending invitations follow it. */
  retarget(owner: string, from: string, to: string): void {
    this.save(this.live().map((i) => (i.owner === owner && i.kind === 'list' && i.target === from ? { ...i, target: to } : i)));
  }

  /** Forgets everything (test reset). */
  reset(): void {
    this.items = [];
  }
}
