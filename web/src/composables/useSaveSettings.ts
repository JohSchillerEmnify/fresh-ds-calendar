import { ApiError } from '@/api/client';
import { t } from '@/i18n';
import type { Prefs } from '@/api/types';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';

/**
 * The one way a settings screen persists a patch (Settings, Theme): failures roll back in the store and surface as the
 * sync banner (server or Google unreachable) or a snackbar (anything else).
 */
export function useSaveSettings() {
  const settings = useSettingsStore();
  const sync = useSyncStore();
  const ui = useUiStore();
  return async function save(p: Parameters<typeof settings.patch>[0]): Promise<void> {
    try {
      await settings.patch(p);
    } catch (e) {
      if (e instanceof ApiError && e.isUnavailable) sync.reportError(e);
      else ui.notify(e instanceof ApiError ? e.userMessage : t('settings.saveFailed'));
    }
  };
}

/** The one way a settings screen persists a per-person preference; a refusal rolls back in the store and shows a snackbar. */
export function useSavePrefs() {
  const prefs = usePrefsStore();
  const ui = useUiStore();
  return async function savePrefs(p: Partial<Prefs>): Promise<void> {
    try { await prefs.set(p); } catch (e) { ui.notify(e instanceof ApiError ? e.userMessage : t('settings.saveFailed')); }
  };
}
