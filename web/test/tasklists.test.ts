import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, type Router } from 'vue-router';
import { createAppRouter } from '@/router';
import type { TaskList } from '@/api/types';
import { displayTitle, itemSegments } from '@/lib/items';
import { enableTimerCounting } from '@/lib/timers';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { useDaySegments } from '@/composables/useDaySegments';
import ExpandedTaskList from '@/features/tasklists/ExpandedTaskList.vue';
import TaskListCard from '@/features/tasklists/TaskListCard.vue';
import TaskListDialog from '@/features/tasklists/TaskListDialog.vue';
import TaskTray from '@/features/tasklists/TaskTray.vue';
import { setAnimationSetting } from '@/motion/level';
import { carriedLabel, formatEstimate } from '@/features/tasklists/format';
import { useTaskListsStore } from '@/features/tasklists/store';
import { catSwipe } from '@/features/motivation/supportCat';
import { validateForm } from '@/features/tasklists/validate';
import { config, freshPinia, mockFetch, settingsFixture } from './helpers';

const celebrate = vi.fn();
vi.mock('@/motion/useCelebrate', () => ({ useCelebrate: () => ({ celebrate }) }));

function tl(id: string, o: Partial<TaskList> & { done?: boolean[] } = {}): TaskList {
  const flags = o.done ?? [false, false, false];
  const items = flags.map((d, i) => ({ id: `${id}-i${i}`, title: ['Milk', 'Eggs', 'Bread', 'Jam'][i] ?? `Item ${i}`, done: d }));
  const { done: _d, ...rest } = o;
  return {
    kind: 'tasklist', id, calendarId: 'primary', title: id, date: '2026-10-12', time: null, items, doneCount: items.filter((i) => i.done).length,
    totalCount: items.length, estimateMinutes: null, recurrence: null, categoryId: null, tags: [], color: '#039be5', etag: `"e-${id}"`, updated: 'x', ...rest,
  };
}
const seg = (item: TaskList, today = '2026-10-12') => itemSegments(item, today)[0];
const tid = (id: string) => `[data-testid="${id}"]`;

let wrapper: VueWrapper | null = null;
let router: Router;
async function setup(routes: Record<string, (r: { body: any; url: URL }) => unknown> = {}, path = '/week/2026-10-12') {
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
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.restoreAllMocks(); });

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
  it('shows an untitled list as "List" (card, tray, expanded list)', async () => {
    const list = tl('U', { title: '' });
    expect(displayTitle(list)).toBe('List');
    expect(displayTitle({ kind: 'event', title: '' })).toBe('');
    const { pinia } = await setup({ 'GET /api/tasklists/open': () => ({ items: [list] }) });
    const w = mountIn(TaskListCard, { segment: seg(list), variant: 'chip' }, pinia);
    expect(w.get(tid('tasklist-card-title')).text()).toBe('List');
    expect(w.get(tid('tasklist-card')).attributes('data-title')).toBe('List');
    w.unmount();
    const tray = mountIn(TaskTray, {}, pinia);
    await flushPromises();
    expect(tray.get(tid('task-tray-item')).attributes('data-title')).toBe('List');
    expect(tray.get(tid('tasklist-expanded-title')).text()).toBe('List');
    tray.unmount();
    useItemsStore().upsert(list);
    mountIn(ExpandedTaskList, { id: 'U' }, pinia);
    await flushPromises();
    expect(document.querySelector(tid('tasklist-expanded-title'))?.textContent?.trim()).toBe('List');
  });
  it('says "No items" for an empty list and exposes the root element for drag and drop', async () => {
    const { pinia } = await setup();
    const w = mountIn(TaskListCard, { segment: seg(tl('Ideas', { done: [] })), variant: 'chip' }, pinia);
    expect(w.get(tid('tasklist-card-items')).text()).toBe('No items');
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
      if (behaviour.fail?.(call)) return { status: 500, body: { error: { code: 'INTERNAL', message: 'boom' } } };
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

  it('renders items and ticks optimistically with one PATCH', async () => {
    const list = tl('G', { done: [true, false, false] });
    const s = server(list);
    const { w, m } = await open(list, { 'PATCH /api/tasklists/G/items/G-i1': s.handler });
    expect(done(w)).toEqual(['true', 'false', 'false']);
    expect(w.get(tid('tasklist-next-task')).text()).toContain('Eggs');
    await checkbox(w, 1).setValue(true);
    expect(done(w)).toEqual(['true', 'true', 'false']); // before the response
    await flushPromises();
    expect(m.calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
    expect(w.get(tid('tasklist-expanded-count')).text()).toBe('2/3');
  });

  it('rolls back and shows a snackbar when the request fails', async () => {
    const list = tl('G');
    const s = server(list, { fail: () => true });
    const { w } = await open(list, { 'PATCH /api/tasklists/G/items/G-i0': s.handler });
    await checkbox(w, 0).setValue(true);
    expect(done(w)[0]).toBe('true');
    await flushPromises();
    expect(done(w)[0]).toBe('false');
    expect(useUiStore().snackbars.some((x) => x.testid === 'tasklist-rollback')).toBe(true);
    expect(useItemsStore().get('G')).toMatchObject({ doneCount: 0 });
  });

  it('rapid ticks stay correct: one failure rolls back only itself, others survive', async () => {
    const list = tl('G');
    const s = server(list, { fail: (n) => n === 2, delay: 5 });
    const { w } = await open(list, {
      'PATCH /api/tasklists/G/items/G-i0': s.handler, 'PATCH /api/tasklists/G/items/G-i1': s.handler, 'PATCH /api/tasklists/G/items/G-i2': s.handler,
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

  it('merges unsent patches for the same item: last write wins', async () => {
    const list = tl('G');
    const s = server(list, { delay: 10 });
    const { w } = await open(list, { 'PATCH /api/tasklists/G/items/G-i0': s.handler, 'PATCH /api/tasklists/G/items/G-i1': s.handler });
    await checkbox(w, 1).setValue(true); // goes in flight
    await checkbox(w, 0).setValue(true); // queued
    await checkbox(w, 0).setValue(false); // merges into the queued op
    await checkbox(w, 0).setValue(true);
    await new Promise((r) => setTimeout(r, 60));
    await flushPromises();
    expect(s.log).toHaveLength(2);
    expect(s.log[1]).toEqual({ itemId: 'G-i0', body: { done: true } });
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
      'POST /api/tasklists/G/items': ({ body }: any) => (state = { ...state, items: [...state.items, { id: 'new1', title: body.title, done: false }], totalCount: state.totalCount + 1 }),
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
    await w.findAll(tid('tasklist-item-up'))[1].trigger('click');
    expect(w.findAll(tid('tasklist-item-title')).map((x) => x.text())).toEqual(['Bread', 'Oat milk', 'Butter']);
    await flushPromises();
    expect(m.calls.filter((c) => c.method === 'DELETE' || c.method === 'PUT').map((c) => c.method)).toEqual(['DELETE', 'PUT']);
    expect(m.calls.find((c) => c.method === 'PUT')!.body.itemIds).toEqual(['G-i2', 'G-i0', 'new1']);
  });
});

describe('open tasks tray', () => {
  it('lists open lists with carry-over labels and counts', async () => {
    const laundry = tl('Laundry', { date: '2026-10-10', done: [true, false] });
    const groceries = tl('Groceries', { done: [false] });
    const packing = tl('Packing', { time: '18:00', done: [false] });
    const { pinia } = await setup({ 'GET /api/tasklists/open': () => ({ items: [laundry, groceries, packing] }) });
    const w = mountIn(TaskTray, {}, pinia);
    await flushPromises();
    expect(w.get(tid('task-tray-count')).text()).toBe('3 open');
    const rows = w.findAll(tid('task-tray-item'));
    expect(rows.map((r) => r.attributes('data-title'))).toEqual(['Laundry', 'Groceries', 'Packing']);
    expect(rows[0].text()).toContain('From Sat 10 Oct');
    expect(rows[1].text()).not.toContain('From');
    expect(w.findAll(tid('tasklist-move-today'))).toHaveLength(1); // the shared task list view's button
  });
  it('count follows ticks and shows "No open tasks" when empty', async () => {
    const g = tl('Groceries', { done: [false] });
    const { pinia } = await setup({ 'GET /api/tasklists/open': () => ({ items: [g] }) });
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
      items: [{ title: 'Milk' }, { title: 'Eggs' }], recurrence: 'weekly',
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
  it('shows a conflict message on 412 with a reload button', async () => {
    const list = tl('G');
    const { pinia } = await setup({
      'PATCH /api/tasklists/G': () => ({ status: 412, body: { error: { code: 'PRECONDITION_FAILED', message: 'changed' } } }),
      'GET /api/tasklists/G': () => ({ ...list, title: 'Fresh', etag: '"new"' }),
    });
    useItemsStore().upsert(list);
    const w = mountIn(TaskListDialog, { mode: 'edit', id: 'G' }, pinia);
    await flushPromises();
    await fill(w, 'Mine');
    expect(w.get(tid('tasklist-error')).text()).toContain('changed elsewhere');
    await w.get(tid('tasklist-reload')).trigger('click');
    await flushPromises();
    expect((w.get(tid('tasklist-title')).element as HTMLInputElement).value).toBe('Fresh');
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
    items.upsert({ kind: 'event', id: 'E', calendarId: 'p', title: 'E', description: '', location: '', allDay: true, start: '2026-10-14', end: '2026-10-15', colorId: null, color: '#000', etag: 'e', updated: 'x' });
    let out: string[] = [];
    wrapper = mount(defineComponent({ setup() { const segs = useDaySegments(); return () => { out = segs('2026-10-14').map((s) => s.item.id); return h('div'); }; } }), { global: { plugins: [pinia, router] } });
    await flushPromises();
    expect(out.sort()).toEqual(['A', 'E']);
    await router.replace({ path: '/week/2026-10-12', query: { categories: 'none' } });
    await flushPromises();
    expect(out).toEqual(['E']);
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
