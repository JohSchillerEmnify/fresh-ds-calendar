import { isRecord, PersonJsonStore } from '../lib/personJsonStore.js';

/** Most addresses one person keeps; the oldest go first. */
const MAX = 200;

interface Doc { version: 1; emails: string[] }

/** The addresses a person shared with by typing them (`users/<sub>/share-contacts.json`): only they are offered them again. */
export class ShareContacts {
  private readonly files: PersonJsonStore<Doc>;

  constructor(dataDir: string) {
    this.files = new PersonJsonStore<Doc>(dataDir, 'share-contacts.json',
      (r) => (isRecord(r) && Array.isArray(r.emails) ? { version: 1, emails: r.emails.filter((e): e is string => typeof e === 'string') } : null),
      () => ({ version: 1, emails: [] }));
  }

  /** The person's remembered addresses, lower case. */
  list(sub: string): string[] {
    return this.files.read(sub).emails;
  }

  /** Remembers an address (already trimmed and lower-cased) as the newest one. */
  remember(sub: string, email: string): void {
    const kept = this.list(sub).filter((e) => e !== email);
    this.files.write(sub, { version: 1, emails: [...kept, email].slice(-MAX) });
  }

  /** Forgets everybody's addresses (test reset). */
  reset(): void {
    this.files.reset();
  }
}
