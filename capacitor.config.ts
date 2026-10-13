import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android shell for the self-hosted calendar (ARCHITECTURE "Android app and widget"): a Capacitor WebView that loads
 * the LAN deploy. `webDir` only holds the offline error page; the app itself is the remote URL.
 */
const config: CapacitorConfig = {
  appId: 'lan.mordor.calendar',
  appName: 'Calendar',
  webDir: 'android/www',
  server: {
    url: 'http://cal.mordor.lan',
    // plain HTTP is allowed for this host only, through android/app/src/main/res/xml/network_security_config.xml
    errorPath: 'error.html',
  },
};

export default config;
