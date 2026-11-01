/** "Share with" lists a person who signed in after the device copy was made (feature shared-lists, @unit). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter } from '@/router';
import type { TaskList } from '@/api/types';
import TaskListDialog from '@/features/tasklists/TaskListDialog.vue';
import { useClockStore } from '@/stores/clock';
import { useDeviceStore } from '@/stores/device';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { config, freshPinia, mockFetch, settingsFixture } from './helpers';

const BEA = { sub: 'sub-bea', name: 'Bea', email: 'bea@example.test', initial: 'B' };
const list = { kind: 'tasklist', id: 'G', calendarId: 'primary', title: 'G', date: null, time: null, items: [], doneCount: 0, totalCount: 0, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', calendarColor: '#039be5', completedOn: null, canvas: null, etag: '"e"', updated: 'x' } as TaskList;
const answer = (people: unknown) => ({
  full: true, cursor: 'c1', window: { from: '2020-01-01', to: '2030-01-01' }, calendars: [],
  events: { calendars: [], replace: [], series: [], removed: [], upserts: [], failed: [] },
  taskLists: { replace: true, series: [], removed: [], upserts: [list], failed: false }, files: { people },
}) as never;

let wrapper: VueWrapper | null = null;
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); });

async function open(routes: Record<string, () => unknown>) {
  mockFetch({ 'GET /api/config': () => config({ pollIntervalMs: 0 }), 'GET /api/settings': () => settingsFixture(), 'GET /api/tasklists/open': () => ({ items: [] }), ...routes });
  const pinia = freshPinia();
  await Promise.all([useClockStore().load(), useSettingsStore().load()]);
  const router = createAppRouter(createMemoryHistory());
  router.push('/week/2026-10-12');
  await router.isReady();
  const device = useDeviceStore();
  device.take(answer({ people: [] }));
  useItemsStore().upsert(list);
  wrapper = mount(TaskListDialog, { props: { mode: 'edit', id: 'G' }, global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { device, w: wrapper };
}
const options = (w: VueWrapper) => w.get('[data-testid="tasklist-share-person"]').text();

describe('Share with in the task list dialog', () => {
  it('asks the server when it opens, so a person who signed in later is offered although the device copy had nobody', async () => {
    const { w, device } = await open({ 'GET /api/people': () => ({ people: [BEA] }) });
    expect(options(w)).toContain('Bea');
    expect(device.file<{ people: unknown[] }>('people')?.people).toHaveLength(1);
  });

  it('shows the device copy when the server cannot be reached', async () => {
    const { w } = await open({ 'GET /api/people': () => ({ status: 503, body: { error: { code: 'X', message: 'down' } } }) });
    expect(w.find('[data-testid="tasklist-share-person"]').exists()).toBe(false);
    useDeviceStore().take(answer({ people: [BEA] }));
    await flushPromises();
    expect(options(w)).toContain('Bea');
  });

  it('follows the device copy while open (a sync brings a newcomer)', async () => {
    const { w, device } = await open({ 'GET /api/people': () => ({ people: [] }) });
    expect(w.find('[data-testid="tasklist-share-person"]').exists()).toBe(false);
    device.take(answer({ people: [BEA] }));
    await flushPromises();
    expect(options(w)).toContain('Bea');
  });
});
