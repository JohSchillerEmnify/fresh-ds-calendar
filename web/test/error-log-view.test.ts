/** Settings › Error log: Share and Download never do nothing; when no way out is left the log is copied and the person is told (feature device-log). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ErrorLogView from '@/views/ErrorLogView.vue';
import { clearDeviceLog, logDevice } from '@/lib/deviceLog';
import { useUiStore } from '@/stores/ui';
import { freshPinia } from './helpers';

describe('error log buttons', () => {
  beforeEach(() => {
    localStorage.clear();
    clearDeviceLog();
    logDevice('error', { name: 'Error', message: 'sync stopped' });
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb());
    // the app (no plugins installed) in a context where the clipboard works
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, Plugins: {} });
    vi.stubGlobal('isSecureContext', true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(['device-log-share', 'device-log-download'])('%s copies the log and says so when the app cannot open its share sheet', async (id) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const pinia = freshPinia();
    const w = mount(ErrorLogView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await w.get(`[data-testid="${id}"]`).trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('sync stopped'));
    expect(useUiStore().snackbars.map((m) => m.text)).toEqual(['Could not share it, so the error log was copied']);
  });
});
