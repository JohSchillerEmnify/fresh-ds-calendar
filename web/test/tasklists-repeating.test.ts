/** Repeating task lists: the "This task list / This and all following task lists" question before a change (feature tasklist-repeating). */
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
async function choose(which: 'this' | 'following' | 'cancel') {
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

describe('the This task list / This and all following question', () => {
  it('renaming an item of a repeating list asks first ("This task list" preselected); the following ones send scope=following', async () => {
    const m = await open(week(), { 'PATCH /api/tasklists/W_20261019/items/i0': answer(week({ items: [{ id: 'i0', title: 'Basin', done: false }, { id: 'i1', title: 'Floor', done: false }] })) });
    q(`${tid('tasklist-item')} ${tid('tasklist-item-title')}`)!.click();
    await nextTick();
    await enter(tid('tasklist-item-title-input'), 'Basin');
    expect(asked()).not.toBeNull();
    expect(q(tid('repeat-scope-this'))!.textContent!.trim()).toBe('This task list');
    expect(q(tid('repeat-scope-following'))!.textContent!.trim()).toBe('This and all following task lists');
    expect(q(tid('repeat-scope-this'))!.dataset.checked).toBe('true');
    expect(writes(m)).toEqual([]);
    await choose('following');
    expect(asked()).toBeNull();
    expect(writes(m)).toEqual(['PATCH /api/tasklists/W_20261019/items/i0?scope=following']);
    expect(m.calls.find((c) => c.method === 'PATCH')!.body).toEqual({ title: 'Basin' });
  });

  it('adding an item with "This task list" sends the plain request', async () => {
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

  it('renaming the list in place for the following ones sends only the title with scope=following, without If-Match', async () => {
    const m = await open(week(), { 'PATCH /api/tasklists/W_20261019': answer(week({ title: 'Bathroom' })) });
    q(tid('tasklist-expanded-title'))!.click();
    await nextTick();
    await enter(tid('tasklist-expanded-title-input'), 'Bathroom');
    await choose('following');
    expect(writes(m)).toEqual(['PATCH /api/tasklists/W_20261019?scope=following']);
    const call = m.calls.find((c) => c.method === 'PATCH')!;
    expect(call.body).toEqual({ title: 'Bathroom' });
    expect(call.headers['If-Match']).toBeUndefined();
  });

  it('removing an item for the following ones keeps the undo time and then sends scope=following', async () => {
    const m = await open(week(), { 'DELETE /api/tasklists/W_20261019/items/i1': answer(week({ items: [{ id: 'i0', title: 'Sink', done: false }] })) });
    q(`${tid('tasklist-item')}[data-item-id="i1"] ${tid('tasklist-item-delete')}`)!.click();
    await nextTick();
    expect(asked()).not.toBeNull();
    await choose('following');
    expect(q(tid('undo-snackbar')) ?? useItemsStore().get('W_20261019')).toBeTruthy();
    expect(writes(m)).toEqual([]);
    await usePendingDeletesStore().flush();
    await flushPromises();
    expect(writes(m)).toEqual(['DELETE /api/tasklists/W_20261019/items/i1?scope=following']);
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

  it('a daily list asks with the same words', async () => {
    await open(week({ recurrence: 'daily' }));
    q(tid('tasklist-add'))!.click();
    await nextTick();
    await enter(tid('tasklist-new-item'), 'Mirror');
    expect(q(tid('repeat-scope-this'))!.textContent!.trim()).toBe('This task list');
    expect(q(tid('repeat-scope-following'))!.textContent!.trim()).toBe('This and all following task lists');
  });

  it('removing an item that is still being added asks too, and the answer reaches the request', async () => {
    let release!: () => void;
    const added = week({ items: [...week().items, { id: 'i2', title: 'Mirror', done: false }], totalCount: 3 });
    const m = await open(week(), {
      'POST /api/tasklists/W_20261019/items': () => new Promise((r) => { release = () => r(added); }),
      'DELETE /api/tasklists/W_20261019/items/i2': answer(week()),
    });
    q(tid('tasklist-add'))!.click();
    await nextTick();
    await enter(tid('tasklist-new-item'), 'Mirror');
    await choose('following');
    // still in flight: the row has its temporary id
    q(`${tid('tasklist-item')}[data-item-id^="tmp-"] ${tid('tasklist-item-delete')}`)!.click();
    await nextTick();
    expect(asked()).not.toBeNull();
    await choose('following');
    release();
    await flushPromises();
    await vi.waitFor(() => expect(writes(m)).toEqual(['POST /api/tasklists/W_20261019/items?scope=following', 'DELETE /api/tasklists/W_20261019/items/i2?scope=following']));
  });

  it('a this-only rename queued after a following one is not merged ahead of it', async () => {
    let release!: () => void;
    const m = await open(week(), {
      'PATCH /api/tasklists/W_20261019/items/i1': () => new Promise((r) => { release = () => r(week()); }),
      'PATCH /api/tasklists/W_20261019/items/i0': ({ body }) => week({ items: [{ id: 'i0', title: body.title, done: false }, { id: 'i1', title: 'Floor', done: false }] }),
    });
    const rename = async (i: number, v: string, which: 'this' | 'following') => {
      q(`${tid('tasklist-item')}[data-item-id="i${i}"] ${tid('tasklist-item-title')}`)!.click();
      await nextTick();
      await enter(tid('tasklist-item-title-input'), v);
      await choose(which);
    };
    // keeps the queue busy, so the next ones wait
    (q(`${tid('tasklist-item')}[data-item-id="i1"] input[type=checkbox]`) as HTMLInputElement).click();
    await nextTick();
    await rename(0, 'A', 'this');
    await rename(0, 'B', 'following');
    await rename(0, 'C', 'this');
    release();
    await flushPromises();
    await vi.waitFor(() => expect(m.calls.filter((c) => c.url.pathname.endsWith('/i0')).map((c) => `${c.body.title}${c.url.search}`)).toEqual(['A', 'B?scope=following', 'C']));
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

  it('a changed title asks on save; the following ones: the other changes go to this one first, then the title with scope=following', async () => {
    const m = await form(week(), {
      'PATCH /api/tasklists/W_20261019': ({ body }) => week({ ...body, etag: '"e2"' }),
      'GET /api/tasklists/open': () => ({ items: [] }),
    });
    await setField('tasklist-title', 'Bathroom');
    await setField('tasklist-estimate', '20');
    q(tid('tasklist-save'))!.click();
    await flushPromises();
    expect(asked()).not.toBeNull();
    await choose('following');
    expect(writes(m)).toEqual(['PATCH /api/tasklists/W_20261019', 'PATCH /api/tasklists/W_20261019?scope=following']);
    const [one, all] = m.calls.filter((c) => c.method === 'PATCH');
    expect(one.body).not.toHaveProperty('title');
    expect(one.body.estimateMinutes).toBe(20);
    expect(one.headers['If-Match']).toBe('"e1"');
    expect(all.body).toEqual({ title: 'Bathroom' });
  });

  it('only the title changed: just the title with scope=following', async () => {
    const m = await form(week(), { 'PATCH /api/tasklists/W_20261019': () => week({ title: 'Bathroom' }) });
    await setField('tasklist-title', 'Bathroom');
    q(tid('tasklist-save'))!.click();
    await flushPromises();
    await choose('following');
    expect(writes(m)).toEqual(['PATCH /api/tasklists/W_20261019?scope=following']);
  });

  it('a retry after the title request failed sends only the title (the other changes were saved, with their new version)', async () => {
    let fail = true;
    const m = await form(week(), {
      'PATCH /api/tasklists/W_20261019': ({ url, body }) => (url.search && fail
        ? { status: 503, body: { error: { code: 'PROVIDER_UNAVAILABLE', message: 'Google is unavailable' } } }
        : week({ ...body, etag: '"e2"' })),
    });
    await setField('tasklist-title', 'Bathroom');
    await setField('tasklist-estimate', '20');
    q(tid('tasklist-save'))!.click();
    await flushPromises();
    await choose('following');
    expect(q(tid('tasklist-dialog'))).not.toBeNull();
    fail = false;
    q(tid('tasklist-save'))!.click();
    await flushPromises();
    await choose('following');
    expect(writes(m).filter((w) => w.includes('/api/tasklists/'))).toEqual(['PATCH /api/tasklists/W_20261019', 'PATCH /api/tasklists/W_20261019?scope=following', 'PATCH /api/tasklists/W_20261019?scope=following']);
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
