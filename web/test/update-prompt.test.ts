import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { controller, getRegistration: async () => reg, addEventListener: vi.fn() },
  });
};
const offers = (ui: { snackbars: { testid?: string }[] }) => ui.snackbars.filter((s) => s.testid === 'update-available');

describe('update prompt', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => { Reflect.deleteProperty(navigator, 'serviceWorker'); vi.restoreAllMocks(); });

  it('without a controlling worker, offers right away', async () => {
    const { u, ui } = await load();
    setSw(null, undefined);
    await u.checkVersion('0.2.0+new');
    expect(offers(ui)).toHaveLength(1);
  });

  it('with a controlling worker, updates it and offers only once a worker waits', async () => {
    const { u, ui } = await load();
    const reg = { update: vi.fn(async () => {}), waiting: null as unknown };
    setSw({}, reg);
    await u.checkVersion('0.2.0+new');
    expect(reg.update).toHaveBeenCalled();
    expect(offers(ui)).toHaveLength(0);
    // the registration's updatefound handler hands over the installed worker
    u.setWaitingWorker({ postMessage: vi.fn() } as unknown as ServiceWorker);
    u.offerUpdate();
    expect(offers(ui)).toHaveLength(1);
  });

  it('offers a worker that already waits after update()', async () => {
    const { u, ui } = await load();
    setSw({}, { update: async () => {}, waiting: { postMessage: vi.fn() } });
    await u.checkVersion('0.2.0+new');
    expect(offers(ui)).toHaveLength(1);
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
