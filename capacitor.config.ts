import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android shell for the self-hosted calendar (ARCHITECTURE "Android app and widget"): a Capacitor WebView that loads the
 * calendar server the person chose. `server.url` is static in Capacitor, so it is NOT set here: `MainActivity` builds the
 * runtime config with the chosen server as `server.url` (or none, which shows the bundled chooser page). `webDir` holds
 * that chooser (`index.html`) and the offline page (`error.html`).
 */
const config: CapacitorConfig = {
  appId: 'lan.mordor.calendar',
  appName: "Fresh-D's Kalender",
  webDir: 'android/www',
};

export default config;
