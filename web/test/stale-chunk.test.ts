import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: https://cal.example.test/assets/WeekView-OLD.js');
const cssError = () => new Error('Unable to preload CSS for /assets/MonthPage-OLD.css');

describe('stale chunk after a deploy', () => {
  let reload: ReturnType<typeof vi.fn>;
  let assign: ReturnType<typeof vi.fn>;
  let mod: typeof import('@/pwa/staleChunk');
  let ui: ReturnType<typeof import('@/stores/ui').useUiStore>;
  let loads: { pending: number };
  beforeEach(async () => {
    sessionStorage.clear();
    vi.resetModules();
    setActivePinia(createPinia());
    reload = vi.fn();
    assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload, assign });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    mod = await import('@/pwa/staleChunk');
    ui = (await import('@/stores/ui')).useUiStore();
    loads = (await import('@/extensions/registry')).dialogLoads;
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('recognises the module and style load errors of Chromium, Firefox, Safari and Vite only', () => {
    expect(mod.isStaleChunkError(chunkError())).toBe(true);
    expect(mod.isStaleChunkError(cssError())).toBe(true);
    expect(mod.isStaleChunkError(new TypeError('error loading dynamically imported module: x.js'))).toBe(true);
    expect(mod.isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(mod.isStaleChunkError(new Error('boom'))).toBe(false);
    expect(mod.isStaleChunkError(undefined)).toBe(false);
  });

  it('reloads once when a chunk is gone and nothing could lose input', () => {
    expect(mod.handleStaleChunk(chunkError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads for a missing style file', () => {
    expect(mod.handleStaleChunk(cssError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('opens the page that was asked for when a navigation failed', () => {
    ui.openDialog('event', {});
    expect(mod.handleStaleChunk(chunkError(), '/settings')).toBe(true);
    expect(assign).toHaveBeenCalledWith('/settings');
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not loop: a second failure right after the reload does not reload again', () => {
    expect(mod.handleStaleChunk(chunkError())).toBe(true);
    expect(mod.handleStaleChunk(chunkError())).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again for a failure long after the last reload', () => {
    sessionStorage.setItem('cal.chunkReloadAt', String(Date.now() - 10 * 60_000));
    expect(mod.handleStaleChunk(chunkError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload when storage cannot remember the reload (it could loop)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(mod.handleStaleChunk(chunkError())).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload offline (the page would not come back) and ignores other errors', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(mod.handleStaleChunk(chunkError())).toBe(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    expect(mod.handleStaleChunk(new Error('boom'))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('waits while a dialog is open and reloads when it closes, so typed input is not lost', async () => {
    ui.openDialog('event', {});
    expect(mod.handleStaleChunk(chunkError())).toBe(true);
    await nextTick();
    expect(reload).not.toHaveBeenCalled();
    ui.closeDialog();
    await nextTick();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads at once when the failed file is the dialog that was just opened', () => {
    ui.openDialog('event', {});
    loads.pending = 1;
    expect(mod.handleStaleChunk(chunkError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  describe('listeners', () => {
    it('treats every cancelable vite:preloadError as stale (a dialog script, a style file) and holds back its error', () => {
      mod.installStaleChunkReload(createRouter({ history: createMemoryHistory(), routes: [] }));
      const ev = new Event('vite:preloadError', { cancelable: true }) as Event & { payload?: unknown };
      ev.payload = new Error('Something else');
      window.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });
});
