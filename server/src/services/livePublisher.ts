/**
 * The live "changed" publisher (ADR 0030): keeps the open Server-Sent Events connections of every person in memory and
 * forwards each {@link ChangeBus} event to the connections of the people it names. A nudge carries only the kind of data.
 */
import type { ChangeBus, ChangeKind } from './changeBus.js';

/** One open stream of one app. */
export interface LiveConnection {
  sub: string;
  /** The session cookie it was opened with, so a sign-out can end it (null while sign-in is off). */
  session: string | null;
  send(kind: ChangeKind): void;
  close(): void;
}

export interface LivePublisherOptions {
  /** Most connections one person may hold open at once. */
  maxPerPerson: number;
  /** A person's first connection opened. */
  onFirst(sub: string): void;
  /** A person's last connection closed. */
  onLast(sub: string): void;
}

export class LivePublisher {
  private readonly byPerson = new Map<string, Set<LiveConnection>>();

  constructor(bus: ChangeBus, private readonly opts: LivePublisherOptions) {
    bus.on((e) => this.publish(e.subs, e.kind));
  }

  /** Registers a connection; returns the function that removes it, or null when the person is at the limit. */
  add(conn: LiveConnection): (() => void) | null {
    let set = this.byPerson.get(conn.sub);
    if (set && set.size >= this.opts.maxPerPerson) return null;
    if (!set) this.byPerson.set(conn.sub, (set = new Set()));
    set.add(conn);
    if (set.size === 1) this.opts.onFirst(conn.sub);
    return () => this.remove(conn);
  }

  /** Sends one nudge to every connection of the given people. */
  publish(subs: string[], kind: ChangeKind): void {
    for (const sub of subs) for (const c of this.byPerson.get(sub) ?? []) {
      try {
        c.send(kind);
      } catch {
        // a broken stream must not stop the others
      }
    }
  }

  /** Whether the person has an app connected. */
  has(sub: string): boolean {
    return (this.byPerson.get(sub)?.size ?? 0) > 0;
  }

  /** Ends the connections opened with this session cookie (sign-out). */
  endSession(session: string | undefined): void {
    if (!session) return;
    for (const set of this.byPerson.values()) for (const c of [...set]) if (c.session === session) c.close();
  }

  /** Ends every connection of the person (sign out everywhere, access withdrawn). */
  endPerson(sub: string): void {
    for (const c of [...(this.byPerson.get(sub) ?? [])]) c.close();
  }

  /** Ends everything (server shutdown, test reset). */
  closeAll(): void {
    for (const set of this.byPerson.values()) for (const c of [...set]) c.close();
  }

  private remove(conn: LiveConnection): void {
    const set = this.byPerson.get(conn.sub);
    if (!set?.delete(conn)) return;
    if (set.size === 0) {
      this.byPerson.delete(conn.sub);
      this.opts.onLast(conn.sub);
    }
  }
}
