/**
 * The Android app's native `Reminders` plugin (`android/…/notify/RemindersPlugin.java`): reminders scheduled ahead that
 * show as system notifications when the app is not in the foreground. Absent in a browser; reached through
 * `window.Capacitor.Plugins` like the widget bridge, so the web bundle needs no Capacitor dependency.
 */
export interface RemindersPlugin {
  schedule(o: { id: string; at: number; title: string; body: string }): Promise<unknown>;
  cancel(o: { id: string }): Promise<unknown>;
  /** The ids of every reminder the plugin still holds. */
  list(): Promise<{ ids: string[] }>;
}

/** The plugin inside the Android app, null in a browser. */
export function remindersPlugin(): RemindersPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: { Reminders?: RemindersPlugin } } }).Capacitor;
  return cap?.Plugins?.Reminders ?? null;
}
