/** Per-device read keys of the iPhone widget (ADR 0044): one JSON file per person, only a hash of the secret is stored. */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { WidgetKey, WidgetKeyCreated } from '../api/types.js';
import { listUserSubs } from '../auth/people.js';
import { ApiException, notFound } from '../lib/errors.js';
import { nanoid } from '../lib/ids.js';
import { isRecord, PersonJsonStore } from '../lib/personJsonStore.js';

const MAX_ACTIVE = 10;
const REVOKED_KEPT_MS = 90 * 24 * 3600_000;
const LAST_USED_EVERY_MS = 3600_000;
const ID_LENGTH = 8;

interface KeyRecord extends WidgetKey { hash: string; revokedAt?: string }
interface KeyDoc { version: 1; keys: KeyRecord[] }

const isRecordOfKey = (x: unknown): x is KeyRecord => isRecord(x) && typeof x.id === 'string' && typeof x.name === 'string'
  && typeof x.createdAt === 'string' && typeof x.hash === 'string' && (x.lastUsedAt === null || typeof x.lastUsedAt === 'string');

const sha256 = (secret: string): Buffer => createHash('sha256').update(secret).digest();
const invalid = () => new ApiException('WIDGET_KEY_INVALID', 401, 'This widget key is not valid');
const revoked = () => new ApiException('WIDGET_KEY_REVOKED', 401, 'This widget key was removed');

export class WidgetKeyStore {
  private readonly files: PersonJsonStore<KeyDoc>;
  /** key id -> person, so a request finds its person's file without reading every file. */
  private readonly owners = new Map<string, string>();

  constructor(private readonly dataDir: string, private readonly nowMs: () => number, log: (m: string) => void = (m) => console.warn(m)) {
    this.files = new PersonJsonStore<KeyDoc>(dataDir, 'widget-keys.json',
      (r) => (isRecord(r) && Array.isArray(r.keys) ? { version: 1, keys: r.keys.filter(isRecordOfKey) } : null),
      () => ({ version: 1, keys: [] }), (m) => log(`widget keys: ${m}`));
    this.reindex();
  }

  private reindex(): void {
    this.owners.clear();
    for (const sub of listUserSubs(this.dataDir)) for (const k of this.files.read(sub).keys) this.owners.set(k.id, sub);
  }

  private write(sub: string, keys: KeyRecord[]): void {
    this.files.write(sub, { version: 1, keys });
  }

  private iso(): string {
    return new Date(this.nowMs()).toISOString();
  }

  private static view = ({ id, name, createdAt, lastUsedAt }: KeyRecord): WidgetKey => ({ id, name, createdAt, lastUsedAt });

  /** The person's active keys (never the secret), newest first. */
  list(sub: string): WidgetKey[] {
    return this.files.read(sub).keys.filter((k) => !k.revokedAt).map(WidgetKeyStore.view).reverse();
  }

  /** Makes a key for a device; the secret is in the answer only. */
  create(sub: string, name: string): WidgetKeyCreated {
    const keys = this.files.read(sub).keys;
    if (keys.filter((k) => !k.revokedAt).length >= MAX_ACTIVE) {
      throw new ApiException('WIDGET_KEY_LIMIT', 409, `At most ${MAX_ACTIVE} widget keys`, undefined, 'settings.iphoneWidget.limit');
    }
    let id = nanoid(ID_LENGTH);
    while (this.owners.has(id)) id = nanoid(ID_LENGTH);
    const secret = randomBytes(32).toString('base64url');
    const rec: KeyRecord = { id, name, createdAt: this.iso(), lastUsedAt: null, hash: sha256(secret).toString('hex') };
    this.write(sub, [...this.prune(keys), rec]);
    this.owners.set(id, sub);
    return { ...WidgetKeyStore.view(rec), key: `cwk_${id}_${secret}` };
  }

  /** Revokes one of the person's keys; the record stays 90 days so the widget can say "removed". */
  revoke(sub: string, id: string): void {
    const keys = this.files.read(sub).keys;
    const k = keys.find((x) => x.id === id && !x.revokedAt);
    if (!k) throw notFound('Widget key not found');
    k.revokedAt = this.iso();
    this.write(sub, this.prune(keys));
  }

  /** The person a presented key belongs to; throws 401 for an unknown or revoked one. Records the use at most hourly. */
  authenticate(key: string | undefined): { sub: string; id: string } {
    const m = /^cwk_([A-Za-z0-9_-]{8})_([A-Za-z0-9_-]{43})$/.exec(key ?? '');
    const sub = m ? this.owners.get(m[1]!) : undefined;
    if (!m || !sub) throw invalid();
    const keys = this.files.read(sub).keys;
    const k = keys.find((x) => x.id === m[1]);
    const hash = k ? Buffer.from(k.hash, 'hex') : null;
    if (!k || !hash || hash.length !== 32 || !timingSafeEqual(hash, sha256(m[2]!))) throw invalid();
    if (k.revokedAt) throw Date.parse(k.revokedAt) + REVOKED_KEPT_MS > this.nowMs() ? revoked() : invalid();
    if (k.lastUsedAt === null || Date.parse(k.lastUsedAt) + LAST_USED_EVERY_MS <= this.nowMs()) {
      k.lastUsedAt = this.iso();
      this.write(sub, keys);
    }
    return { sub, id: k.id };
  }

  /** Test hook: sets when a key was last used (`null` = never). */
  setLastUsed(sub: string, id: string, at: string | null): void {
    const keys = this.files.read(sub).keys;
    const k = keys.find((x) => x.id === id);
    if (!k) throw notFound('Widget key not found');
    k.lastUsedAt = at;
    this.write(sub, keys);
  }

  /** Forgets every person's keys (test reset). */
  reset(): void {
    this.files.reset();
    this.owners.clear();
  }

  private prune(keys: KeyRecord[]): KeyRecord[] {
    return keys.filter((k) => !k.revokedAt || Date.parse(k.revokedAt) + REVOKED_KEPT_MS > this.nowMs());
  }
}
