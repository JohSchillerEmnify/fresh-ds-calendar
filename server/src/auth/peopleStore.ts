import path from 'node:path';
import type { Person } from '../api/types.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import { mockSub } from './people.js';

interface Known { email: string; name?: string }

/**
 * The people who signed in at least once, `sub -> { email, name }` in `DATA_DIR/people.json`. Sharing needs it:
 * the allow-list holds emails, lists belong to subs (feature shared-lists).
 */
export class PeopleStore {
  private readonly file: string | null;
  private known!: Record<string, Known>;

  constructor(dataDir: string | null) {
    this.file = dataDir ? path.join(dataDir, 'people.json') : null;
    this.reload();
  }

  /** Reads the file again (start, and after a backup restore replaced it). */
  reload(): void {
    this.known = (this.file && readJson<Record<string, Known>>(this.file)) || {};
  }

  /** Remembers (or refreshes) a person; the address is kept lower-case. */
  record(sub: string, email: string, name?: string): void {
    const cur = this.known[sub];
    const next: Known = { email: email.trim().toLowerCase(), ...(name ? { name } : cur?.name ? { name: cur.name } : {}) };
    if (cur && cur.email === next.email && cur.name === next.name) return;
    this.known[sub] = next;
    if (this.file) writeJsonAtomic(this.file, this.known);
  }

  /** TEST_MODE: knows an address as if it had signed in once (the sub and the name, the part before the `@`, are the mock account's). */
  recordMock(email: string): void {
    this.record(mockSub(email), email, email.split('@')[0]);
  }

  /** The person with this sub, or null when nobody with it signed in. */
  get(sub: string): Person | null {
    // own keys only: a sub from a request body like `constructor` must not find an inherited property
    const k = Object.hasOwn(this.known, sub) ? this.known[sub] : undefined;
    if (!k) return null;
    const name = k.name || k.email;
    return { sub, name, email: k.email, initial: (name.trim()[0] ?? '?').toUpperCase() };
  }

  /** Every known person. */
  all(): Person[] {
    return Object.keys(this.known).map((s) => this.get(s)!);
  }

  /** Forgets everybody (test reset). */
  reset(): void {
    this.known = {};
    if (this.file) writeJsonAtomic(this.file, this.known);
  }
}
