/** The iPhone widget keys store (feature iphone-widget): the list never holds a key itself, and survives on the device. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import { useWidgetKeysStore } from '@/stores/widgetKeys';
import { freshPinia } from './helpers';

const listed = { id: 'AAAAAAAA', name: 'My iPhone', createdAt: '2026-10-14T06:00:00.000Z', lastUsedAt: null };

beforeEach(() => { freshPinia(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('widget keys store', () => {
  it('lists a new key without its secret and hands the secret only to the caller', async () => {
    const s = useWidgetKeysStore();
    vi.spyOn(api, 'createWidgetKey').mockResolvedValue({ ...listed, key: 'cwk_AAAAAAAA_secret' });
    const made = await s.create('My iPhone');
    expect(made.key).toBe('cwk_AAAAAAAA_secret');
    expect(s.keys).toEqual([listed]);
    expect(JSON.stringify(s.keys)).not.toContain('secret');
  });

  it('removes a key after the server did and reads the last use again', async () => {
    const s = useWidgetKeysStore();
    s.fromDevice([listed]);
    vi.spyOn(api, 'deleteWidgetKey').mockResolvedValue(undefined);
    await s.remove('AAAAAAAA');
    expect(s.keys).toEqual([]);
    vi.spyOn(api, 'widgetKeys').mockResolvedValue([{ ...listed, lastUsedAt: '2026-10-14T07:00:00.000Z' }]);
    await s.refresh();
    expect(s.keys[0]!.lastUsedAt).toBe('2026-10-14T07:00:00.000Z');
  });
});
