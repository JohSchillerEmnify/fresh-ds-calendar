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
