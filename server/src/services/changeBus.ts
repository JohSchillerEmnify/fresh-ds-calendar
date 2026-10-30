/**
 * The one place every successful write of the API is reported (ADR 0025 slice 1, ADR 0030): who is affected and what kind
 * of data changed. Nothing here sends anything; a publisher (the live "changed" stream) subscribes with {@link ChangeBus.on}.
 */

/** The kinds of data a write can change; they mirror the parts of `GET /api/changes`. */
export type ChangeKind =
  | 'events' | 'taskLists' | 'calendars' | 'settings' | 'prefs' | 'theme' | 'themes' | 'templates' | 'canvas' | 'motivation' | 'shares';

/** Every kind, for a write that may change anything (a restore, a demo reset). */
export const ALL_KINDS: readonly ChangeKind[] = ['events', 'taskLists', 'calendars', 'settings', 'prefs', 'theme', 'themes', 'templates', 'canvas', 'motivation', 'shares'];

export interface ChangeEvent {
  /** Google `sub`s of the people whose data changed (the person's own, plus the members of a shared list). */
  subs: string[];
  kind: ChangeKind;
}

export type ChangeListener = (e: ChangeEvent) => void;

/** A tiny synchronous publish/subscribe; a throwing listener never breaks the write that was reported. */
export class ChangeBus {
  private listeners = new Set<ChangeListener>();

  /** Subscribes; returns the function that unsubscribes. */
  on(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Reports a write that may have changed every kind of data. */
  emitAll(subs: string[]): void {
    for (const k of ALL_KINDS) this.emit(subs, k);
  }

  /** Reports one successful write to every listener (a call with no people is ignored). */
  emit(subs: string[], kind: ChangeKind): void {
    if (!subs.length) return;
    const e: ChangeEvent = { subs: [...new Set(subs)], kind };
    for (const l of this.listeners) {
      try {
        l(e);
      } catch {
        // a listener's failure must not fail the request
      }
    }
  }
}

/** The kinds of data a write to this API path changes (path below `/api`); empty for paths that change no synced data. */
export function kindsOfPath(path: string): ChangeKind[] {
  const seg = path.split('/').filter(Boolean);
  const [a, b] = [seg[0], seg[2]];
  // a category change also restyles the shared lists of that category; sharing a category moves lists
  if (a === 'categories') return b === 'share' ? ['shares', 'taskLists'] : ['settings', 'taskLists'];
  if (a === 'tasklists') return ['taskLists'];
  if (a === 'reminders') return ['calendars'];
  if (a === 'prefs') return [seg[1] === 'theme' ? 'theme' : 'prefs'];
  const direct: Record<string, ChangeKind> = { events: 'events', calendars: 'calendars', themes: 'themes', templates: 'templates', canvas: 'canvas', settings: 'settings', streak: 'motivation' };
  const k = a ? direct[a] : undefined;
  return k ? [k] : [];
}
