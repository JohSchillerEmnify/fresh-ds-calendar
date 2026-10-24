/** Repeating task lists: the "This week / All weeks" question before a change (feature tasklist-repeating). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createMemoryHistory, type Router } from 'vue-router';
import { createAppRouter } from '@/router';
import type { TaskList } from '@/api/types';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useSettingsStore } from '@/stores/settings';
import ExpandedTaskList from '@/features/tasklists/ExpandedTaskList.vue';
import TaskListDialog from '@/features/tasklists/TaskListDialog.vue';
import { config, freshPinia, mockFetch, settingsFixture } from './helpers';

vi.mock('@/motion/useCelebrate', () => ({ useCelebrate: () => ({ celebrate: vi.fn() }) }));

const tid = (id: string) => `[data-testid="${id}"]`;
/** A week of a repeating list (`seriesId` set), or a one-off list with `seriesId: undefined`. */
function week(o: Partial<TaskList> = {}): TaskList {
  const items = [{ id: 'i0', title: 'Sink', done: false }, { id: 'i1', title: 'Floor', done: false }];
  return {
    kind: 'tasklist', id: 'W_20261019', calendarId: 'tasks', title: 'Clean', date: '2026-10-19', time: null, items, doneCount: 0, totalCount: 2,
    estimateMinutes: null, recurrence: 'weekly', seriesId: 'W', categoryId: null, tags: [], color: '#039be5', etag: '"e1"', updated: 'x', ...o,
  };
}
const answer = (l: TaskList) => () => l;

let wrapper: VueWrapper | null = null;
let router: Router;
async function open(list: TaskList, routes: Record<string, (r: { body: any; url: URL }) => unknown> = {}) {
  const m = mockFetch({
    'GET /api/config': () => config({ pollIntervalMs: 0 }),
    'GET /api/settings': () => settingsFixture(),
    'GET /api/tasklists/open': () => ({ items: [] }),
    'GET /api/items': () => ({ items: [list] }),
    ...routes,
  });
  const pinia = freshPinia();
  await Promise.all([useClockStore().load(), useSettingsStore().load()]);
  router = createAppRouter(createMemoryHistory());
  router.push('/week/2026-10-19');
  await router.isReady();
  useItemsStore().upsert(list);
  wrapper = mount(ExpandedTaskList as never, { props: { id: list.id }, global: { plugins: [pinia as never, router] }, attachTo: document.body } as never);
  await flushPromises();
  return m;
}
const q = (s: string) => document.querySelector<HTMLElement>(s);
const asked = () => q(tid('repeat-scope-dialog'));
async function choose(which: 'this' | 'all' | 'cancel') {
  if (which === 'cancel') q(tid('repeat-scope-cancel'))!.click();
  else {
    q(`${tid(`repeat-scope-${which}`)} input`)!.click();
    await nextTick();
    q(tid('repeat-scope-ok'))!.click();
  }
  await flushPromises();
}
/** Types into a field and presses Enter. */
async function enter(sel: string, value: string) {
  const input = q(sel) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  // the add field is a form: Enter submits it
  input.closest('form')?.dispatchEvent(new Event('submit'));
  await flushPromises();
}
const writes = (m: Awaited<ReturnType<typeof open>>) => m.calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url.pathname}${c.url.search}`);

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); });

describe('the This week / All weeks question', () => {
  it('renaming an item of a repeating list asks first ("This week" preselected); All weeks sends scope=all', async () => {
    const m = await open(week(), { 'PATCH /api/tasklists/W_20261019/items/i0': answer(week({ items: [{ id: 'i0', title: 'Basin', done: false }, { id: 'i1', title: 'Floor', done: false }] })) });
    q(`${tid('tasklist-item')} ${tid('tasklist-item-title')}`)!.click();
    await nextTick();
    await enter(tid('tasklist-item-title-input'), 'Basin');
    expect(asked()).not.toBeNull();
    expect(q(tid('repeat-scope-this'))!.textContent!.trim()).toBe('This week');
    expect(q(tid('repeat-scope-all'))!.textContent!.trim()).toBe('All weeks');
    expect(q(tid('repeat-scope-this'))!.dataset.checked).toBe('true');
    expect(writes(m)).toEqual([]);
    await choose('all');
    expect(asked()).toBeNull();
    expect(writes(m)).toEqual(['PATCH /api/tasklists/W_20261019/items/i0?scope=all']);
    expect(m.calls.find((c) => c.method === 'PATCH')!.body).toEqual({ title: 'Basin' });
  });

  it('adding an item with "This week" sends the plain request', async () => {
    const m = await open(week(), { 'POST /api/tasklists/W_20261019/items': answer(week()) });
    q(tid('tasklist-add'))!.click();
    await nextTick();
    await enter(tid('tasklist-new-item'), 'Mirror');
    expect(asked()).not.toBeNull();
    await choose('this');
    expect(writes(m)).toEqual(['POST /api/tasklists/W_20261019/items']);
  });

  it('cancel sends nothing and puts an added item\'s text back into the add field', async () => {
    const m = await open(week());
    q(tid('tasklist-add'))!.click();
    await nextTick();
    await enter(tid('tasklist-new-item'), 'Mirror');
    await choose('cancel');
    expect(writes(m)).toEqual([]);
    expect((q(tid('tasklist-new-item')) as HTMLInputElement).value).toBe('Mirror');
  });

  it('renaming the list in place for all weeks sends only the title with scope=all, without If-Match', async () => {
    const m = await open(week(), { 'PATCH /api/tasklists/W_20261019': answer(week({ title: 'Bathroom' })) });
    q(tid('tasklist-expanded-title'))!.click();
    await nextTick();
    await enter(tid('tasklist-expanded-title-input'), 'Bathroom');
    await choose('all');
    expect(writes(m)).toEqual(['PATCH /api/tasklists/W_20261019?scope=all']);
    const call = m.calls.find((c) => c.method === 'PATCH')!;
    expect(call.body).toEqual({ title: 'Bathroom' });
    expect(call.headers['If-Match']).toBeUndefined();
  });

  it('removing an item for all weeks keeps the undo time and then sends scope=all', async () => {
    const m = await open(week(), { 'DELETE /api/tasklists/W_20261019/items/i1': answer(week({ items: [{ id: 'i0', title: 'Sink', done: false }] })) });
    q(`${tid('tasklist-item')}[data-item-id="i1"] ${tid('tasklist-item-delete')}`)!.click();
    await nextTick();
    expect(asked()).not.toBeNull();
    await choose('all');
    expect(q(tid('undo-snackbar')) ?? useItemsStore().get('W_20261019')).toBeTruthy();
    expect(writes(m)).toEqual([]);
    await usePendingDeletesStore().flush();
    await flushPromises();
    expect(writes(m)).toEqual(['DELETE /api/tasklists/W_20261019/items/i1?scope=all']);
  });

  it('ticking never asks, and a list that does not repeat never asks', async () => {
    const m = await open(week({ seriesId: undefined, recurrence: null, id: 'G' }), {
      'PATCH /api/tasklists/G/items/i0': answer(week({ id: 'G', seriesId: undefined })),
      'POST /api/tasklists/G/items': answer(week({ id: 'G', seriesId: undefined })),
    });
    (q(`${tid('tasklist-item')} input[type=checkbox]`) as HTMLInputElement).click();
    await flushPromises();
    q(tid('tasklist-add'))!.click();
    await nextTick();
    await enter(tid('tasklist-new-item'), 'Mirror');
    expect(asked()).toBeNull();
    expect(writes(m)).toEqual(['PATCH /api/tasklists/G/items/i0', 'POST /api/tasklists/G/items']);
  });

  it('a daily list asks "This day / All days"', async () => {
    await open(week({ recurrence: 'daily' }));
    q(tid('tasklist-add'))!.click();
    await nextTick();
    await enter(tid('tasklist-new-item'), 'Mirror');
    expect(q(tid('repeat-scope-this'))!.textContent!.trim()).toBe('This day');
    expect(q(tid('repeat-scope-all'))!.textContent!.trim()).toBe('All days');
  });
});

describe('the task list form on a repeating list', () => {
  async function form(list: TaskList, routes: Record<string, (r: { body: any; url: URL }) => unknown>) {
    const m = await open(list, routes);
    wrapper!.unmount();
    wrapper = mount(TaskListDialog as never, { props: { mode: 'edit', id: list.id }, global: { plugins: [router] }, attachTo: document.body } as never);
    await flushPromises();
    return m;
  }
  const setField = async (id: string, v: string) => {
    const input = q(tid(id)) as HTMLInputElement;
    input.value = v;
    input.dispatchEvent(new Event('input'));
    await nextTick();
  };

  it('a changed title asks on save; All weeks sends the other changes to this week first, then the title for all weeks', async () => {
    const m = await form(week(), {
      'PATCH /api/tasklists/W_20261019': ({ body }) => week({ ...body, etag: '"e2"' }),
      'GET /api/tasklists/open': () => ({ items: [] }),
    });
    await setField('tasklist-title', 'Bathroom');
    await setField('tasklist-estimate', '20');
    q(tid('tasklist-save'))!.click();
    await flushPromises();
    expect(asked()).not.toBeNull();
    await choose('all');
    expect(writes(m)).toEqual(['PATCH /api/tasklists/W_20261019', 'PATCH /api/tasklists/W_20261019?scope=all']);
    const [one, all] = m.calls.filter((c) => c.method === 'PATCH');
    expect(one.body).not.toHaveProperty('title');
    expect(one.body.estimateMinutes).toBe(20);
    expect(one.headers['If-Match']).toBe('"e1"');
    expect(all.body).toEqual({ title: 'Bathroom' });
  });

  it('only the title changed: All weeks sends just the title for all weeks', async () => {
    const m = await form(week(), { 'PATCH /api/tasklists/W_20261019': () => week({ title: 'Bathroom' }) });
    await setField('tasklist-title', 'Bathroom');
    q(tid('tasklist-save'))!.click();
    await flushPromises();
    await choose('all');
    expect(writes(m)).toEqual(['PATCH /api/tasklists/W_20261019?scope=all']);
  });

  it('cancel keeps the form open and sends nothing', async () => {
    const m = await form(week(), {});
    await setField('tasklist-title', 'Bathroom');
    q(tid('tasklist-save'))!.click();
    await flushPromises();
    await choose('cancel');
    expect(writes(m)).toEqual([]);
    expect(q(tid('tasklist-dialog'))).not.toBeNull();
    expect((q(`${tid('tasklist-save')}`) as HTMLButtonElement).disabled).toBe(false);
  });

  it('no title change does not ask', async () => {
    const m = await form(week(), { 'PATCH /api/tasklists/W_20261019': () => week() });
    await setField('tasklist-estimate', '20');
    q(tid('tasklist-save'))!.click();
    await flushPromises();
    expect(asked()).toBeNull();
    expect(writes(m)).toEqual(['PATCH /api/tasklists/W_20261019']);
  });
});
