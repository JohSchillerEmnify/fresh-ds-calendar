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

interface ServerChoicePlugin {
  get(): Promise<{ url?: string; host?: string }>;
  choose(): Promise<unknown>;
}

function serverChoice(): ServerChoicePlugin | undefined {
  return (window as unknown as { Capacitor?: { Plugins?: { ServerChoice?: ServerChoicePlugin } } }).Capacitor?.Plugins?.ServerChoice;
}

/** The host of the server the native app runs on (`cal.example.org`), or null outside the app or when it cannot be read. */
export async function nativeServerHost(): Promise<string | null> {
  try {
    return (await serverChoice()?.get())?.host ?? null;
  } catch {
    return null;
  }
}

/** Forgets the server choice: the native app returns to its "Which calendar?" page. */
export async function changeNativeServer(): Promise<void> {
  await serverChoice()?.choose();
}
