/** The "Share" entry of a list's overflow menu: only for a signed-in sharer and a list that can be shared. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter } from '@/router';
import type { TaskList } from '@/api/types';
import TaskListView from '@/features/tasklists/TaskListView.vue';
import { useAuthStore } from '@/stores/auth';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { config, freshPinia, mockFetch, settingsFixture } from './helpers';

vi.mock('@/motion/useCelebrate', () => ({ useCelebrate: () => ({ celebrate: vi.fn() }) }));

const list = { kind: 'tasklist', id: 'G', calendarId: 'primary', title: 'G', date: null, time: null, items: [{ id: 'i1', title: 'Milk', done: false }], doneCount: 0, totalCount: 1, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', calendarColor: '#039be5', completedOn: null, canvas: null, etag: 'e', updated: 'x' } as TaskList;
let wrapper: VueWrapper | null = null;
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = ''; vi.restoreAllMocks(); });

/** The test hooks of the menu entries of list `G` after opening the menu. */
async function menu(auth: 'in' | 'off', changes: Partial<TaskList> = {}): Promise<string[]> {
  mockFetch({ 'GET /api/config': () => config({ pollIntervalMs: 0 }), 'GET /api/settings': () => settingsFixture(), 'GET /api/tasklists/open': () => ({ items: [] }) });
  const pinia = freshPinia();
  await Promise.all([useClockStore().load(), useSettingsStore().load()]);
  const router = createAppRouter(createMemoryHistory());
  router.push('/tasks');
  await router.isReady();
  useAuthStore().status = auth;
  useItemsStore().upsert({ ...list, ...changes });
  wrapper = mount(TaskListView as never, { props: { id: 'G' }, global: { plugins: [pinia as never, router] }, attachTo: document.body } as never);
  await flushPromises();
  await wrapper.get('[data-testid="tasklist-overflow"]').trigger('click');
  await flushPromises();
  return [...document.querySelectorAll('[role="menuitem"]')].map((n) => n.getAttribute('data-testid') ?? '');
}

describe('Share in the overflow menu', () => {
  it('is offered to a signed-in sharer', async () => {
    expect(await menu('in')).toContain('tasklist-share-open');
  });
  it('is hidden while sign-in is off', async () => {
    expect(await menu('off')).not.toContain('tasklist-share-open');
  });
  it('is hidden for a repeating list, which cannot be shared', async () => {
    expect(await menu('in', { recurrence: 'weekly' })).not.toContain('tasklist-share-open');
    wrapper?.unmount();
    expect(await menu('in', { seriesId: 's1' } as Partial<TaskList>)).not.toContain('tasklist-share-open');
  });
  it('is hidden for a member, who can only leave', async () => {
    const me = { sub: 'a', name: 'A', email: 'a@example.test', initial: 'A' };
    const hooks = await menu('in', { shared: { owned: false, owner: me, with: [me] } } as Partial<TaskList>);
    expect(hooks).not.toContain('tasklist-share-open');
    expect(hooks).toContain('tasklist-leave');
  });
});
