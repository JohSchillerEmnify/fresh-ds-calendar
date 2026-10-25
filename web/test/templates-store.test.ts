/** The templates store (feature tasklist-templates): late loads, offline state, a pending delete of the same name. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/api/client';
import type { TaskTemplate } from '@/api/types';
import { useTemplatesStore } from '@/features/tasklists/templatesStore';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { freshPinia } from './helpers';

const tpl = (id: string, name: string): TaskTemplate => ({ id, name, items: [{ title: 'x' }], estimateMinutes: null, categoryId: null });

/** A promise with its resolve and reject at hand. */
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => { freshPinia(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('templates store', () => {
  it('drops a load that started before a template was added meanwhile and reads again', async () => {
    const s = useTemplatesStore();
    const slow = deferred<{ templates: TaskTemplate[] }>();
    const read = vi.spyOn(api, 'templates').mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ templates: [tpl('a', 'Packing'), tpl('b', 'Weekly shop')] });
    vi.spyOn(api, 'createTemplate').mockResolvedValue(tpl('b', 'Weekly shop'));
    const loading = s.load();
    await s.add({ name: 'Weekly shop', items: [] });
    // the stale reading (without the new template) arrives last: it must not wipe it
    slow.resolve({ templates: [tpl('a', 'Packing')] });
    await loading;
    expect(read).toHaveBeenCalledTimes(2);
    expect(s.list.map((x) => x.name)).toEqual(['Packing', 'Weekly shop']);
  });

  it('keeps a load that started after the last change', async () => {
    const s = useTemplatesStore();
    vi.spyOn(api, 'createTemplate').mockResolvedValue(tpl('b', 'Weekly shop'));
    await s.add({ name: 'Weekly shop', items: [] });
    vi.spyOn(api, 'templates').mockResolvedValue({ templates: [tpl('a', 'Packing'), tpl('b', 'Weekly shop')] });
    await s.load();
    expect(s.list.map((x) => x.name)).toEqual(['Packing', 'Weekly shop']);
    expect(s.loaded).toBe(true);
  });

  it('says it is offline when the templates could not be read, and not once they were', async () => {
    const s = useTemplatesStore();
    vi.spyOn(api, 'templates').mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline'));
    await expect(s.load()).rejects.toBeInstanceOf(ApiError);
    expect(s.loaded).toBe(false);
    expect(s.failed).toBe(true);
    vi.spyOn(api, 'templates').mockResolvedValueOnce({ templates: [] });
    await s.load();
    expect(s.failed).toBe(false);
    expect(s.loaded).toBe(true);
  });

  it('sends a pending delete of a template first when one with the same name is saved', async () => {
    const s = useTemplatesStore();
    vi.spyOn(api, 'templates').mockResolvedValue({ templates: [tpl('a', 'Packing')] });
    await s.load();
    const order: string[] = [];
    vi.spyOn(api, 'deleteTemplate').mockImplementation(async () => { order.push('delete'); });
    vi.spyOn(api, 'createTemplate').mockImplementation(async () => { order.push('create'); return tpl('b', 'Packing'); });
    usePendingDeletesStore().deleteTemplate('a', 'Packing');
    expect(s.list).toEqual([]);
    await s.add({ name: ' packing ', items: [] });
    expect(order).toEqual(['delete', 'create']);
    expect(s.list.map((x) => x.id)).toEqual(['b']);
  });

  it('reads again after a dropped reading, so a failed save never leaves the picker without templates or empty line', async () => {
    const s = useTemplatesStore();
    const slow = deferred<{ templates: TaskTemplate[] }>();
    const read = vi.spyOn(api, 'templates').mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ templates: [tpl('a', 'Packing')] });
    vi.spyOn(api, 'createTemplate').mockRejectedValue(new ApiError(0, 'NETWORK', 'offline'));
    const loading = s.load();
    await expect(s.add({ name: 'Weekly shop', items: [] })).rejects.toBeInstanceOf(ApiError);
    slow.resolve({ templates: [] });
    await loading;
    expect(read).toHaveBeenCalledTimes(2);
    expect(s.loaded).toBe(true);
    expect(s.list.map((x) => x.name)).toEqual(['Packing']);
  });

  it('waits for a delete of the same name that is already on its way before saving', async () => {
    const s = useTemplatesStore();
    vi.spyOn(api, 'templates').mockResolvedValue({ templates: [tpl('a', 'Packing')] });
    await s.load();
    const gone = deferred<void>();
    const order: string[] = [];
    vi.spyOn(api, 'deleteTemplate').mockImplementation(async () => { await gone.promise; order.push('delete'); });
    vi.spyOn(api, 'createTemplate').mockImplementation(async () => { order.push('create'); return tpl('b', 'Packing'); });
    usePendingDeletesStore().deleteTemplate('a', 'Packing');
    void usePendingDeletesStore().flush();
    const saving = s.add({ name: 'Packing', items: [] });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(order, 'nothing saved while the delete is on its way').toEqual([]);
    gone.resolve();
    await saving;
    expect(order).toEqual(['delete', 'create']);
  });
});
