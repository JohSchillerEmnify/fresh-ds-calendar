import { afterEach, describe, expect, it } from 'vitest';
import { androidAppLabelKey, isNativeApp } from '@/native/app';
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
