import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android shell for the self-hosted calendar (ARCHITECTURE "Android app and widget"): a Capacitor WebView that loads the
 * configured calendar server. Its URL is set by `MainActivity` from `ServerConfig.BASE_URL`, the one place
 * the widget reads it too, so it is not repeated here. `webDir` holds the (unused) start page and the offline page
 * (`error.html`).
 */
const config: CapacitorConfig = {
  appId: 'lan.mordor.calendar',
  appName: "Fresh-D's Kalender",
  webDir: 'android/www',
};

export default config;
