import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { checkApk, dismissedApk, rememberApkDismissed, shouldOfferApk } from '@/native/apkHint';
import { installedVersionCode } from '@/native/app';
import { useUiStore } from '@/stores/ui';

const setApp = (appVersion?: () => Promise<{ versionCode?: number }>) => {
  (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true, Plugins: { ServerChoice: { appVersion } } };
};

describe('shouldOfferApk', () => {
  it('offers only a newer APK that was not dismissed', () => {
    expect(shouldOfferApk(5, 6, 0)).toBe(true);
    expect(shouldOfferApk(6, 6, 0)).toBe(false);
    expect(shouldOfferApk(7, 6, 0)).toBe(false);
    expect(shouldOfferApk(5, 6, 6)).toBe(false);
    expect(shouldOfferApk(5, 7, 6)).toBe(true);
  });
});

describe('dismiss memory', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the dismissed versionCode', () => {
    expect(dismissedApk()).toBe(0);
    rememberApkDismissed(6);
    expect(dismissedApk()).toBe(6);
  });

  it('survives unavailable storage', () => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try {
      expect(() => rememberApkDismissed(6)).not.toThrow();
      expect(dismissedApk()).toBe(0);
    } finally {
      Storage.prototype.getItem = get;
      Storage.prototype.setItem = set;
    }
  });
});

describe('installedVersionCode', () => {
  afterEach(() => { delete (window as unknown as { Capacitor?: unknown }).Capacitor; });

  it('is null in a browser', async () => { expect(await installedVersionCode()).toBeNull(); });
  it('reads the code from the native bridge', async () => {
    setApp(async () => ({ versionCode: 5 }));
    expect(await installedVersionCode()).toBe(5);
  });
  it('counts as 0 for an APK without the bridge method', async () => {
    setApp(undefined);
    expect(await installedVersionCode()).toBe(0);
  });
});

describe('checkApk', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); });
  afterEach(() => { delete (window as unknown as { Capacitor?: unknown }).Capacitor; });
  const apk = { versionCode: 6, versionName: '1.1.6' };

  it('shows nothing in a browser', async () => {
    await checkApk(apk);
    expect(useUiStore().snackbars).toHaveLength(0);
  });

  it('shows one persistent snackbar in the app for a newer APK, not twice', async () => {
    setApp(async () => ({ versionCode: 5 }));
    await checkApk(apk);
    await checkApk(apk);
    const s = useUiStore().snackbars;
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ testid: 'apk-available', duration: 0 });
  });

  it('shows nothing when the installed app is current, or no APK is offered', async () => {
    setApp(async () => ({ versionCode: 6 }));
    await checkApk(apk);
    await checkApk(null);
    expect(useUiStore().snackbars).toHaveLength(0);
  });

  it('remembers "Later" per versionCode, and a newer APK is offered again', async () => {
    setApp(async () => ({ versionCode: 5 }));
    await checkApk(apk);
    const ui = useUiStore();
    ui.snackbars[0]!.onClose!();
    ui.dismiss(ui.snackbars[0]!.id);
    await checkApk(apk);
    expect(ui.snackbars).toHaveLength(0);
    await checkApk({ versionCode: 7, versionName: '1.1.7' });
    expect(ui.snackbars).toHaveLength(1);
  });
});
