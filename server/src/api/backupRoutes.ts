import { Hono, type Context } from 'hono';
import type { Ctx } from '../context.js';
import { ApiException } from '../lib/errors.js';
import { BackupError } from '../services/backupService.js';

/** Maps a backup failure to the API error of API.md "Backups". */
function toApi(e: unknown): unknown {
  if (!(e instanceof BackupError)) return e;
  if (e.code === 'PERMISSION') return new ApiException('DRIVE_PERMISSION_REQUIRED', 403, e.message);
  if (e.code === 'NO_BACKUP') return new ApiException('NO_BACKUP', 404, e.message);
  return new ApiException('BACKUP_FAILED', 502, e.message);
}

/** Backups of the signed-in person's server data to Google Drive (API.md "Backups"). */
export function backupRoutes(ctx: Ctx): Hono {
  const r = new Hono();
  const sub = (c: Context): string => {
    // backups need a Google account, so there is nothing to do while sign-in is off
    const p = ctx.auth.on ? (c.get('person') as { sub: string } | undefined) : undefined;
    if (!p) throw new ApiException('NOT_FOUND', 404, 'Not found');
    return p.sub;
  };

  r.get('/backup', (c: Context) => {
    const p = ctx.auth.on ? (c.get('person') as { sub: string } | undefined) : undefined;
    return c.json(p ? ctx.backup.status(p.sub) : ctx.backup.status('local'));
  });
  r.post('/backup', async (c) => {
    try {
      return c.json(await ctx.backup.backupNow(sub(c)));
    } catch (e) {
      throw toApi(e);
    }
  });
  r.post('/backup/restore', async (c) => {
    try {
      return c.json(await ctx.backup.restore(sub(c)));
    } catch (e) {
      throw toApi(e);
    }
  });
  return r;
}
