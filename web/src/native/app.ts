/** Whether the page runs inside the Capacitor Android app, and what the Settings download row is called there. */

/** Whether the page runs inside the Capacitor app. */
export function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap && (cap.isNativePlatform?.() ?? true);
}

/** i18n key of the Settings row label: in a browser the row offers the app ("Android app"), inside the app it updates it. */
export function androidAppLabelKey(inApp: boolean): 'settings.account.androidApp.label' | 'settings.account.androidApp.updateLabel' {
  return inApp ? 'settings.account.androidApp.updateLabel' : 'settings.account.androidApp.label';
}

/** The app's own plugin (named `ServerChoice` for history; the server is no longer chosen). */
interface ServerChoicePlugin {
  /** Added with the update hint; an APK installed before it has no such method. */
  appVersion?(): Promise<{ versionCode?: number }>;
}

function serverChoice(): ServerChoicePlugin | undefined {
  return (window as unknown as { Capacitor?: { Plugins?: { ServerChoice?: ServerChoicePlugin } } }).Capacitor?.Plugins?.ServerChoice;
}

/** Starts the APK download (`GET /app.apk`, served by the server, excluded from the service worker's fallback). */
export function downloadApk(): void { location.href = '/app.apk'; }

/**
 * The `versionCode` of the installed app, or null outside the app. An APK that predates the version bridge cannot tell, so
 * it counts as 0: any published APK is newer and offers itself once, and the APK it installs reports its own code.
 */
export async function installedVersionCode(): Promise<number | null> {
  if (!isNativeApp()) return null;
  try {
    const code = (await serverChoice()?.appVersion?.())?.versionCode;
    return Number.isInteger(code) ? (code as number) : 0;
  } catch {
    return 0;
  }
}
