import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

type Update = typeof import('@/pwa/update');
type Ui = typeof import('@/stores/ui');

/** Fresh module state (offered/latest/warned) per test; the running build is `0.1.0+old`. */
async function load(): Promise<{ u: Update; ui: ReturnType<Ui['useUiStore']> }> {
  vi.resetModules();
  setActivePinia(createPinia());
  document.documentElement.dataset.appVersion = '0.1.0+old';
  const u = await import('@/pwa/update');
  const { useUiStore } = await import('@/stores/ui');
  return { u, ui: useUiStore() };
}

const setSw = (controller: unknown, reg: unknown) => {
  const listeners: Record<string, () => void> = {};
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { controller, getRegistration: async () => reg, addEventListener: (n: string, f: () => void) => { listeners[n] = f; } },
  });
  return { listeners, reload };
};
const offers = (ui: { snackbars: { testid?: string }[] }) => ui.snackbars.filter((s) => s.testid === 'update-available');

describe('update prompt', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => { Reflect.deleteProperty(navigator, 'serviceWorker'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('without a controlling worker, offers right away', async () => {
    const { u, ui } = await load();
    setSw(null, undefined);
    await u.checkVersion('0.2.0+new');
    expect(offers(ui)).toHaveLength(1);
  });

  it('with a controlling worker, jumps to the newest worker and auto-applies it when safe', async () => {
    const { u, ui } = await load();
    const newest = { postMessage: vi.fn() };
    const reg = { update: vi.fn(async () => {}), waiting: newest as unknown, installing: null as unknown };
    const { reload, listeners } = setSw({}, reg);
    await u.checkVersion('0.2.0+new');
    expect(reg.update).toHaveBeenCalled();
    expect(offers(ui)).toHaveLength(0);
    expect(newest.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    listeners.controllerchange!();
    expect(reload).toHaveBeenCalled();
  });

  it('activates the newest installed worker, not a stale waiting one', async () => {
    const { u } = await load();
    const stale = { postMessage: vi.fn() };
    const newest = { postMessage: vi.fn() };
    const reg = { update: vi.fn(async () => {}), waiting: stale as unknown, installing: newest as unknown };
    setSw({}, reg);
    await u.checkVersion('0.2.0+new');
    // the stale waiting worker is left alone while a newer one installs
    expect(stale.postMessage).not.toHaveBeenCalled();
    u.autoUpdate(newest as unknown as ServiceWorker);
    expect(newest.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(stale.postMessage).not.toHaveBeenCalled();
  });

  it('defers the auto-apply while a dialog is open, then applies once it closes', async () => {
    const { u, ui } = await load();
    const w = { postMessage: vi.fn() };
    setSw({}, { update: async () => {}, waiting: w, installing: null });
    ui.openDialog('event-editor');
    await u.checkVersion('0.2.0+new');
    expect(w.postMessage).not.toHaveBeenCalled();
    expect(offers(ui)).toHaveLength(0);
    ui.closeDialog();
    await nextTick();
    expect(w.postMessage).toHaveBeenCalledTimes(1);
  });

  it('defers while resizing or a picker is open, and applies when the tab becomes hidden', async () => {
    const { u, ui } = await load();
    const w = { postMessage: vi.fn() };
    setSw({}, { update: async () => {}, waiting: w, installing: null });
    ui.pickerOpen = true;
    await u.checkVersion('0.2.0+new');
    expect(w.postMessage).not.toHaveBeenCalled();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(w.postMessage).toHaveBeenCalledTimes(1);
    // watchers are torn down: closing the picker later does not apply twice
    ui.pickerOpen = false;
    await nextTick();
    expect(w.postMessage).toHaveBeenCalledTimes(1);
    hidden.mockRestore();
  });

  it('with a controlling worker but no registration, falls back to the snackbar', async () => {
    const { u, ui } = await load();
    setSw({}, undefined);
    await u.checkVersion('0.2.0+new');
    expect(offers(ui)).toHaveLength(1);
  });

  it('does not auto-apply a version whose reload already came back old (no loop)', async () => {
    const first = await load();
    const w = { postMessage: vi.fn() };
    setSw({}, { update: async () => {}, waiting: w, installing: null });
    await first.u.checkVersion('0.2.0+new');
    expect(w.postMessage).toHaveBeenCalledTimes(1);
    // the page comes back still on 0.1.0+old
    const again = await load();
    const w2 = { postMessage: vi.fn() };
    setSw({}, { update: async () => {}, waiting: w2, installing: null });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await again.u.checkVersion('0.2.0+new');
    expect(w2.postMessage).not.toHaveBeenCalled();
    expect(offers(again.ui)).toHaveLength(0);
  });

  it('does not re-offer a version after a reload that came back with the old build, and warns once', async () => {
    const { u, ui } = await load();
    setSw(null, undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    await u.checkVersion('0.2.0+new');
    ui.snackbars[0]!.action!.run();
    expect(reload).toHaveBeenCalled();
    ui.dismiss(ui.snackbars[0]!.id);
    // the page comes back still on 0.1.0+old
    const again = await load();
    setSw(null, undefined);
    await again.u.checkVersion('0.2.0+new');
    await again.u.checkVersion('0.2.0+new');
    expect(offers(again.ui)).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    // a newer deploy is offered again
    await again.u.checkVersion('0.3.0+newer');
    expect(offers(again.ui)).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('remembers a dismissal per version; a new version is offered again', async () => {
    const { u, ui } = await load();
    setSw(null, undefined);
    await u.checkVersion('0.2.0+new');
    const s = ui.snackbars[0]!;
    s.onClose!();
    ui.dismiss(s.id);
    await u.checkVersion('0.2.0+new');
    expect(offers(ui)).toHaveLength(0);
    await u.checkVersion('0.3.0+newer');
    expect(offers(ui)).toHaveLength(1);
  });

  it('offers nothing when the versions match', async () => {
    const { u, ui } = await load();
    setSw(null, undefined);
    await u.checkVersion('0.1.0+old');
    expect(offers(ui)).toHaveLength(0);
  });
});
