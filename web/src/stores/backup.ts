import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, ApiError } from '@/api/client';
import type { BackupStatus } from '@/api/types';
import { dateLocale, t } from '@/i18n';
import { RETURN_KEY } from '@/stores/auth';

/** What a backup or restore call came to: `ok`, or the reason to show. */
export interface BackupResult { ok: boolean; message: string }

/**
 * Backup to Google Drive (feature drive-backup): the status Settings shows and the three actions. A failed call never
 * throws; it returns the reason and the status is read again, so "Last backup failed: … (retrying)" shows up.
 */
export const useBackupStore = defineStore('backup', () => {
  const status = ref<BackupStatus | null>(null);
  const busy = ref<'backup' | 'restore' | null>(null);

  /** Reads the status; a failure leaves the block hidden (backups are never needed to use the app). */
  async function load(): Promise<void> {
    try { status.value = await api.backup(); } catch { /* keep the old status */ }
  }

  /** "Back up now". */
  async function backupNow(): Promise<BackupResult> {
    busy.value = 'backup';
    try {
      status.value = await api.backupNow();
      return { ok: true, message: '' };
    } catch (e) {
      await load();
      return { ok: false, message: e instanceof ApiError ? e.message : String(e) };
    } finally {
      busy.value = null;
    }
  }

  /** Restores the newest backup; the page reloads on success so every store reads the restored data. */
  async function restore(): Promise<BackupResult> {
    busy.value = 'restore';
    try {
      await api.backupRestore();
      window.location.reload();
      return { ok: true, message: '' };
    } catch (e) {
      busy.value = null;
      await load();
      if (e instanceof ApiError && e.code === 'NO_BACKUP') return { ok: false, message: t('backup.restoreNone') };
      return { ok: false, message: t('backup.restoreFailed', { reason: e instanceof ApiError ? e.message : String(e) }) };
    }
  }

  /** Re-runs the Google consent (it now asks for the Drive permission) and comes back to the settings. */
  function allow(): void {
    try { sessionStorage.setItem(RETURN_KEY, '/settings'); } catch { /* private mode: lands on the start page */ }
    window.location.assign('/api/auth/google/start');
  }

  /** "12 Oct 2026, 08:00" in the app's date format and the calendar's time zone. */
  function formatTime(iso: string, timeZone: string): string {
    return new Intl.DateTimeFormat(dateLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(iso));
  }

  return { status, busy, load, backupNow, restore, allow, formatTime };
});
