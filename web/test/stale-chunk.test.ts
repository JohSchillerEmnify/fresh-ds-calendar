import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleStaleChunk, isStaleChunkError } from '@/pwa/staleChunk';

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: https://cal.example.test/assets/WeekView-OLD.js');

describe('stale chunk after a deploy', () => {
  let reload: ReturnType<typeof vi.fn>;
  let assign: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    sessionStorage.clear();
    reload = vi.fn();
    assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload, assign });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('recognises the module-load errors of Chromium, Firefox and Safari only', () => {
    expect(isStaleChunkError(chunkError())).toBe(true);
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module: x.js'))).toBe(true);
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunkError(new Error('boom'))).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });

  it('reloads once when a chunk is gone and the device is online', () => {
    expect(handleStaleChunk(chunkError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('opens the page that was asked for when a navigation failed', () => {
    expect(handleStaleChunk(chunkError(), '/settings')).toBe(true);
    expect(assign).toHaveBeenCalledWith('/settings');
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not loop: a second failure right after the reload does not reload again', () => {
    expect(handleStaleChunk(chunkError())).toBe(true);
    expect(handleStaleChunk(chunkError())).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again for a failure long after the last reload', () => {
    sessionStorage.setItem('cal.chunkReloadAt', String(Date.now() - 10 * 60_000));
    expect(handleStaleChunk(chunkError())).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload offline (the page would not come back) and ignores other errors', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(handleStaleChunk(chunkError())).toBe(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    expect(handleStaleChunk(new Error('boom'))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
