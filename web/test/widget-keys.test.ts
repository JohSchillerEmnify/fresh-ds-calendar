/** The iPhone widget keys (feature iphone-widget): the list never holds a key itself. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import { useWidgetKeys } from '@/composables/useWidgetKeys';
import { freshPinia } from './helpers';

const listed = { id: 'AAAAAAAA', name: 'My iPhone', createdAt: '2026-10-14T06:00:00.000Z', lastUsedAt: null };

beforeEach(() => { freshPinia(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('widget keys', () => {
  it('lists a new key without its secret and hands the secret only to the caller', async () => {
    const wk = useWidgetKeys();
    wk.keys.value = [];
    vi.spyOn(api, 'createWidgetKey').mockResolvedValue({ ...listed, key: 'cwk_AAAAAAAA_secret' });
    const made = await wk.create('My iPhone');
    expect(made.key).toBe('cwk_AAAAAAAA_secret');
    expect(wk.keys.value).toEqual([listed]);
    expect(JSON.stringify(wk.keys.value)).not.toContain('secret');
  });

  it('removes a key after the server did and reads the last use again', async () => {
    const wk = useWidgetKeys();
    wk.keys.value = [listed];
    vi.spyOn(api, 'deleteWidgetKey').mockResolvedValue(undefined);
    await wk.remove('AAAAAAAA');
    expect(wk.keys.value).toEqual([]);
    vi.spyOn(api, 'widgetKeys').mockResolvedValue([{ ...listed, lastUsedAt: '2026-10-14T07:00:00.000Z' }]);
    await wk.refresh();
    expect(wk.keys.value[0]!.lastUsedAt).toBe('2026-10-14T07:00:00.000Z');
  });
});
