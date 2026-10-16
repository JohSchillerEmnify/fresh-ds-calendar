import fs from 'node:fs';
import path from 'node:path';
import type { CategoryInfo, Person, SharedInfo } from '../api/types.js';
import type { PeopleStore } from '../auth/peopleStore.js';
import { readJson, writeJsonAtomic } from '../lib/atomicJson.js';
import type { Clock } from '../lib/clock.js';
import { forbidden, notFound, validation } from '../lib/errors.js';
import { nanoid } from '../lib/ids.js';
import { formatInZone } from '../lib/time.js';
import type { TaskListData } from './taskCodec.js';

/** Prefix of a shared list's API id (`shared:<id>`) and its `calendarId` (A-162). */
export const SHARED_PREFIX = 'shared:';
export const SHARED_CALENDAR = 'shared';
export const isSharedId = (id: string): boolean => id.startsWith(SHARED_PREFIX);

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

/** One shared list, as stored: a whole document per list so a later backup can copy the files as they are. */
export interface SharedListDoc {
  version: 1;
  id: string;
  /** Version counter; the list's etag. Every write bumps it. */
  rev: number;
  /** Google `sub` of the owner. */
  owner: string;
  /** Google `sub`s of the other people on the list. */
  members: string[];
  updated: string;
  /** The list itself; `categoryId` is the owner's category. */
  data: TaskListData;
  /** The owner's category as it looked when last written, so members see its name, colour and icon. */
  category: CategoryInfo | null;
}

/** Who may be added to a list: the allow-list check, or null while sign-in is off. */
export type AllowCheck = () => ((email: string) => boolean) | null;

/**
 * Shared task lists (ARCHITECTURE "Shared lists"): the store (`DATA_DIR/shared/lists/<id>.json`), the membership checks
 * and the category rules (`DATA_DIR/shared/category-shares.json`). It knows nothing of Google: the owner's
 * {@link CalendarService} moves lists in and out.
 */
export class SharedListService {
  private readonly dir: string;
  private readonly rulesFile: string;
  private docs = new Map<string, SharedListDoc>();
  /** `owner sub -> { category id -> member sub }`. */
  private rules: Record<string, Record<string, string>> = {};

  constructor(
    dataDir: string,
    private readonly people: PeopleStore,
    private readonly clock: Clock,
    private readonly tz: string,
    private readonly allow: AllowCheck,
  ) {
    this.dir = path.join(dataDir, 'shared', 'lists');
    this.rulesFile = path.join(dataDir, 'shared', 'category-shares.json');
    this.load();
  }

  /** Reads every list and the category rules again (after a backup restore wrote files behind the store's back). */
  reload(): void {
    this.load();
  }

  private load(): void {
    this.docs.clear();
    this.rules = readJson<Record<string, Record<string, string>>>(this.rulesFile) ?? {};
    if (!fs.existsSync(this.dir)) return;
    for (const f of fs.readdirSync(this.dir)) {
      const doc = f.endsWith('.json') ? readJson<SharedListDoc>(path.join(this.dir, f)) : null;
      if (doc && ID_RE.test(doc.id)) this.docs.set(doc.id, doc);
    }
  }

  private file(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  private stamp(): string {
    return formatInZone(this.clock.real(), this.tz);
  }

  // ---------- access ----------
  /** False for a person who is known and no longer on the allow-list (removed people see nothing); true while sign-in is off or the person is unknown. */
  permitted(sub: string): boolean {
    const allows = this.allow();
    const known = this.people.get(sub);
    return !allows || !known || allows(known.email);
  }

  /** The list with this API id (`shared:<id>`) when the person owns it or is a member; anyone else gets 404. */
  access(sub: string, apiId: string): SharedListDoc {
    const doc = isSharedId(apiId) ? this.docs.get(apiId.slice(SHARED_PREFIX.length)) : undefined;
    if (!doc || !this.permitted(sub) || (doc.owner !== sub && !doc.members.includes(sub))) throw notFound('Task list not found');
    return doc;
  }

  /** Like {@link access}, and the person must be the owner (else 403). */
  accessOwned(sub: string, apiId: string): SharedListDoc {
    const doc = this.access(sub, apiId);
    if (doc.owner !== sub) throw forbidden('Only the owner can do this', 'sharing.ownerOnly');
    return doc;
  }

  /** Every list the person owns or is a member of. */
  visibleTo(sub: string): SharedListDoc[] {
    if (!this.permitted(sub)) return [];
    return [...this.docs.values()].filter((d) => d.owner === sub || d.members.includes(sub));
  }

  /** The person's own lists of one category. */
  ownedInCategory(owner: string, categoryId: string): SharedListDoc[] {
    return [...this.docs.values()].filter((d) => d.owner === owner && d.data.categoryId === categoryId);
  }

  // ---------- people ----------
  /** The person as the UI shows them (a placeholder for a sub nobody signed in with). */
  person(sub: string): Person {
    return this.people.get(sub) ?? { sub, name: '?', email: '', initial: '?' };
  }

  /** Who `sub` sees on the list: the owner's view of the members, a member's view of everyone else. */
  info(doc: SharedListDoc, sub: string): SharedInfo {
    const others = [doc.owner, ...doc.members].filter((s) => s !== sub);
    return { owned: doc.owner === sub, owner: this.person(doc.owner), with: others.map((s) => this.person(s)) };
  }

  /** The allowed, known people other than `sub` (the picker of "Share with ..."). */
  candidates(sub: string): Person[] {
    const allows = this.allow();
    if (!allows) return [];
    return this.people.all().filter((p) => p.sub !== sub && allows(p.email));
  }

  /** The person to add as a member: allowed, known and not the owner, else a 400. */
  requireMember(owner: string, sub: string): Person {
    const allows = this.allow();
    if (!allows) throw validation('Sharing needs sign-in', 'person', 'sharing.needsSignIn');
    if (sub === owner) throw validation('You cannot share with yourself', 'person', 'sharing.self');
    const p = this.people.get(sub);
    if (!p || !allows(p.email)) throw validation('This person cannot be added', 'person', 'sharing.unknownPerson');
    return p;
  }

  // ---------- writes ----------
  /** Stores a new list. */
  create(owner: string, members: string[], data: TaskListData, category: CategoryInfo | null): SharedListDoc {
    const doc: SharedListDoc = { version: 1, id: nanoid(12), rev: 1, owner, members: [...new Set(members)], updated: this.stamp(), data, category };
    this.persist(doc);
    return doc;
  }

  /** Replaces the list's content (and optionally its category look) and bumps the version. Synchronous, so atomic. */
  save(doc: SharedListDoc, data: TaskListData, category: CategoryInfo | null | undefined = undefined): SharedListDoc {
    doc.data = data;
    if (category !== undefined) doc.category = category;
    return this.touch(doc);
  }

  /** Replaces the members and bumps the version. */
  setMembers(doc: SharedListDoc, members: string[]): SharedListDoc {
    doc.members = [...new Set(members)];
    return this.touch(doc);
  }

  /** Deletes the list for everybody. */
  remove(doc: SharedListDoc): void {
    this.docs.delete(doc.id);
    fs.rmSync(this.file(doc.id), { force: true });
  }

  private touch(doc: SharedListDoc): SharedListDoc {
    doc.rev += 1;
    doc.updated = this.stamp();
    this.persist(doc);
    return doc;
  }

  private persist(doc: SharedListDoc): void {
    this.docs.set(doc.id, doc);
    writeJsonAtomic(this.file(doc.id), doc);
  }

  /** The owner's category changed: members see the new look. `null` = the category is gone (lists lose it). */
  refreshCategory(owner: string, categoryId: string, info: CategoryInfo | null): void {
    for (const d of this.ownedInCategory(owner, categoryId)) {
      d.category = info;
      if (!info) d.data = { ...d.data, categoryId: null };
      this.touch(d);
    }
    if (!info) this.setRule(owner, categoryId, null);
  }

  // ---------- category rules ----------
  /** Who the owner shares a category with (the member's sub), or null. */
  ruleFor(owner: string, categoryId: string): string | null {
    return this.rules[owner]?.[categoryId] ?? null;
  }

  /** The owner's rules, `category id -> Person`. */
  rulesOf(owner: string): Record<string, Person> {
    return Object.fromEntries(Object.entries(this.rules[owner] ?? {}).map(([c, s]) => [c, this.person(s)]));
  }

  setRule(owner: string, categoryId: string, member: string | null): void {
    const mine = { ...(this.rules[owner] ?? {}) };
    if (member) mine[categoryId] = member;
    else delete mine[categoryId];
    if (Object.keys(mine).length) this.rules[owner] = mine;
    else delete this.rules[owner];
    writeJsonAtomic(this.rulesFile, this.rules);
  }

  /** Forgets everything (test reset). */
  reset(): void {
    this.docs.clear();
    this.rules = {};
    fs.rmSync(path.join(path.dirname(this.dir)), { recursive: true, force: true });
  }
}
