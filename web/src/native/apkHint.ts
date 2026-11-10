/** The "New app version – Download" hint: when the server offers a newer APK than the installed one, and the "Later" memory. */
import { t } from '@/i18n';
import { useUiStore } from '@/stores/ui';
import { downloadApk, installedVersionCode } from '@/native/app';

const KEY = 'cal.apkHintDismissed';
let shown: number | null = null;

/** Whether to offer `offered`: it is newer than the installed one and not dismissed already (`dismissed` = highest code the person said "Later" to). */
export function shouldOfferApk(installed: number, offered: number, dismissed: number): boolean {
  return offered > installed && offered > dismissed;
}

/** The highest `versionCode` the person dismissed (0 = none, or storage unavailable). */
export function dismissedApk(): number {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
}

/** Remember that the person said "Later" to `versionCode`: it is not offered again, a newer one is. */
export function rememberApkDismissed(versionCode: number): void {
  try { localStorage.setItem(KEY, String(versionCode)); } catch { /* storage unavailable: it is offered again next time */ }
}

/** Snackbar id of the hint on screen, so a sync does not stack a second one. */
export function apkHintVisible(): boolean {
  return shown !== null && useUiStore().snackbars.some((s) => s.id === shown);
}

/** Show the hint once per new APK inside the Android app; never in a browser, never without an offered APK. `force` ignores "Later" (manual check); true when a newer APK is on offer. */
export async function checkApk(apk: { versionCode: number; versionName: string } | null | undefined, force = false): Promise<boolean> {
  if (!apk) return false;
  if (apkHintVisible()) return true;
  const installed = await installedVersionCode();
  if (installed === null || !shouldOfferApk(installed, apk.versionCode, force ? 0 : dismissedApk())) return false;
  if (apkHintVisible()) return true;
  const ui = useUiStore();
  shown = ui.notify(t('calendar.apk.available'), {
    duration: 0, testid: 'apk-available',
    // "Download" counts like "Later": the installed APK reads as old until the new one is installed, so it must not come back
    action: { label: t('calendar.apk.download'), testid: 'apk-download', run: () => { rememberApkDismissed(apk.versionCode); downloadApk(); } },
    onClose: () => rememberApkDismissed(apk.versionCode),
  });
  return true;
}
