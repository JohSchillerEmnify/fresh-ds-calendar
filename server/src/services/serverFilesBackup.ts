/**
 * The server-wide files that belong to no single person (the people who signed in, category share rules) and go into
 * every person's backup under `server/` (feature drive-backup). They come back only onto a fresh server, so a restore never overwrites what other people already use.
 */
import type { PeopleStore } from '../auth/peopleStore.js';
import type { BackupService } from './backupService.js';
import type { SharedListService } from './sharedLists.js';

const parse = (c: string | null): Record<string, unknown> | null => {
  try { return c === null ? null : (JSON.parse(c) as Record<string, unknown>); } catch { return null; }
};

/** Only the person's own entry of a `sub -> ...` file: a backup must not carry the addresses or share rules of everybody else. */
const ownEntry = (c: string, sub: string): string | null => {
  const d = parse(c);
  if (!d) return null;
  return JSON.stringify(Object.hasOwn(d, sub) ? { [sub]: d[sub] } : {});
};

/** Registers the two server-wide files. Another server-wide store adds one `registerServerFile` call. */
export function registerServerFilesBackup(
  backup: BackupService,
  stores: { people: PeopleStore; shared: SharedListService },
): void {
  // the person who just signed in is always there; anybody else means the server is in use
  backup.registerServerFile({
    rel: 'people.json', pristine: (c, sub) => Object.keys(parse(c) ?? {}).every((s) => s === sub), reload: () => stores.people.reload(),
    collect: (c, sub) => ownEntry(c, sub),
  });
  backup.registerServerFile({
    rel: 'shared/category-shares.json', pristine: (c) => Object.keys(parse(c) ?? {}).length === 0, reload: () => stores.shared.reload(),
    collect: (c, sub) => ownEntry(c, sub),
  });
}
