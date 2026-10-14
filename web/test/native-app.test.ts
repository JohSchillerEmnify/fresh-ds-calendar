import { afterEach, describe, expect, it } from 'vitest';
import { androidAppLabelKey, changeNativeServer, isNativeApp, nativeServerHost } from '@/native/app';
import { t } from '@/i18n';

describe('Android app row label', () => {
  afterEach(() => { delete (window as unknown as { Capacitor?: unknown }).Capacitor; });

  it('offers the app in a browser and updates it inside the app', () => {
    expect(androidAppLabelKey(false)).toBe('settings.account.androidApp.label');
    expect(androidAppLabelKey(true)).toBe('settings.account.androidApp.updateLabel');
  });

  it('detects the Capacitor app by window.Capacitor', () => {
    expect(isNativeApp()).toBe(false);
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true };
    expect(isNativeApp()).toBe(true);
    expect(t(androidAppLabelKey(isNativeApp()))).toBe('Update the app');
  });
});

describe('server choice plugin', () => {
  afterEach(() => { delete (window as unknown as { Capacitor?: unknown }).Capacitor; });

  it('reads the host from the plugin and is null outside the app', async () => {
    expect(await nativeServerHost()).toBeNull();
    (window as unknown as { Capacitor: unknown }).Capacitor = { Plugins: { ServerChoice: { get: async () => ({ url: 'https://cal.example.org', host: 'cal.example.org' }), choose: async () => ({}) } } };
    expect(await nativeServerHost()).toBe('cal.example.org');
  });

  it('asks the plugin to return to the chooser', async () => {
    let chosen = 0;
    (window as unknown as { Capacitor: unknown }).Capacitor = { Plugins: { ServerChoice: { get: async () => ({}), choose: async () => { chosen++; } } } };
    await changeNativeServer();
    expect(chosen).toBe(1);
  });
});
