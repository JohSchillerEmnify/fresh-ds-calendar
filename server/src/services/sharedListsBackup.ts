/**
 * Backup adapter for the shared lists store (`DATA_DIR/shared/lists/<id>.json`, each with `owner` and `members` subs).
 * It reads and writes those files directly, so it needs nothing from the store's code. Rules (coordinator, 2026-10-13):
 * the OWNER's backup holds the lists they own; a member's backup records only the ids of the lists they belong to
 * (`shared/memberships/<sub>.json`); a restore recreates the lists the restoring person owns and leaves the rest.
 * Wiring: the shared-lists merge adds the one line `registerSharedListsBackup(backup, shared, config.dataDir);`.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { BackupService } from './backupService.js';
import { logEvent } from '../lib/diag.js';
import { isSharedListDoc, type SharedListService } from './sharedLists.js';

interface ListFile { owner?: unknown; members?: unknown }

/** Registers the shared-lists source (prefix `shared`) with the backup service. */
export function registerSharedListsBackup(backup: BackupService, shared: SharedListService, dataDir: string): void {
  const dir = path.join(dataDir, 'shared', 'lists');
  /** Every list file as `{ id, text, owner, members }`; unreadable files are skipped. */
  const lists = () => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((f) => {
      try {
        const text = fs.readFileSync(path.join(dir, f), 'utf8');
        const d = JSON.parse(text) as ListFile;
        return [{ id: f.slice(0, -5), text, owner: d.owner, members: Array.isArray(d.members) ? d.members : [] }];
      } catch {
        return [];
      }
    });
  };
  backup.registerSource({
    prefix: 'shared',
    // the store caches the lists, so it reads them again after a restore
    reload: () => shared.reload(),
    collect(sub) {
      const out: Record<string, string> = {};
      const member: string[] = [];
      for (const l of lists()) {
        if (l.owner === sub) out[`shared/lists/${l.id}.json`] = l.text;
        else if (l.members.includes(sub)) member.push(l.id);
      }
      if (member.length) out[`shared/memberships/${sub}.json`] = JSON.stringify({ listIds: member.sort() });
      return out;
    },
    restore(sub, files) {
      for (const [rel, text] of Object.entries(files)) {
        const m = /^shared\/lists\/([A-Za-z0-9_-]{1,32})\.json$/.exec(rel);
        if (!m) continue;
        // only lists the restoring person owns come back, and the file name must be the list's own id
        let doc: unknown;
        try { doc = JSON.parse(text); } catch { continue; }
        // the same shape check the store applies on load, so a restore cannot plant a file that breaks other people's lists
        if (!isSharedListDoc(doc)) { logEvent('shared_list_restore_skipped', { file: rel, reason: 'invalid' }); continue; }
        if (doc.owner !== sub || doc.id !== m[1]) continue;
        const abs = path.join(dataDir, ...rel.split('/'));
        // a list that exists now and belongs to somebody else is never overwritten
        try { if ((JSON.parse(fs.readFileSync(abs, 'utf8')) as ListFile).owner !== sub) continue; } catch { /* no readable file there: free to write */ }
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(`${abs}.tmp`, text);
        fs.renameSync(`${abs}.tmp`, abs);
      }
    },
  });
}
