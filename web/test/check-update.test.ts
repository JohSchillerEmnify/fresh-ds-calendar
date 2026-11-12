import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

/** Fresh module state per test; the running build is `0.1.0+old`, the server answers `config`. */
async function load(config: unknown | Error) {
  vi.resetModules();
  setActivePinia(createPinia());
  document.documentElement.dataset.appVersion = '0.1.0+old';
  const { api } = await import('@/api/client');
  vi.spyOn(api, 'config').mockImplementation(async () => { if (config instanceof Error) throw config; return config as never; });
  return await import('@/pwa/update');
}

const setSw = (controller: unknown, reg: unknown) => {
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { controller, getRegistration: async () => reg, addEventListener: vi.fn() },
  });
  return reload;
};

describe('manual update check', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => { Reflect.deleteProperty(navigator, 'serviceWorker'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('says current when the server runs the same build', async () => {
    const u = await load({ version: '0.1.0+old', apk: null });
    setSw(null, undefined);
    expect(await u.checkForUpdate()).toBe('current');
  });

  it('says ready for a newer build and loads it through the waiting worker', async () => {
    const u = await load({ version: '0.2.0+new', apk: null });
    const w = { postMessage: vi.fn() };
    const reg = { update: vi.fn(async () => {}), installing: null, waiting: w };
    setSw({}, reg);
    expect(await u.checkForUpdate()).toBe('ready');
    expect(reg.update).toHaveBeenCalled();
    expect(w.postMessage).not.toHaveBeenCalled();
    u.reload();
    expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('lets go of the live stream before activating the new worker, which an open stream keeps the old worker from handing over', async () => {
    const u = await load({ version: '0.2.0+new', apk: null });
    const { startLiveSync } = await import('@/lib/liveSync');
    const sources: { closed: boolean }[] = [];
    vi.stubGlobal('EventSource', class { closed = false; constructor() { sources.push(this); } addEventListener() {} close() { this.closed = true; } });
    const stop = startLiveSync({ changed: vi.fn(), connected: vi.fn() });
    let closedWhenPosted: boolean | undefined;
    const w = { postMessage: vi.fn(() => { closedWhenPosted = sources[0]!.closed; }) };
    setSw({}, { update: async () => {}, installing: null, waiting: w });
    await u.checkForUpdate();
    u.reload();
    expect(closedWhenPosted).toBe(true);
    stop();
  });

  it('says failed when the server cannot be reached', async () => {
    const u = await load(new Error('offline'));
    setSw(null, undefined);
    expect(await u.checkForUpdate()).toBe('failed');
  });

  it('says failed when the new worker cannot be fetched', async () => {
    const u = await load({ version: '0.2.0+new', apk: null });
    setSw({}, { update: async () => { throw new Error('offline'); }, installing: null, waiting: null });
    expect(await u.checkForUpdate()).toBe('failed');
  });

  it('ignores a dismissal and an earlier reload that came back old', async () => {
    const u = await load({ version: '0.2.0+new', apk: null });
    sessionStorage.setItem('cal.updateDismissed', '0.2.0+new');
    sessionStorage.setItem('cal.updateReloadedFor', '0.2.0+new');
    const reload = setSw(null, undefined);
    expect(await u.checkForUpdate()).toBe('ready');
    u.reload();
    expect(reload).toHaveBeenCalled();
    expect(sessionStorage.getItem('cal.updateDismissed')).toBeNull();
  });
});
