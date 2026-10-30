import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter } from '@/router';
import type { TaskList } from '@/api/types';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { COLLAPSED_KEY, isCollapsed, reloadCollapsed, setAllCollapsed } from '@/features/tasklists/collapse';
import TaskListView from '@/features/tasklists/TaskListView.vue';
import { config, freshPinia, mockFetch, settingsFixture } from './helpers';

vi.mock('@/motion/useCelebrate', () => ({ useCelebrate: () => ({ celebrate: vi.fn() }) }));

const tid = (id: string) => `[data-testid="${id}"]`;
const list = (id: string): TaskList => ({
  kind: 'tasklist', id, calendarId: 'primary', title: id, date: '2026-10-12', time: null,
  items: [{ id: `${id}-1`, title: 'Milk', done: true }, { id: `${id}-2`, title: 'Eggs', done: false }], doneCount: 1, totalCount: 2,
  estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', calendarColor: '#039be5', completedOn: null, canvas: null, etag: 'e', updated: 'x',
});

let wrapper: VueWrapper | null = null;
async function open(id: string, props: Record<string, unknown> = {}) {
  mockFetch({ 'GET /api/config': () => config({ pollIntervalMs: 0 }), 'GET /api/settings': () => settingsFixture(), 'GET /api/tasklists/open': () => ({ items: [] }) });
  const pinia = freshPinia();
  await Promise.all([useClockStore().load(), useSettingsStore().load()]);
  const router = createAppRouter(createMemoryHistory());
  router.push('/tasks');
  await router.isReady();
  useItemsStore().upsert(list(id));
  wrapper = mount(TaskListView as never, { props: { id, ...props }, global: { plugins: [pinia as never, router] }, attachTo: document.body } as never);
  await flushPromises();
  return wrapper;
}

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); reloadCollapsed(); vi.spyOn(Math, 'random').mockReturnValue(0.99); });
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); });

describe('collapsible task list card', () => {
  it('collapses to the head (title and count, no items) and expands again', async () => {
    const w = await open('G');
    const root = () => w.get(tid('tasklist-view'));
    const chevron = () => w.get(tid('tasklist-collapse'));
    expect(root().attributes('data-collapsed')).toBe('false');
    expect(chevron().attributes('aria-expanded')).toBe('true');
    expect(w.findAll(tid('tasklist-item'))).toHaveLength(2);
    await chevron().trigger('click');
    await flushPromises();
    expect(root().attributes('data-collapsed')).toBe('true');
    expect(chevron().attributes('aria-expanded')).toBe('false');
    expect(w.findAll(tid('tasklist-item'))).toHaveLength(0);
    expect(w.find(tid('tasklist-add')).exists()).toBe(false);
    expect(w.get(tid('tasklist-expanded-title')).text()).toBe('G');
    expect(w.get(tid('tasklist-expanded-count')).text()).toBe('1/2');
    await chevron().trigger('click');
    await flushPromises();
    expect(root().attributes('data-collapsed')).toBe('false');
    expect(w.findAll(tid('tasklist-item'))).toHaveLength(2);
  });

  it('remembers the state per list in localStorage', async () => {
    const w = await open('G');
    await w.get(tid('tasklist-collapse')).trigger('click');
    expect(JSON.parse(localStorage.getItem(COLLAPSED_KEY)!)).toEqual({ G: true });
    w.unmount();
    reloadCollapsed();
    const again = await open('G');
    expect(again.get(tid('tasklist-view')).attributes('data-collapsed')).toBe('true');
    again.unmount();
    expect((await open('H')).get(tid('tasklist-view')).attributes('data-collapsed')).toBe('false');
  });

  it('has no chevron in the expanded list sheet (closable)', async () => {
    const w = await open('G', { closable: true });
    expect(w.find(tid('tasklist-collapse')).exists()).toBe(false);
    expect(w.get(tid('tasklist-view')).attributes('data-collapsed')).toBe('false');
  });

  it('collapse all and expand all write the same per-list state', () => {
    setAllCollapsed(['a', 'b'], true);
    expect([isCollapsed('a'), isCollapsed('b'), isCollapsed('c')]).toEqual([true, true, false]);
    setAllCollapsed(['a', 'b'], false);
    expect([isCollapsed('a'), isCollapsed('b')]).toEqual([false, false]);
    expect(localStorage.getItem(COLLAPSED_KEY)).toBe('{}');
  });

  it('survives a blocked storage and ignores junk in it', () => {
    localStorage.setItem(COLLAPSED_KEY, '{"a":true,"b":1}');
    reloadCollapsed();
    expect([isCollapsed('a'), isCollapsed('b')]).toEqual([true, false]);
    localStorage.setItem(COLLAPSED_KEY, 'not json');
    reloadCollapsed();
    expect(isCollapsed('a')).toBe(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => setAllCollapsed(['x'], true)).not.toThrow();
    expect(isCollapsed('x')).toBe(true);
  });
});

describe('compact footer', () => {
  it('has Add item as the only footer button (Edit and Delete are in the overflow menu); the field shows only while adding', async () => {
    const w = await open('G');
    const foot = w.get('footer');
    expect(foot.findAll('button')).toHaveLength(1);
    expect(foot.find(tid('tasklist-add')).exists() && w.find(tid('tasklist-overflow')).exists()).toBe(true);
    expect(w.find(tid('tasklist-new-item')).exists()).toBe(false);
    await w.get(tid('tasklist-add')).trigger('click');
    expect(w.find(tid('tasklist-new-item')).exists()).toBe(true);
    await w.get(tid('tasklist-new-item')).trigger('blur');
    expect(w.find(tid('tasklist-new-item')).exists()).toBe(false);
  });
});
