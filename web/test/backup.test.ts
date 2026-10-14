import { beforeEach, describe, expect, it } from 'vitest';
import { useBackupStore } from '@/stores/backup';
import { apiError, freshPinia, mockFetch } from './helpers';

const status = (o: Record<string, unknown> = {}) => ({ available: true, permission: 'granted', state: 'ok', lastBackupAt: '2026-10-12T06:00:00.000Z', error: null, keep: 7, ...o });

beforeEach(() => { freshPinia(); });

describe('backup store', () => {
  it('formats the last backup in the calendar time zone', () => {
    expect(useBackupStore().formatTime('2026-10-12T06:00:00.000Z', 'Europe/Berlin')).toBe('12 Oct 2026, 08:00');
  });

  it('shows the new status after "Back up now"', async () => {
    mockFetch({ 'POST /api/backup': () => status({ lastBackupAt: '2026-10-12T07:30:00.000Z' }) });
    const s = useBackupStore();
    expect(await s.backupNow()).toEqual({ ok: true, message: '' });
    expect(s.status?.lastBackupAt).toBe('2026-10-12T07:30:00.000Z');
    expect(s.busy).toBeNull();
  });

  it('returns the reason of a failed backup and reads the failed status instead of throwing', async () => {
    mockFetch({
      'POST /api/backup': () => apiError(502, 'BACKUP_FAILED', 'Google Drive is unavailable'),
      'GET /api/backup': () => status({ state: 'failed', error: 'Google Drive is unavailable' }),
    });
    const s = useBackupStore();
    expect(await s.backupNow()).toEqual({ ok: false, message: 'Google Drive is unavailable' });
    expect(s.status).toMatchObject({ state: 'failed', error: 'Google Drive is unavailable' });
  });

  it('keeps the old status when the status cannot be read', async () => {
    mockFetch({ 'GET /api/backup': () => status() });
    const s = useBackupStore();
    await s.load();
    mockFetch({ 'GET /api/backup': () => apiError(500, 'INTERNAL') });
    await s.load();
    expect(s.status?.state).toBe('ok');
  });

  it('says so when there is nothing to restore', async () => {
    mockFetch({ 'POST /api/backup/restore': () => apiError(404, 'NO_BACKUP'), 'GET /api/backup': () => status({ state: 'never', lastBackupAt: null }) });
    const r = await useBackupStore().restore();
    expect(r.ok).toBe(false);
    expect(r.message).toBe('There is no backup yet');
  });
});
