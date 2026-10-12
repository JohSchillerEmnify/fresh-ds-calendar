import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { TaskList } from '@/api/types';
import { dragPreview, planMove } from '@/features/calendar/dnd';
import { checkState } from '@/features/tasklists/format';
import { allotHeights, fitItems } from '@/features/tasklists/layout';
import TaskListCard from '@/features/tasklists/TaskListCard.vue';
import { itemSegments } from '@/lib/items';
import { useItemsStore } from '@/stores/items';
import { config, freshPinia, mockFetch } from './helpers';
import { flush, installWaapi, pe, removeWaapi } from './motion/helpers';

const base = { kind: 'tasklist', id: 'l', calendarId: 'primary', title: 'Groceries', date: '2026-10-14', time: null, items: [], doneCount: 0, totalCount: 0, estimateMinutes: null, color: '#039be5', etag: 'e0' };
const list = (o: Partial<TaskList> = {}): TaskList => ({ ...base, ...o }) as unknown as TaskList;
const mk = (n: number, done = 0) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, title: `Item ${i}`, done: i < done }));
const TZ = 'Europe/Berlin';

describe('fitItems (line budget)', () => {
  const g = { titleH: 17, rowH: 14, pad: 5 };
  it('shows everything when there is room', () => {
    expect(fitItems({ ...g, count: 3, height: 80 })).toEqual({ shown: 3, more: 0, inline: false });
  });
  it('shows what fits plus a "+k" line', () => {
    expect(fitItems({ ...g, count: 6, height: 17 + 5 + 14 * 3 })).toEqual({ shown: 2, more: 4, inline: false });
  });
  it('never drops to the title only: at least minLines lines', () => {
    expect(fitItems({ ...g, count: 5, height: 20 })).toEqual({ shown: 1, more: 4, inline: false });
    expect(fitItems({ ...g, count: 5, height: 20, minLines: 3 })).toEqual({ shown: 2, more: 3, inline: false });
    expect(fitItems({ ...g, count: 1, height: 20 })).toEqual({ shown: 1, more: 0, inline: false });
  });
  it('unmeasured uses maxLines; empty list shows nothing', () => {
    expect(fitItems({ ...g, count: 9, maxLines: 4 })).toEqual({ shown: 3, more: 6, inline: false });
    expect(fitItems({ ...g, count: 0, height: 100 })).toEqual({ shown: 0, more: 0, inline: false });
  });
  it('accounts for the footer row', () => {
    expect(fitItems({ ...g, count: 4, height: 17 + 5 + 14 * 4, footH: 14 }).shown).toBe(2);
  });
  it('timed blocks without a spare row go inline', () => {
    expect(fitItems({ ...g, count: 3, height: 22, minLines: 0 })).toEqual({ shown: 3, more: 0, inline: true });
    expect(fitItems({ ...g, count: 3, height: 60, minLines: 0, maxLines: 12 }).inline).toBe(false);
  });
});

describe('allotHeights', () => {
  it('gives everyone what they need when it fits', () => expect(allotHeights([30, 50], 100, 16)).toEqual([30, 50]));
  it('shares the rest of a small cell with the hungry entry', () => expect(allotHeights([20, 80], 60, 16)).toEqual([20, 40]));
  it('splits evenly when all are hungry and never goes below min', () => {
    expect(allotHeights([80, 80], 60, 16)).toEqual([30, 30]);
    expect(allotHeights([80, 80], 20, 16)).toEqual([16, 16]);
  });
});

describe('checkState glyph', () => {
  it('empty / partial / done', () => {
    expect(checkState(0, 3)).toEqual({ state: 'empty', fill: 0 });
    expect(checkState(0, 0)).toEqual({ state: 'empty', fill: 0 });
    expect(checkState(1, 3)).toEqual({ state: 'partial', fill: 33 });
    expect(checkState(3, 3)).toEqual({ state: 'done', fill: 100 });
  });
  it('partial fill stays visibly partial', () => {
    expect(checkState(1, 100).fill).toBe(15);
    expect(checkState(99, 100).fill).toBe(85);
  });
});

describe('planMove for task lists', () => {
  const seg = (tl: TaskList, today?: string) => itemSegments(tl, today)[0];
  it('month: moves the date, keeps the time', () => {
    const p = planMove(seg(list({ time: '18:00' })), { date: '2026-10-20', minutes: null }, TZ)!;
    expect(p.patch).toEqual({ date: '2026-10-20' });
    expect(p.next).toMatchObject({ date: '2026-10-20', time: '18:00' });
  });
  it('time grid: date and 15 minute time; all-day lists gain a time', () => {
    expect(planMove(seg(list({ time: '18:00' })), { date: '2026-10-16', minutes: 8 * 60 + 15 }, TZ)!.patch).toEqual({ date: '2026-10-16', time: '08:15' });
    expect(planMove(seg(list()), { date: '2026-10-14', minutes: 9 * 60 }, TZ)!.patch).toEqual({ date: '2026-10-14', time: '09:00' });
  });
  it('all-day row: timed lists lose their time', () => {
    expect(planMove(seg(list({ time: '18:00' })), { date: '2026-10-15', minutes: null, allDay: true }, TZ)!.patch).toEqual({ date: '2026-10-15', time: null });
    expect(planMove(seg(list({ time: '18:00' })), { date: '2026-10-14', minutes: null, allDay: true }, TZ)!.patch).toEqual({ time: null, date: '2026-10-14' });
  });
  it('no change gives null', () => {
    expect(planMove(seg(list()), { date: '2026-10-14', minutes: null, allDay: true }, TZ)).toBeNull();
    expect(planMove(seg(list({ time: '18:00' })), { date: '2026-10-14', minutes: 18 * 60 }, TZ)).toBeNull();
  });
  it('carried-over list: moves its real date, not the day it is shown on', () => {
    const open = list({ date: '2026-10-10', items: mk(2), totalCount: 2 });
    const s = seg(open, '2026-10-12');
    expect(s.date).toBe('2026-10-12');
    expect(planMove(s, { date: '2026-10-12', minutes: null, allDay: true }, TZ)!.patch).toEqual({ date: '2026-10-12' });
    expect(planMove(s, { date: '2026-10-10', minutes: null, allDay: true }, TZ)).toBeNull();
    expect(planMove(s, { date: '2026-10-13', minutes: 10 * 60 }, TZ)!.patch).toEqual({ date: '2026-10-13', time: '10:00' });
  });
});

describe('TaskListCard in a grid', () => {
  beforeEach(() => { installWaapi(); document.body.innerHTML = ''; });
  afterEach(() => removeWaapi());
  const rect = (l: number, tp: number, wd: number, ht: number) => ({ left: l, top: tp, right: l + wd, bottom: tp + ht, width: wd, height: ht, x: l, y: tp, toJSON() { /* */ } }) as DOMRect;

  async function mountWeek(tl: TaskList, variant: 'allday' | 'block') {
    const dates = ['12', '13', '14', '15', '16', '17', '18'].map((d) => `2026-10-${d}`);
    const seg = itemSegments(tl)[0];
    const Harness = defineComponent({
      setup: () => () => h('div', { class: 'tg' }, [
        h('div', { class: 'alldays' }, dates.map((d) => h('div', { 'data-testid': 'week-allday-cell', 'data-date': d }, d === tl.date && variant === 'allday' ? [h(TaskListCard, { segment: seg, variant })] : []))),
        h('div', { 'data-scroll-area': '' }, [h('div', { 'data-testid': 'time-grid', 'data-hour-height': 48 }, [
          ...dates.map((d) => h('div', { 'data-testid': 'week-day-column', 'data-date': d }, d === tl.date && variant === 'block' ? [h(TaskListCard, { segment: seg, variant, height: 48 })] : [])),
        ])]),
      ]),
    });
    const w = mount(Harness, { attachTo: document.body });
    w.findAll('[data-testid=week-allday-cell]').forEach((c, i) => { c.element.getBoundingClientRect = () => rect(44 + 100 * i, 0, 100, 40); });
    w.get('[data-testid=time-grid]').element.getBoundingClientRect = () => rect(0, 60, 744, 1152);
    w.findAll('[data-testid=week-day-column]').forEach((c, i) => { c.element.getBoundingClientRect = () => rect(44 + 100 * i, 60, 100, 1152); });
    const card = w.get('[data-testid=tasklist-card]').element as HTMLElement;
    card.getBoundingClientRect = () => (variant === 'allday' ? rect(244, 0, 100, 30) : rect(244, 60 + 432, 100, 48));
    await flushPromises();
    return { w, card };
  }
  async function drag(card: HTMLElement, x: number, y: number) {
    card.dispatchEvent(pe('pointerdown', { x: 250, y: card.getBoundingClientRect().top + 8 }));
    window.dispatchEvent(pe('pointermove', { x: 260, y: 20 }));
    window.dispatchEvent(pe('pointermove', { x, y }));
    window.dispatchEvent(pe('pointerup', { x, y }));
    await flush();
    await flushPromises();
  }

  it('all-day list dropped into the time grid gets a snapped time (optimistic PATCH with If-Match)', async () => {
    freshPinia();
    const tl = list({ items: mk(3, 1), doneCount: 1, totalCount: 3 });
    const m = mockFetch({ 'GET /api/config': () => config(), 'PATCH /api/tasklists/l': ({ body }) => ({ ...tl, ...body, etag: 'new' }) });
    const items = useItemsStore();
    items.upsert(tl);
    const { card } = await mountWeek(tl, 'allday');
    await drag(card, 494, 60 + 14 * 48 + 5);
    const call = m.calls.find((c) => c.method === 'PATCH')!;
    expect(call.headers['If-Match']).toBe('e0');
    expect(call.body).toEqual({ date: '2026-10-16', time: '14:00' });
    expect(dragPreview.value).toBeNull();
  });

  it('timed block dropped on an all-day cell loses its time', async () => {
    freshPinia();
    const tl = list({ time: '18:00', items: mk(2), totalCount: 2 });
    const m = mockFetch({ 'GET /api/config': () => config(), 'PATCH /api/tasklists/l': ({ body }) => ({ ...tl, ...body, etag: 'new' }) });
    useItemsStore().upsert(tl);
    const { card } = await mountWeek(tl, 'block');
    await drag(card, 494, 20);
    expect(m.calls.find((c) => c.method === 'PATCH')!.body).toEqual({ date: '2026-10-16', time: null });
  });

  it('a tap opens, no PATCH; listeners are cleaned up on unmount mid-drag', async () => {
    freshPinia();
    const tl = list({ items: mk(2), totalCount: 2 });
    const m = mockFetch({ 'GET /api/config': () => config() });
    useItemsStore().upsert(tl);
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { w, card } = await mountWeek(tl, 'allday');
    card.dispatchEvent(pe('pointerdown', { x: 250, y: 8 }));
    window.dispatchEvent(pe('pointerup', { x: 250, y: 8 }));
    await flush();
    expect(m.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
    card.dispatchEvent(pe('pointerdown', { x: 250, y: 8 }));
    window.dispatchEvent(pe('pointermove', { x: 270, y: 20 }));
    expect(card.dataset.dragging).toBe('true');
    w.unmount();
    const added = add.mock.calls.map((c) => c[0]), removed = remove.mock.calls.map((c) => c[0]);
    for (const type of new Set(added)) expect(removed.filter((r) => r === type).length).toBeGreaterThanOrEqual(added.filter((a) => a === type).length);
    add.mockRestore(); remove.mockRestore();
  });

  it('keeps every item in the text, marks surplus as over and shows "+k"', async () => {
    freshPinia();
    const tl = list({ items: mk(6, 1), doneCount: 1, totalCount: 6 });
    const w = mount(TaskListCard, { props: { segment: itemSegments(tl)[0], variant: 'card', height: 17 + 5 + 14 * 3 } });
    expect(w.get('[data-testid=tasklist-card-items]').text()).toBe('Item 0, Item 1, Item 2, Item 3, Item 4, Item 5');
    expect(w.findAll('.it.over')).toHaveLength(4);
    expect(w.get('[data-testid=tasklist-card-more]').text()).toBe('+4 more');
    expect(w.get('[data-testid=tasklist-card-check]').attributes('data-state')).toBe('partial');
    expect(w.findAll('.it.done')).toHaveLength(1);
  });
});
