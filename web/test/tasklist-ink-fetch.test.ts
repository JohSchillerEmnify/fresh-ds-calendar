/** Editing a handwritten list whose ink the device has not synced yet (feature handwritten-lists): the lines come from the server, or a notice says why they are empty. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter } from '@/router';
import type { TaskList } from '@/api/types';
import TaskListDialog from '@/features/tasklists/TaskListDialog.vue';
import { useAuthStore } from '@/stores/auth';
import { useClockStore } from '@/stores/clock';
import { useInkStore } from '@/stores/ink';
import { useOutboxStore } from '@/stores/outbox';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { config, freshPinia, mockFetch, settingsFixture } from './helpers';

const stroke = { p: [[0, 0.5, 0.5], [1, 0.5, 0.5]] as [number, number, number][], t: 1 };
const list = { kind: 'tasklist', id: 'G', calendarId: 'primary', title: 'G', date: null, time: null, items: [{ id: 'i1', title: '', done: false, ink: true }], doneCount: 0, totalCount: 1, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', calendarColor: '#039be5', completedOn: null, canvas: null, etag: '"e"', updated: 'x' } as unknown as TaskList;

let wrapper: VueWrapper | null = null;
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); });

async function open(ink: () => unknown, before?: () => void) {
  const { calls } = mockFetch({ 'GET /api/config': () => config({ pollIntervalMs: 0 }), 'GET /api/settings': () => settingsFixture(), 'GET /api/tasklists/open': () => ({ items: [] }), 'GET /api/tasklists/G': () => list, 'GET /api/ink': ink });
  const pinia = freshPinia();
  await Promise.all([useClockStore().load(), useSettingsStore().load()]);
  const router = createAppRouter(createMemoryHistory());
  router.push('/week/2026-10-12');
  await router.isReady();
  useAuthStore().status = 'in';
  useItemsStore().upsert(list);
  before?.();
  wrapper = mount(TaskListDialog, { props: { mode: 'edit', id: 'G' }, global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  const lines = () => (wrapper!.vm as unknown as { inkForm: { shown: { value: unknown[][] } } }).inkForm.shown.value;
  return { calls, lines, ink: useInkStore(), ui: useUiStore(), pinia };
}

describe('Handwritten lines of a list the device has no ink for', () => {
  it('fetches the ink from the server and shows it in the lines', async () => {
    const { calls, ink, lines } = await open(() => ({ items: { i1: [stroke] } }));
    expect(calls.some((c) => c.method === 'GET' && c.path === '/api/ink')).toBe(true);
    expect(ink.strokes('i1')).toHaveLength(1);
    expect(lines()[0]).toHaveLength(1);
  });

  it('does not ask the server when the device already holds the ink', async () => {
    const { calls, lines } = await open(() => ({ items: {} }), () => useInkStore().fromDevice({ items: { i1: [stroke] } } as never));
    expect(calls.some((c) => c.path === '/api/ink')).toBe(false);
    expect(lines()[0]).toHaveLength(1);
  });

  it('says so when the ink cannot be fetched, and the form stays usable', async () => {
    const { ui, lines } = await open(() => ({ status: 503, body: { error: { code: 'X', message: 'down' } } }));
    expect(ui.snackbars.map((s) => s.text)).toContain("The handwriting couldn't be loaded. Open the list again when you are online.");
    expect(wrapper!.find('[data-testid="tasklist-title"]').exists() || wrapper!.find('input').exists()).toBe(true);
    expect(lines()[0]).toHaveLength(0);
  });

  it('adopting a server document keeps what the device holds and unsent writes', async () => {
    freshPinia();
    const ink = useInkStore();
    ink.fromDevice({ items: { a: [stroke] } } as never);
    useOutboxStore().entries.push({ change: { op: 'item.ink', id: 'G', itemId: 'b', strokes: [stroke, stroke], base: [], at: 1 } } as never);
    ink.adoptDoc({ items: { a: [], b: [], c: [stroke] } } as never);
    expect([ink.strokes('a').length, ink.strokes('b').length, ink.strokes('c').length]).toEqual([1, 2, 1]);
  });
});
