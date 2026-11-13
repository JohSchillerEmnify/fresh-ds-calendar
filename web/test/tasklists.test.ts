import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { createMemoryHistory, type Router } from 'vue-router';
import { createAppRouter } from '@/router';
import type { TaskList } from '@/api/types';
import { displayTitle, itemSegments, neutralName } from '@/lib/items';
import { enableTimerCounting } from '@/lib/timers';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useOutboxStore } from '@/stores/outbox';
import { usePendingDeletesStore } from '@/stores/pendingDeletes';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { useDaySegments } from '@/composables/useDaySegments';
import ExpandedTaskList from '@/features/tasklists/ExpandedTaskList.vue';
import TaskListCard from '@/features/tasklists/TaskListCard.vue';
import TaskListDialog from '@/features/tasklists/TaskListDialog.vue';
import TaskTray from '@/features/tasklists/TaskTray.vue';
import { barHostsRow } from '@/lib/barHost';
import { setAnimationSetting } from '@/motion/level';
import { carriedLabel, formatEstimate, singleTask } from '@/features/tasklists/format';
import { moveItemTo, toggleSingleTask } from '@/features/tasklists/ops';
import { useTaskListsStore } from '@/features/tasklists/store';
import { catSwipe } from '@/features/motivation/supportCat';
import { validateForm } from '@/features/tasklists/validate';
import { config, freshPinia, mockFetch, settingsFixture } from './helpers';

// the tray fetches its list views on first open; warm the module so one flush resolves it
await import('@/features/tasklists/TaskListView.vue');

const celebrate = vi.fn();
vi.mock('@/motion/useCelebrate', () => ({ useCelebrate: () => ({ celebrate }) }));

function tl(id: string, o: Partial<TaskList> & { done?: boolean[] } = {}): TaskList {
  const flags = o.done ?? [false, false, false];
  const items = flags.map((d, i) => ({ id: `${id}-i${i}`, title: ['Milk', 'Eggs', 'Bread', 'Jam'][i] ?? `Item ${i}`, done: d }));
  const { done: _d, ...rest } = o;
  return {
    kind: 'tasklist', id, calendarId: 'primary', title: id, date: '2026-10-12', time: null, items, doneCount: items.filter((i) => i.done).length,
    totalCount: items.length, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', calendarColor: '#039be5', completedOn: null, canvas: null, etag: `"e-${id}"`, updated: 'x', ...rest,
  };
}
const seg = (item: TaskList, today = '2026-10-12') => itemSegments(item, today)[0];
const tid = (id: string) => `[data-testid="${id}"]`;

let wrapper: VueWrapper | null = null;
let router: Router;
async function setup(routes: Record<string, (r: { body: any; url: URL; headers: Record<string, string> }) => unknown> = {}, path = '/week/2026-10-12') {
  const m = mockFetch({
    'GET /api/config': () => config({ pollIntervalMs: 0 }),
    'GET /api/settings': () => settingsFixture(),
    'GET /api/tasklists/open': () => ({ items: [] }),
    ...routes,
  });
  const pinia = freshPinia();
  await Promise.all([useClockStore().load(), useSettingsStore().load()]);
  router = createAppRouter(createMemoryHistory());
  router.push(path);
  await router.isReady();
  return { m, pinia };
}
const mountIn = (comp: unknown, props: Record<string, unknown>, pinia: unknown) =>
  (wrapper = mount(comp as never, { props, global: { plugins: [pinia as never, router] }, attachTo: document.body } as never));

beforeEach(() => { document.body.innerHTML = ''; celebrate.mockClear(); });
// the support cat comes by at random (about 1 in 10); tests that want it force it, all others must never roll it
beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(0.99); });
// The outbox engine reaches the items store through a module-wide port, so a change still being sent when a test ends would
// act on the next test's store (a refused PATCH re-reads and hides the list 'G'): every test waits for its outbox to drain,
// and the wait is long because a loaded CI machine can take seconds for a send that takes milliseconds here.
afterEach(async () => {
  wrapper?.unmount();
  wrapper = null;
  const outbox = useOutboxStore();
  await vi.waitFor(() => expect(outbox.count).toBe(0), { timeout: 9000 }).catch(() => undefined);
  await flushPromises();
  vi.restoreAllMocks();
});

describe('collapsed card', () => {
  it('strikes the title of a complete list through (its done state), not an open one', async () => {
    const { pinia } = await setup();
    const w = mountIn(TaskListCard, { segment: seg(tl('Done', { done: [true, true] })), variant: 'allday' }, pinia);
    const title = w.get(tid('tasklist-card-title'));
    expect(title.attributes('data-struck')).toBe('true');
    expect(title.find(tid('strike-line')).exists()).toBe(true);
    expect(title.text()).toBe('Done');
    w.unmount();
    const open = mountIn(TaskListCard, { segment: seg(tl('Open', { done: [true, false] })), variant: 'allday' }, pinia);
    expect(open.get(tid('tasklist-card-title')).attributes('data-struck')).toBeUndefined();
    expect(open.find(tid('strike-line')).exists()).toBe(false);
  });


  it('shows emoji, title, item titles, count and a progress bar in the compact states', async () => {
    const { pinia } = await setup();
    useSettingsStore().settings.categories[0].icon = '🛒';
    const list = tl('Groceries', { done: [true, false, false], categoryId: useSettingsStore().settings.categories[0].id, estimateMinutes: 90, time: '18:00' });
    const w = mountIn(TaskListCard, { segment: seg(list), variant: 'block', height: 120 }, pinia);
    expect(w.get(tid('tasklist-card')).attributes('data-time')).toBe('18:00');
    expect(w.get(tid('tasklist-card-title')).text()).toBe('Groceries');
    expect(w.get(tid('tasklist-card-items')).text()).toBe('Milk, Eggs, Bread');
    expect(w.get(tid('tasklist-card-count')).text()).toBe('1/3');
    expect(w.get(tid('tasklist-card-icon')).text()).toBe('🛒');
    expect(w.get(tid('tasklist-card-estimate')).text()).toBe('~1 h 30 min');
    expect(w.get(tid('tasklist-card-time')).text()).toBe('18:00');
    expect(w.get(tid('tasklist-progress-ring')).attributes('data-percent')).toBe('33');
  });
  it('shows an untitled list without a title row and with a neutral name (card, tray, expanded list)', async () => {
    const list = tl('U', { title: '' });
    expect(displayTitle(list)).toBe('');
    expect(neutralName(list)).toBe('Task list');
    expect(displayTitle({ kind: 'event', title: '' })).toBe('');
    const { pinia } = await setup({ 'GET /api/tasklists/open': () => ({ items: [list] }) });
    const w = mountIn(TaskListCard, { segment: seg(list), variant: 'chip' }, pinia);
    expect(w.find(tid('tasklist-card-title')).exists()).toBe(false);
    expect(w.get(tid('tasklist-card')).attributes('data-title')).toBe('');
    expect(w.get(tid('tasklist-card')).attributes('data-untitled')).toBe('true');
    expect(w.get(tid('tasklist-card')).attributes('aria-label')).toBe('Task list, 0 of 3 done');
    expect(w.get(tid('tasklist-card-count')).text()).toBe('0/3');
    w.unmount();
    const tray = mountIn(TaskTray, {}, pinia);
    await flushPromises();
    expect(tray.get(tid('task-tray-item')).attributes('data-title')).toBe('');
    expect(tray.find(tid('tasklist-expanded-title')).exists()).toBe(false);
    tray.unmount();
    useItemsStore().upsert(list);
    mountIn(ExpandedTaskList, { id: 'U' }, pinia);
    await flushPromises();
    expect(document.querySelector(tid('tasklist-expanded-title'))).toBeNull();
  });
  it('a one-item list has no thin bar and is announced as done / not done; two items keep bar and count wording', async () => {
    const { pinia } = await setup();
    const card = (o: Parameters<typeof tl>[1]) => mountIn(TaskListCard, { segment: seg(tl('Bahn', o)), variant: 'chip' }, pinia);
    const open = card({ done: [false] });
    expect(open.find(tid('tasklist-card-bar')).exists()).toBe(false);
    expect(open.get(tid('tasklist-card')).attributes('aria-label')).toBe('Bahn, not done');
    open.unmount();
    const done = card({ done: [true] });
    expect(done.get(tid('tasklist-card')).attributes('aria-label')).toBe('Bahn, done');
    done.unmount();
    const untitled = card({ done: [false], title: '' });
    expect(untitled.get(tid('tasklist-card')).attributes('aria-label')).toBe('Task list, not done');
    untitled.unmount();
    const two = card({ done: [true, false] });
    expect(two.find(tid('tasklist-card-bar')).exists()).toBe(true);
    expect(two.get(tid('tasklist-card')).attributes('aria-label')).toBe('Bahn, 1 of 2 done');
  });
  it('a one-line list is one task: title slot, one ticking checkbox, no count, no placeholder; both kinds render alike', async () => {
    const { pinia } = await setup();
    const titleOnly = mountIn(TaskListCard, { segment: seg(tl('Ideas', { done: [] })), variant: 'card' }, pinia);
    const itemOnly = mountIn(TaskListCard, { segment: seg(tl('x', { title: '', done: [false], items: [{ id: 'x-i0', title: 'Ideas', done: false }] })), variant: 'card' }, pinia);
    for (const w of [titleOnly, itemOnly]) {
      expect(w.get(tid('tasklist-card-title')).text()).toBe('Ideas');
      expect(w.findAll(tid('tasklist-card-check')).length).toBe(1);
      expect(w.find(tid('tasklist-card-items')).exists()).toBe(false);
      expect(w.find(tid('tasklist-card-count')).exists()).toBe(false);
      expect(w.get(tid('tasklist-card-check')).attributes('role')).toBeUndefined();
      expect(w.get(tid('tasklist-card-check')).attributes('aria-hidden')).toBe('true');
    }
    expect(titleOnly.get(tid('tasklist-card')).classes()).toContain('one');
    expect(itemOnly.get(tid('tasklist-card')).classes()).toContain('one');
    // a tap opens the list (no growing), the checkbox ticks without opening it
    await itemOnly.get(tid('tasklist-card-check')).trigger('click');
    expect(useUiStore().dialog).toBeNull();
    await itemOnly.get(tid('tasklist-card')).trigger('click');
    expect(useUiStore().dialog?.kind).toBe('tasklist-expanded');
    // no interactive control nests in the card's button: Space on the card ticks the task instead
    useUiStore().dialog = null;
    const before = useOutboxStore().entries.length;
    await itemOnly.get(tid('tasklist-card')).trigger('keydown', { key: ' ', code: 'Space' });
    expect(useOutboxStore().entries.length).toBeGreaterThan(before);
    expect(useUiStore().dialog).toBeNull();
    titleOnly.unmount();
    itemOnly.unmount();
  });
  it('ticking a title-only list moves the title into one ticked item and clears the title', async () => {
    await setup();
    const list = tl('Ideas', { done: [] });
    useItemsStore().upsert(list);
    toggleSingleTask('Ideas', singleTask(list)!);
    const changes = useOutboxStore().entries.map((e) => e.change);
    expect(changes[0]).toMatchObject({ op: 'item.add', id: 'Ideas', title: 'Ideas', done: true });
    expect(changes[1]).toMatchObject({ op: 'list.update', id: 'Ideas', patch: { title: '' } });
  });
  it('a list with a title and one item, or two items, is not a one-line list', async () => {
    const { pinia } = await setup();
    for (const done of [[false], [false, false]]) {
      const w = mountIn(TaskListCard, { segment: seg(tl('Post', { done })), variant: 'card' }, pinia);
      expect(w.get(tid('tasklist-card')).classes()).not.toContain('one');
      expect(w.get(tid('tasklist-card-check')).attributes('role')).toBeUndefined();
      w.unmount();
    }
  });
  it('exposes the root element for drag and drop', async () => {
    const { pinia } = await setup();
    const w = mountIn(TaskListCard, { segment: seg(tl('Ideas', { done: [] })), variant: 'chip' }, pinia);
    expect(w.emitted('el')?.[0][0]).toBe(w.get(tid('tasklist-card')).element);
    expect(w.get(tid('tasklist-card')).attributes('data-draggable')).toBe('tasklist');
  });
  it('calm mode hides the item titles', async () => {
    const { pinia } = await setup();
    useSettingsStore().settings.calmMode = true;
    const w = mountIn(TaskListCard, { segment: seg(tl('Groceries')), variant: 'chip' }, pinia);
    expect(w.find(tid('tasklist-card-items')).exists()).toBe(false);
    expect(w.get(tid('tasklist-card-count')).text()).toBe('0/3');
  });
  it('carried-over lists get the gentle label, not the error color', async () => {
    const { pinia } = await setup();
    const list = tl('Laundry', { date: '2026-10-10', done: [true, false] });
    const s = seg(list);
    expect(s.date).toBe('2026-10-12');
    expect(s.carriedFrom).toBe('2026-10-10');
    const w = mountIn(TaskListCard, { segment: s, variant: 'allday' }, pinia);
    expect(w.get(tid('tasklist-card-overdue')).text()).toBe('From Sat 10 Oct');
    expect(w.get(tid('tasklist-card-overdue')).text()).not.toMatch(/overdue|missed|late/i);
    expect(w.html()).not.toMatch(/error/i);
    expect(carriedLabel('2026-10-10')).toBe('From Sat 10 Oct');
  });
  it('carry-over rules: only open lists of the last 30 days; finished and old ones stay put', () => {
    expect(seg(tl('a', { date: '2026-10-10', done: [true, true] })).date).toBe('2026-10-10');
    expect(seg(tl('b', { date: '2026-09-12', done: [false] })).date).toBe('2026-10-12');
    expect(seg(tl('c', { date: '2026-09-11', done: [false] })).date).toBe('2026-09-11');
    expect(seg(tl('d', { date: '2026-10-14', done: [false] })).date).toBe('2026-10-14');
  });
  it('an open list made after its own day ended stays on that day; one made before it is carried', () => {
    expect(seg({ ...tl('e', { date: '2026-10-10', done: [false] }), createdOn: '2026-10-11' }).date).toBe('2026-10-10');
    expect(seg({ ...tl('f', { date: '2026-10-10', done: [false] }), createdOn: '2026-10-10' }).date).toBe('2026-10-12');
    expect(seg({ ...tl('g', { date: '2026-10-10', done: [false] }), createdOn: '2026-10-09' }).date).toBe('2026-10-12');
  });
  it('a timed list is a block sized by its estimate', () => {
    const s = seg(tl('Tidy', { time: '18:00', estimateMinutes: 45 }));
    expect([s.startMin, s.endMin]).toEqual([1080, 1125]);
    expect(seg(tl('Plain', { time: '18:00' })).endMin).toBe(1110);
  });
  it('formats estimates', () => {
    expect([formatEstimate(45), formatEstimate(90), formatEstimate(120)]).toEqual(['~45 min', '~1 h 30 min', '~2 h']);
  });
});

describe('expanded list', () => {
  /** Server double: applies item patches in order, optional failure / latency per call. */
  function server(list: TaskList, behaviour: { fail?: (n: number) => boolean; delay?: number } = {}) {
    let state = structuredClone(list);
    let n = 0;
    const log: { itemId: string; body: any }[] = [];
    const handler = async ({ url, body }: { url: URL; body: any }) => {
      const call = ++n;
      if (behaviour.delay) await new Promise((r) => setTimeout(r, behaviour.delay));
      const itemId = url.pathname.split('/').pop()!;
      log.push({ itemId, body });
      if (behaviour.fail?.(call)) return { status: 400, body: { error: { code: 'VALIDATION_ERROR', message: 'refused' } } };
      state = { ...state, items: state.items.map((i) => (i.id === itemId ? { ...i, ...body } : i)) };
      state = { ...state, doneCount: state.items.filter((i) => i.done).length };
      return state;
    };
    return { log, handler, get state() { return state; } };
  }
  const open = async (list: TaskList, routes: Record<string, any>) => {
    const { m, pinia } = await setup(routes);
    useItemsStore().upsert(list);
    const w = mountIn(ExpandedTaskList, { id: list.id }, pinia);
    await flushPromises();
    return { m, w };
  };
  const checkbox = (w: VueWrapper, i: number) => w.findAll(tid('tasklist-item'))[i].get('input[type=checkbox]');
  const done = (w: VueWrapper) => w.findAll(tid('tasklist-item')).map((r) => r.attributes('data-done'));

  it('a list with only a title offers a tick box for the title; ticking moves the title into a done first item and clears the title', async () => {
    const list = tl('Ideas', { done: [] });
    const added: Record<string, unknown>[] = [];
    const { w, m } = await open(list, { 'POST /api/tasklists/Ideas/items': ({ body }: { body: Record<string, unknown> }) => { added.push(body); return tl('Ideas', { done: [true] }); }, 'PATCH /api/tasklists/Ideas': () => tl('Ideas', { title: '', done: [true] }) });
    expect(w.get(tid('tasklist-title-item')).attributes('data-title')).toBe('Ideas');
    await w.get(`${tid('tasklist-title-item-checkbox')} input`).setValue(true);
    await flushPromises();
    expect(added).toEqual([{ id: expect.any(String), title: 'Ideas', done: true }]);
    expect(m.calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ title: '' }]);
    expect(w.find(tid('tasklist-title-item')).exists()).toBe(false);
    expect((useItemsStore().get('Ideas') as TaskList)).toMatchObject({ title: '', doneCount: 1, totalCount: 1 });
  });
  it('offers no title tick box to a list with items or without a title', async () => {
    const { w } = await open(tl('G'), {});
    expect(w.find(tid('tasklist-title-item')).exists()).toBe(false);
    w.unmount();
    const { w: u } = await open(tl('U', { title: '', done: [] }), {});
    expect(u.find(tid('tasklist-title-item')).exists()).toBe(false);
  });
  it('renders items and ticks optimistically with one PATCH', async () => {
    const list = tl('G', { done: [true, false, false] });
    const s = server(list);
    const { w, m } = await open(list, { 'PATCH /api/tasklists/G/items/G-i1': s.handler });
    expect(done(w)).toEqual(['true', 'false', 'false']);
    expect(w.find(tid('tasklist-next-task')).exists()).toBe(false); // removed: it repeated the first open item
    await checkbox(w, 1).setValue(true);
    expect(done(w)).toEqual(['true', 'true', 'false']); // before the response
    await flushPromises();
    expect(m.calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
    expect(w.get(tid('tasklist-expanded-count')).text()).toBe('2/3');
  });

  it('rolls back and tells the person when the server refuses the change', async () => {
    const list = tl('G');
    const s = server(list, { fail: () => true });
    const { w } = await open(list, { 'PATCH /api/tasklists/G/items/G-i0': s.handler, 'GET /api/tasklists/G': () => s.state });
    await checkbox(w, 0).setValue(true);
    expect(done(w)[0]).toBe('true');
    await flushPromises();
    expect(done(w)[0]).toBe('false');
    expect(useUiStore().snackbars.some((x) => x.testid === 'outbox-notice')).toBe(true);
    expect(useItemsStore().get('G')).toMatchObject({ doneCount: 0 });
  });

  it('keeps the tick shown while it cannot be sent', async () => {
    const list = tl('G');
    const { w } = await open(list, { 'PATCH /api/tasklists/G/items/G-i0': () => ({ status: 503, body: { error: { code: 'PROVIDER_UNAVAILABLE', message: 'x' } } }) });
    // the failed send schedules a retry (1 s): on a fake clock it is dropped with the test instead of firing into a later test's store
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await checkbox(w, 0).setValue(true);
      await flushPromises();
      expect(done(w)[0]).toBe('true');
      expect(useOutboxStore().count).toBe(1);
      expect(useUiStore().snackbars.some((x) => x.testid === 'outbox-notice')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a dropped item moves at once with one PUT of the full order, and a refused save puts it back', async () => {
    const list = tl('G');
    const titles = (w: VueWrapper) => w.findAll(tid('tasklist-item-title')).map((x) => x.text());
    const { w, m } = await open(list, { 'PUT /api/tasklists/G/items/order': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', message: 'boom' } } }), 'GET /api/tasklists/G': () => list });
    const before = titles(w);
    moveItemTo('G', 'G-i2', 0);
    await nextTick();
    expect(titles(w)).toEqual([before[2], before[0], before[1]]);
    await flushPromises();
    expect(m.calls.find((c) => c.method === 'PUT')!.body.itemIds).toEqual(['G-i2', 'G-i0', 'G-i1']);
    expect(titles(w)).toEqual(before);
    expect(useUiStore().snackbars.some((x) => x.testid === 'outbox-notice')).toBe(true);
  });

  it('rapid ticks stay correct: one failure rolls back only itself, others survive', async () => {
    const list = tl('G');
    const s = server(list, { fail: (n) => n === 2, delay: 5 });
    const { w } = await open(list, {
      'PATCH /api/tasklists/G/items/G-i0': s.handler, 'PATCH /api/tasklists/G/items/G-i1': s.handler, 'PATCH /api/tasklists/G/items/G-i2': s.handler, 'GET /api/tasklists/G': () => s.state,
    });
    await checkbox(w, 0).setValue(true);
    await checkbox(w, 1).setValue(true);
    await checkbox(w, 2).setValue(true);
    expect(done(w)).toEqual(['true', 'true', 'true']);
    await vi.waitFor(() => expect(s.log.length).toBe(3));
    await new Promise((r) => setTimeout(r, 30));
    await flushPromises();
    expect(done(w)).toEqual(['true', 'false', 'true']);
    expect(s.log.map((l) => l.itemId)).toEqual(['G-i0', 'G-i1', 'G-i2']); // serial, in order
    expect(s.state.items.map((i) => i.done)).toEqual([true, false, true]);
  });

  it('sends every change as it was made, in order (no merging)', async () => {
    const list = tl('G');
    const s = server(list, { delay: 10 });
    const { w } = await open(list, { 'PATCH /api/tasklists/G/items/G-i0': s.handler, 'PATCH /api/tasklists/G/items/G-i1': s.handler });
    await checkbox(w, 1).setValue(true);
    // the first send has reached the server before the next changes are made, so which one is first never depends on timing
    await vi.waitFor(() => expect(s.log).toHaveLength(1));
    // three changes of one item back to back: all three are sent in order, none merged
    await checkbox(w, 0).setValue(true);
    await checkbox(w, 0).setValue(false);
    await checkbox(w, 0).setValue(true);
    await vi.waitFor(() => expect(s.log).toHaveLength(4));
    await flushPromises();
    expect(s.log.map((l) => [l.itemId, l.body.done])).toEqual([['G-i1', true], ['G-i0', true], ['G-i0', false], ['G-i0', true]]);
    expect(done(w)).toEqual(['true', 'true', 'false']);
  });

  it('celebrates exactly once when the last item is ticked, and shows the message', async () => {
    const list = tl('G', { done: [true, true, false] });
    const s = server(list);
    const { w } = await open(list, { 'PATCH /api/tasklists/G/items/G-i2': s.handler });
    expect(w.find(tid('tasklist-complete-message')).exists()).toBe(false);
    await checkbox(w, 2).setValue(true);
    await flushPromises();
    expect(celebrate).toHaveBeenCalledTimes(1);
    expect(w.get(tid('tasklist-complete-message')).text()).toBe('All done! 🎉');
    await checkbox(w, 2).setValue(false);
    await flushPromises();
    expect(celebrate).toHaveBeenCalledTimes(1);
    expect(w.find(tid('tasklist-complete-message')).exists()).toBe(false);
  });

  it('strikes the title through while the list is complete, and removes the line when an item is unticked', async () => {
    const list = tl('G', { done: [true, true, false] });
    const s = server(list);
    const { w } = await open(list, { 'PATCH /api/tasklists/G/items/G-i2': s.handler });
    const title = () => w.get(tid('tasklist-expanded-title'));
    expect(title().attributes('data-struck')).toBeUndefined();
    expect(title().find(tid('strike-line')).exists()).toBe(false);
    await checkbox(w, 2).setValue(true);
    await flushPromises();
    expect(title().attributes('data-struck')).toBe('true');
    expect(title().get(tid('strike-line')).classes()).not.toContain('draw'); // no cat: the line is simply there
    expect(title().text()).toBe('G');
    await checkbox(w, 2).setValue(false);
    await flushPromises();
    expect(title().attributes('data-struck')).toBeUndefined();
    expect(title().find(tid('strike-line')).exists()).toBe(false);
  });

  it('shows a list that is already complete struck through', async () => {
    const list = tl('G', { done: [true, true] });
    const { w } = await open(list, {});
    expect(w.get(tid('tasklist-expanded-title')).attributes('data-struck')).toBe('true');
    expect(w.get(tid('tasklist-expanded-title')).find(tid('strike-line')).exists()).toBe(true);
  });

  it('when the support cat comes, the strike line draws itself in step with its paw swipe', async () => {
    const list = tl('G', { done: [true, false] });
    const s = server(list);
    const { w } = await open(list, { 'PATCH /api/tasklists/G/items/G-i1': s.handler });
    useClockStore().config.testMode = true;
    window.__catNext = true;
    try {
      await checkbox(w, 1).setValue(true);
      await flushPromises();
      expect(document.querySelector(tid('support-cat'))).not.toBeNull();
      const line = w.get(tid('tasklist-expanded-title')).get(tid('strike-line'));
      expect(line.classes()).toContain('draw');
      const swipe = catSwipe('full')!;
      expect(line.attributes('style')).toContain(`--strike-delay: ${swipe.delay}ms`);
      expect(line.attributes('style')).toContain(`--strike-dur: ${swipe.duration}ms`);
    } finally {
      window.__catNext = false;
    }
  });

  it('adds items (blank ignored), renames (blank keeps), deletes and reorders', async () => {
    const list = tl('G');
    let state = structuredClone(list);
    const { w, m } = await open(list, {
      'POST /api/tasklists/G/items': ({ body }: any) => (state = { ...state, items: [...state.items, { id: body.id, title: body.title, done: false }], totalCount: state.totalCount + 1 }),
      'PATCH /api/tasklists/G/items/G-i0': ({ body }: any) => (state = { ...state, items: state.items.map((i) => (i.id === 'G-i0' ? { ...i, ...body } : i)) }),
      'DELETE /api/tasklists/G/items/G-i1': () => (state = { ...state, items: state.items.filter((i) => i.id !== 'G-i1'), totalCount: 2 }),
      'PUT /api/tasklists/G/items/order': ({ body }: any) => (state = { ...state, items: body.itemIds.map((id: string) => state.items.find((i) => i.id === id)) }),
    });
    await w.get(tid('tasklist-add')).trigger('click');
    const input = w.get(tid('tasklist-new-item'));
    await input.setValue('   ');
    await input.trigger('keydown.enter');
    await input.element.closest('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(m.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    await input.setValue('Butter');
    await input.element.closest('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await flushPromises();
    expect(w.findAll(tid('tasklist-item-title')).map((x) => x.text())).toEqual(['Milk', 'Eggs', 'Bread', 'Butter']);

    await w.findAll(tid('tasklist-item-title'))[0].trigger('click');
    const edit = w.get(tid('tasklist-item-title-input'));
    await edit.setValue('   ');
    await edit.trigger('keydown.enter');
    expect(w.findAll(tid('tasklist-item-title'))[0].text()).toBe('Milk');
    await w.findAll(tid('tasklist-item-title'))[0].trigger('click');
    await w.get(tid('tasklist-item-title-input')).setValue('Oat milk');
    await w.get(tid('tasklist-item-title-input')).trigger('keydown.enter');
    await flushPromises();
    expect(w.findAll(tid('tasklist-item-title'))[0].text()).toBe('Oat milk');

    await w.findAll(tid('tasklist-item-delete'))[1].trigger('click');
    await flushPromises();
    expect(w.findAll(tid('tasklist-item-title')).map((x) => x.text())).toEqual(['Oat milk', 'Bread', 'Butter']);
    expect(m.calls.some((c) => c.method === 'DELETE')).toBe(false); // sent when the undo time is over
    // a reorder sends the pending item delete first (the server needs every item id)
    usePendingDeletesStore().flushList('G'); // what a drop does first
    moveItemTo('G', 'G-i2', 0);
    await nextTick();
    expect(w.findAll(tid('tasklist-item-title')).map((x) => x.text())).toEqual(['Bread', 'Oat milk', 'Butter']);
    await vi.waitFor(() => expect(m.calls.filter((c) => c.method === 'DELETE' || c.method === 'PUT').map((c) => c.method)).toEqual(['DELETE', 'PUT']));
    expect(m.calls.find((c) => c.method === 'PUT')!.body.itemIds).toEqual(['G-i2', 'G-i0', m.calls.find((c) => c.method === 'POST')!.body.id]);
  });
});

describe('open tasks tray', () => {
  it('lists open lists with carry-over labels and counts', async () => {
    const laundry = tl('Laundry', { date: '2026-10-10', done: [true, false] });
    const groceries = tl('Groceries', { done: [false] });
    const packing = tl('Packing', { time: '18:00', done: [false] });
    const { pinia } = await setup({ 'GET /api/tasklists/open': () => ({ items: [laundry, groceries, packing] }) });
    useUiStore().trayExpanded = true;
    const w = mountIn(TaskTray, {}, pinia);
    await flushPromises();
    expect(w.get(tid('task-tray-count')).text()).toBe('3 open');
    const rows = w.findAll(tid('task-tray-item'));
    expect(rows.map((r) => r.attributes('data-title'))).toEqual(['Laundry', 'Groceries', 'Packing']);
    expect(rows[0].text()).toContain('From Sat 10 Oct');
    expect(rows[1].text()).not.toContain('From');
    expect(w.findAll(tid('tasklist-move-today'))).toHaveLength(0); // no "Move to today": the carry-over already shows it today (owner)
  });
  it('when the row leaves the bar while its toggle has focus, focus moves to the + button instead of getting lost', async () => {
    const g = tl('Groceries', { done: [false] });
    const slot = document.createElement('div');
    slot.id = 'bar-extra';
    const fab = document.createElement('button');
    fab.dataset.testid = 'create-button';
    document.body.append(slot, fab);
    barHostsRow.value = true;
    try {
      const { pinia } = await setup({ 'GET /api/tasklists/open': () => ({ items: [g] }) });
      mountIn(TaskTray, {}, pinia);
      await flushPromises();
      const toggle = slot.querySelector<HTMLElement>('[data-testid="task-tray-toggle"]')!;
      expect(toggle).not.toBeNull();
      toggle.focus();
      useItemsStore().upsert({ ...g, items: [{ ...g.items[0], done: true }], doneCount: 1 });
      await flushPromises();
      expect(slot.querySelector('[data-testid="task-tray-toggle"]')).toBeNull();
      expect(document.activeElement).toBe(fab);
    } finally {
      barHostsRow.value = false;
      slot.remove();
      fab.remove();
    }
  });
  it('count follows ticks and shows "No open tasks" when empty', async () => {
    const g = tl('Groceries', { done: [false] });
    const { pinia } = await setup({ 'GET /api/tasklists/open': () => ({ items: [g] }) });
    useUiStore().trayExpanded = true;
    const w = mountIn(TaskTray, {}, pinia);
    await flushPromises();
    expect(w.get(tid('task-tray-count')).text()).toBe('1 open');
    useItemsStore().upsert({ ...g, items: [{ ...g.items[0], done: true }], doneCount: 1 });
    await flushPromises();
    expect(w.get(tid('task-tray-count')).text()).toBe('No open tasks');
  });
  it('a list finished in the tray stays open (tray expanded) until the support cat has finished its visit', async () => {
    const g = tl('Groceries', { done: [true, false] });
    let state = g;
    const patch = ({ body }: { body: any }) => (state = { ...g, items: [g.items[0], { ...g.items[1], ...body }], doneCount: 2 });
    const { pinia } = await setup({
      'GET /api/tasklists/open': () => (state.doneCount < 2 ? { items: [state] } : { items: [], finishedToday: [{ ...state, completedOn: '2026-10-12' }] }),
      'PATCH /api/tasklists/Groceries/items/Groceries-i1': patch,
    });
    const w = mountIn(TaskTray, {}, pinia);
    await flushPromises();
    useUiStore().trayExpanded = true;
    await flushPromises();
    useClockStore().config.testMode = true;
    window.__catNext = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const row = () => w.get(`${tid('task-tray-item')}[data-title="Groceries"]`);
    try {
      await row().findAll(tid('tasklist-item'))[1].get('input[type=checkbox]').setValue(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(document.querySelector(tid('support-cat'))).not.toBeNull();
      // past the 2 s hold, the cat (3 s at Full) is still visiting: the list keeps its view and the tray stays open
      await vi.advanceTimersByTimeAsync(2500);
      expect(document.querySelector(tid('support-cat'))).not.toBeNull();
      expect(row().attributes('data-finished')).toBeUndefined();
      expect(row().find(tid('tasklist-expanded-title')).attributes('data-struck')).toBe('true');
      expect(useUiStore().trayExpanded).toBe(true);
      // the visit ends: the list moves to the finished rows
      await vi.advanceTimersByTimeAsync(600);
      expect(document.querySelector(tid('support-cat'))).toBeNull();
      expect(row().attributes('data-finished')).toBe('true');
      expect(useUiStore().trayExpanded).toBe(true);
    } finally {
      vi.useRealTimers();
      window.__catNext = false;
    }
  });
  it('a list finished in the tray keeps its place among the open lists while it is held', async () => {
    const a = tl('Apples', { done: [true, false] });
    const b = tl('Bakery', { done: [false] });
    const { pinia } = await setup({
      'GET /api/tasklists/open': () => ({ items: [a, b] }),
      'PATCH /api/tasklists/Apples/items/Apples-i1': ({ body }: { body: any }) => ({ ...a, items: [a.items[0], { ...a.items[1], ...body }], doneCount: 2 }),
    });
    useUiStore().trayExpanded = true;
    const w = mountIn(TaskTray, {}, pinia);
    await flushPromises();
    const titles = () => w.findAll(tid('task-tray-item')).map((r) => r.attributes('data-title'));
    expect(titles()).toEqual(['Apples', 'Bakery']);
    await w.get(`${tid('task-tray-item')}[data-title="Apples"]`).findAll(tid('tasklist-item'))[1].get('input[type=checkbox]').setValue(true);
    await flushPromises();
    expect(titles()).toEqual(['Apples', 'Bakery']);
  });
  it('without the cat, a list finished in the tray stays open for 2 s', async () => {
    const g = tl('Groceries', { done: [true, false] });
    const { pinia } = await setup({
      'GET /api/tasklists/open': () => ({ items: [g] }),
      'PATCH /api/tasklists/Groceries/items/Groceries-i1': ({ body }: { body: any }) => ({ ...g, items: [g.items[0], { ...g.items[1], ...body }], doneCount: 2 }),
    });
    useUiStore().trayExpanded = true;
    const w = mountIn(TaskTray, {}, pinia);
    await flushPromises();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const row = () => w.get(`${tid('task-tray-item')}[data-title="Groceries"]`);
    try {
      await row().findAll(tid('tasklist-item'))[1].get('input[type=checkbox]').setValue(true);
      await vi.advanceTimersByTimeAsync(1900);
      expect(document.querySelector(tid('support-cat'))).toBeNull();
      expect(row().attributes('data-finished')).toBeUndefined();
      await vi.advanceTimersByTimeAsync(200);
      expect(row().attributes('data-finished')).toBe('true');
    } finally {
      vi.useRealTimers();
    }
  });
  it('sets and clears --tray-h and refreshes through the sync store', async () => {
    const { pinia, m } = await setup();
    const w = mountIn(TaskTray, {}, pinia);
    await flushPromises();
    expect(document.documentElement.style.getPropertyValue('--tray-h')).not.toBe('');
    w.unmount();
    wrapper = null;
    expect(document.documentElement.style.getPropertyValue('--tray-h')).toBe('');
    expect(m.calls.some((c) => c.path === '/api/tasklists/open')).toBe(true);
    // carried list: its segment lands on today in the items store view
    const store = useTaskListsStore();
    expect(store.count).toBe(0);
  });
});

describe('dialog', () => {
  const fill = async (w: VueWrapper, title: string) => {
    await w.get(tid('tasklist-title')).setValue(title);
    await w.get('form').trigger('submit');
    await flushPromises();
  };
  it('rejects a blank title without items with "Add a title or an item" and stays open', async () => {
    const { pinia, m } = await setup();
    const w = mountIn(TaskListDialog, { mode: 'create', date: '2026-10-14' }, pinia);
    await fill(w, '');
    expect(w.get(tid('tasklist-error')).text()).toBe('Add a title or an item');
    await fill(w, '   ');
    expect(w.get(tid('tasklist-error')).text()).toBe('Add a title or an item');
    expect(w.emitted('close')).toBeUndefined();
    expect(m.calls.some((c) => c.method === 'POST')).toBe(false);
  });
  it('creates with items, category, estimate and closes (no tag field: tags are shelved)', async () => {
    const created: unknown[] = [];
    const { pinia } = await setup({ 'POST /api/tasklists': ({ body }) => { created.push(body); return { status: 201, body: tl('new', { title: body.title }) }; } });
    const w = mountIn(TaskListDialog, { mode: 'create', date: '2026-10-14' }, pinia);
    await w.get(tid('tasklist-title')).setValue('  Groceries ');
    await w.get(tid('tasklist-time')).setValue('18:00');
    await w.get(tid('tasklist-estimate')).setValue('45');
    await w.get(tid('tasklist-category')).setValue('shopping');
    expect(w.find(tid('tasklist-tags')).exists()).toBe(false);
    await w.get(tid('tasklist-items')).setValue('Milk\n\n  Eggs \n');
    await w.get(tid('tasklist-repeat')).setValue('weekly');
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(created[0]).toEqual({
      title: 'Groceries', date: '2026-10-14', time: '18:00', estimateMinutes: 45, categoryId: 'shopping',
      items: [{ title: 'Milk' }, { title: 'Eggs' }], recurrence: 'weekly', createdOn: '2026-10-12',
    });
    expect(w.emitted('close')).toHaveLength(1);
  });
  it('creates an untitled list from items only', async () => {
    const created: { title: string }[] = [];
    const { pinia } = await setup({ 'POST /api/tasklists': ({ body }) => { created.push(body); return { status: 201, body: tl('new', { title: '' }) }; } });
    const w = mountIn(TaskListDialog, { mode: 'create', date: '2026-10-14' }, pinia);
    await w.get(tid('tasklist-items')).setValue('Milk\nEggs');
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(created[0]).toMatchObject({ title: '', items: [{ title: 'Milk' }, { title: 'Eggs' }] });
    expect(w.emitted('close')).toHaveLength(1);
  });
  it('prefills the tapped slot time, and no time without one', async () => {
    const { pinia } = await setup();
    const w = mountIn(TaskListDialog, { mode: 'create', date: '2026-10-14', time: '15:00' }, pinia);
    expect((w.get(tid('tasklist-time')).element as HTMLInputElement).value).toBe('15:00');
    wrapper?.unmount();
    const v = mountIn(TaskListDialog, { mode: 'create', date: '2026-10-14' }, pinia);
    expect((v.get(tid('tasklist-time')).element as HTMLInputElement).value).toBe('');
  });
  it('editing sends no tags, so the stored tags are kept', async () => {
    const patches: Record<string, unknown>[] = [];
    const list = tl('G', { tags: ['weekend'] });
    const { pinia } = await setup({ 'PATCH /api/tasklists/G': ({ body }) => { patches.push(body); return { ...list, title: 'Mine' }; } });
    useItemsStore().upsert(list);
    const w = mountIn(TaskListDialog, { mode: 'edit', id: 'G' }, pinia);
    await flushPromises();
    expect(w.find(tid('tasklist-tags')).exists()).toBe(false);
    await fill(w, 'Mine');
    expect(patches).toHaveLength(1);
    expect(patches[0]).not.toHaveProperty('tags');
    expect(w.emitted('close')).toHaveLength(1);
  });
  it('editing adds the typed items to the list, one per line, and sends no title change', async () => {
    const added: { title: string }[] = [];
    const list = tl('G', { done: [true] });
    const { pinia, m } = await setup({
      'POST /api/tasklists/G/items': ({ body }) => { added.push(body); return tl('G', { done: [true, false, false] }); },
      'PATCH /api/tasklists/G': () => list,
    });
    useItemsStore().upsert(list);
    const w = mountIn(TaskListDialog, { mode: 'edit', id: 'G' }, pinia);
    await flushPromises();
    await w.get(tid('tasklist-items')).setValue('Eggs\n\n  Bread \n');
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(added.map((a) => a.title)).toEqual(['Eggs', 'Bread']);
    expect(m.calls.some((c) => c.method === 'PATCH')).toBe(false);
    expect(w.emitted('close')).toHaveLength(1);
    expect((useItemsStore().get('G') as TaskList).items.map((i) => i.title)).toEqual(['Milk', 'Eggs', 'Bread']);
  });
  it('editing refuses more items than a list may hold', async () => {
    const { pinia } = await setup();
    useItemsStore().upsert(tl('G', { done: new Array(199).fill(false) }));
    const w = mountIn(TaskListDialog, { mode: 'edit', id: 'G' }, pinia);
    await flushPromises();
    await w.get(tid('tasklist-items')).setValue('A\nB');
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(w.get(tid('tasklist-error')).text()).toBe('A task list can have 200 items at most');
    expect(w.emitted('close')).toBeUndefined();
  });
  it('answers a 412 by sending the same change again on the newest version', async () => {
    const list = tl('G');
    const m412 = { status: 412, body: { error: { code: 'PRECONDITION_FAILED', message: 'changed' } } };
    const { pinia, m } = await setup({
      'PATCH /api/tasklists/G': ({ headers }) => (headers['If-Match'] === '"new"' ? { ...list, title: 'Mine', etag: '"newer"' } : m412),
      'GET /api/tasklists/G': () => ({ ...list, title: 'Fresh', etag: '"new"' }),
    });
    useItemsStore().upsert(list);
    const w = mountIn(TaskListDialog, { mode: 'edit', id: 'G' }, pinia);
    await flushPromises();
    await fill(w, 'Mine');
    await flushPromises();
    expect(m.calls.filter((c) => c.method === 'PATCH').map((c) => [c.headers['If-Match'], c.body])).toEqual([[list.etag, { title: 'Mine' }], ['"new"', { title: 'Mine' }]]);
    expect(w.find(tid('tasklist-error')).exists()).toBe(false);
    expect(useItemsStore().get('G')).toMatchObject({ title: 'Mine', etag: '"newer"' });
  });
  it('validateForm', () => {
    const base = { title: 'x', date: '2026-10-14', time: '', estimate: '', categoryId: 'none', items: '', repeat: '' as const };
    expect(validateForm(base)).toBeNull();
    expect(validateForm({ ...base, title: ' ' })).toBe('Add a title or an item');
    expect(validateForm({ ...base, title: ' ', items: 'Milk\n' })).toBeNull();
    expect(validateForm({ ...base, title: '' }, 2)).toBeNull();
    expect(validateForm({ ...base, date: '2026-02-30' })).toBe('Pick a date');
    expect(validateForm({ ...base, estimate: '3' })).toMatch(/Estimate/);
    expect(validateForm({ ...base, estimate: '45.5' })).toMatch(/Estimate/);
  });
});

describe('filters', () => {
  it('apply the category/tag filters to the rendered task lists, events untouched', async () => {
    const { pinia } = await setup({}, '/week/2026-10-12?categories=work&tags=urgent');
    const items = useItemsStore();
    items.upsert(tl('A', { date: '2026-10-14', categoryId: 'work', tags: ['Urgent'] }));
    items.upsert(tl('B', { date: '2026-10-14', categoryId: 'work', tags: [] }));
    items.upsert(tl('C', { date: '2026-10-14', categoryId: 'home', tags: ['urgent'] }));
    items.upsert({ kind: 'event', id: 'E', calendarId: 'p', title: 'E', description: '', location: '', allDay: true, start: '2026-10-14', end: '2026-10-15', colorId: null, color: '#000', reminders: { useDefault: true, minutes: [] }, etag: 'e', updated: 'x' });
    let out: string[] = [];
    wrapper = mount(defineComponent({ setup() { const segs = useDaySegments(); return () => { out = segs('2026-10-14').map((s) => s.item.id); return h('div'); }; } }), { global: { plugins: [pinia, router] } });
    await flushPromises();
    expect(out.sort()).toEqual(['A', 'E']);
    await router.replace({ path: '/week/2026-10-12', query: { categories: 'none' } });
    await flushPromises();
    expect(out).toEqual(['E']);
  });
  it('a multi-day event is a bar in the views, but on each of its days where there is no bar row (withSpans)', async () => {
    const { pinia } = await setup();
    useItemsStore().upsert({ kind: 'event', id: 'M', calendarId: 'p', title: 'M', description: '', location: '', allDay: true, start: '2026-10-13', end: '2026-10-16', colorId: null, color: '#000', reminders: { useDefault: true, minutes: [] }, etag: 'e', updated: 'x' });
    let bars: string[] = [];
    let spans: string[] = [];
    wrapper = mount(defineComponent({ setup() {
      const plain = useDaySegments();
      const withSpans = useDaySegments({ withSpans: true });
      return () => { bars = plain('2026-10-14').map((s) => s.item.id); spans = withSpans('2026-10-14').map((s) => s.item.id); return h('div'); };
    } }), { global: { plugins: [pinia, router] } });
    await flushPromises();
    expect(bars).toEqual([]);
    expect(spans).toEqual(['M']);
  });
});

describe('cleanup', () => {
  it('leaves no timers or document listeners behind after tick, expand and close', async () => {
    enableTimerCounting();
    const add = vi.spyOn(document, 'addEventListener');
    const rem = vi.spyOn(document, 'removeEventListener');
    const list = tl('G');
    const { pinia } = await setup({ 'PATCH /api/tasklists/G/items/G-i0': () => ({ ...list, items: [{ ...list.items[0], done: true }, ...list.items.slice(1)], doneCount: 1 }) });
    useItemsStore().upsert(list);
    for (let i = 0; i < 5; i++) {
      const w = mountIn(ExpandedTaskList, { id: 'G' }, pinia);
      await flushPromises();
      await w.findAll('input[type=checkbox]')[0].setValue(true);
      await flushPromises();
      w.unmount();
      wrapper = null;
    }
    expect(window.__appTimers ?? 0).toBe(0);
    const net = (spy: typeof add) => spy.mock.calls.filter((c) => c[0] === 'keydown').length;
    expect(net(add)).toBe(net(rem));
    expect(document.querySelectorAll('[data-testid="tasklist-expanded"]').length).toBe(0);
    enableTimerCounting(false);
  });
});

describe('swipe down closes the real task sheets (phone)', () => {
  const touch = (el: Element, type: string, y: number, t: number) => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: 100, clientY: y }] });
    Object.defineProperty(e, 'timeStamp', { value: t });
    el.dispatchEvent(e);
  };
  const swipe = (el: Element) => { touch(el, 'touchstart', 100, 0); touch(el, 'touchmove', 160, 30); touch(el, 'touchmove', 300, 60); touch(el, 'touchend', 300, 60); };
  afterEach(() => setAnimationSetting('full'));
  it('expanded task list: from the header and from a checkbox row', async () => {
    setAnimationSetting('off');
    const { pinia } = await setup();
    useItemsStore().upsert(tl('G'));
    const w = mountIn(ExpandedTaskList, { id: 'G' }, pinia);
    await flushPromises();
    expect(w.get(tid('tasklist-expanded')).attributes('data-tasklist-id')).toBe('G');
    swipe(w.get(tid('tasklist-expanded-title')).element);
    expect(w.emitted('close')).toHaveLength(1);
    swipe(w.get(tid('tasklist-item-checkbox')).element);
    expect(w.emitted('close')).toHaveLength(2);
  });
  it('task list dialog', async () => {
    setAnimationSetting('off');
    const { pinia } = await setup();
    const w = mountIn(TaskListDialog, { mode: 'create', date: '2026-10-14' }, pinia);
    await flushPromises();
    swipe(w.get(tid('tasklist-dialog')).element);
    expect(w.emitted('close')).toHaveLength(1);
  });
});
