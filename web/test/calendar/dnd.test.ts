import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import EventItem from '@/features/calendar/EventItem.vue';
import { dragPreview, planMove } from '@/features/calendar/dnd';
import { itemSegments } from '@/lib/items';
import { useItemsStore } from '@/stores/items';
import { useUiStore } from '@/stores/ui';
import { apiError, config, freshPinia, mockFetch } from '../helpers';
import { flush, installWaapi, pe, removeWaapi } from '../motion/helpers';
import { ev, t } from './helpers';

const dentist = ev('dentist', t('2026-10-14', '09:00'), t('2026-10-14', '10:00'), { title: 'Dentist' });
const seg = () => itemSegments(dentist)[0];

describe('planMove', () => {
  it('moves a timed event keeping its duration and DST offset', () => {
    const p = planMove(seg(), { date: '2026-10-26', minutes: 14 * 60 + 15 }, 'Europe/Berlin')!;
    expect(p.patch).toEqual({ start: '2026-10-26T14:15:00+01:00', end: '2026-10-26T15:15:00+01:00', allDay: false });
  });
  it('month drops keep the time of day; no change gives null', () => {
    const p = planMove(seg(), { date: '2026-10-21', minutes: null }, 'Europe/Berlin')!;
    expect(p.patch).toMatchObject({ start: '2026-10-21T09:00:00+02:00', end: '2026-10-21T10:00:00+02:00' });
    expect(planMove(seg(), { date: '2026-10-14', minutes: 9 * 60 }, 'Europe/Berlin')).toBeNull();
  });
  it('all-day events shift by days and stay all-day', () => {
    const trip = { ...ev('trip', '2026-10-14', '2026-10-16'), allDay: true, title: 'Trip' };
    const p = planMove(itemSegments(trip)[0], { date: '2026-10-16', minutes: null }, 'Europe/Berlin')!;
    expect(p.patch).toEqual({ start: '2026-10-16', end: '2026-10-18', allDay: true });
  });
  it('dragging the second day of a multi-day event moves by the delta', () => {
    const night = ev('n', t('2026-10-14', '22:00'), t('2026-10-15', '02:00'));
    const second = itemSegments(night)[1];
    const p = planMove(second, { date: '2026-10-16', minutes: 0 }, 'Europe/Berlin')!;
    expect(p.patch).toMatchObject({ start: '2026-10-15T22:00:00+02:00', end: '2026-10-16T02:00:00+02:00' });
  });
  it('task lists: date only for untimed, date and time for timed', () => {
    const base = { kind: 'tasklist', id: 'l', title: 'G', date: '2026-10-14', items: [], doneCount: 0, totalCount: 0, color: '#000', etag: 'e' } as never;
    const untimed = itemSegments({ ...(base as object), time: null } as never)[0];
    expect(planMove(untimed, { date: '2026-10-15', minutes: null }, 'Europe/Berlin')!.patch).toEqual({ date: '2026-10-15' });
    const timed = itemSegments({ ...(base as object), time: '18:00' } as never)[0];
    expect(planMove(timed, { date: '2026-10-16', minutes: 8 * 60 + 15 }, 'Europe/Berlin')!.patch).toEqual({ date: '2026-10-16', time: '08:15' });
  });
});

/** A fake time grid with real layout numbers: gutter 44, 7 columns of 100 px, 48 px per hour. */
async function mountGrid() {
  const dates = ['12', '13', '14', '15', '16', '17', '18'].map((d) => `2026-10-${d}`);
  const Harness = defineComponent({
    setup: () => () => h('div', { class: 'tg' }, [h('div', { 'data-scroll-area': '' }, [
      h('div', { 'data-testid': 'time-grid', 'data-hour-height': 48 }, [
        h('div', { class: 'gutter' }),
        ...dates.map((d) => h('div', { 'data-testid': 'week-day-column', 'data-date': d }, d === '2026-10-14' ? [h(EventItem, { segment: seg(), variant: 'block', height: 48 })] : [])),
      ]),
    ])]),
  });
  const w = mount(Harness, { attachTo: document.body });
  const rect = (l: number, tp: number, wd: number, ht: number) => ({ left: l, top: tp, right: l + wd, bottom: tp + ht, width: wd, height: ht, x: l, y: tp, toJSON() { /* */ } }) as DOMRect;
  w.get('[data-testid=time-grid]').element.getBoundingClientRect = () => rect(0, 0, 744, 1152);
  w.findAll('[data-testid=week-day-column]').forEach((c, i) => { c.element.getBoundingClientRect = () => rect(44 + 100 * i, 0, 100, 1152); });
  const card = w.get('[data-testid=event-chip]');
  card.element.getBoundingClientRect = () => rect(244, 432, 100, 48);
  await flushPromises();
  return { w, card: card.element as HTMLElement };
}

async function dragTo(card: HTMLElement, x: number, y: number) {
  card.dispatchEvent(pe('pointerdown', { x: 250, y: 440 }));
  window.dispatchEvent(pe('pointermove', { x: 260, y: 450 }));
  window.dispatchEvent(pe('pointermove', { x, y }));
  window.dispatchEvent(pe('pointerup', { x, y }));
  await flush();
  await flushPromises();
}

describe('drag and drop persistence', () => {
  beforeEach(() => { installWaapi(); document.body.innerHTML = ''; });
  afterEach(() => removeWaapi());

  it('drops on Friday 14:00: optimistic move, PATCH with If-Match, snapped to 15 min', async () => {
    freshPinia();
    const m = mockFetch({
      'GET /api/config': () => config(),
      'PATCH /api/events/dentist': ({ body }) => ({ ...dentist, ...body, etag: 'new' }),
    });
    const items = useItemsStore();
    items.upsert(dentist);
    const { card } = await mountGrid();
    // y: 14:00 + grab offset 8, plus 5 px so it has to snap
    await dragTo(card, 494, 14 * 48 + 8 + 5);
    const call = m.calls.find((c) => c.method === 'PATCH')!;
    expect(call.headers['If-Match']).toBe(dentist.etag);
    expect(call.body).toEqual({ start: '2026-10-16T14:00:00+02:00', end: '2026-10-16T15:00:00+02:00', allDay: false });
    expect((items.get('dentist') as typeof dentist).start).toBe('2026-10-16T14:00:00+02:00');
    expect(items.get('dentist')!.etag).toBe('new');
    expect(dragPreview.value).toBeNull();
  });

  it('a failed save rolls the store back, notifies and keeps the card', async () => {
    freshPinia();
    mockFetch({ 'GET /api/config': () => config(), 'PATCH /api/events/dentist': () => apiError(503, 'PROVIDER_UNAVAILABLE') });
    const items = useItemsStore();
    items.upsert(dentist);
    const { card } = await mountGrid();
    await dragTo(card, 494, 14 * 48 + 8);
    expect((items.get('dentist') as typeof dentist).start).toBe(dentist.start);
    expect(useUiStore().snackbars.some((s) => s.testid === 'move-failed')).toBe(true);
  });

  it('releasing without moving changes nothing and does not PATCH', async () => {
    freshPinia();
    const m = mockFetch({ 'GET /api/config': () => config() });
    useItemsStore().upsert(dentist);
    const { card } = await mountGrid();
    card.dispatchEvent(pe('pointerdown', { x: 250, y: 440 }));
    window.dispatchEvent(pe('pointerup', { x: 250, y: 440 }));
    await flush();
    expect(m.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
  });

  it('leaves no window listeners or timers after unmount mid-drag', async () => {
    freshPinia();
    mockFetch({ 'GET /api/config': () => config() });
    useItemsStore().upsert(dentist);
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { w, card } = await mountGrid();
    card.dispatchEvent(pe('pointerdown', { x: 250, y: 440 }));
    window.dispatchEvent(pe('pointermove', { x: 260, y: 450 }));
    expect(card.dataset.dragging).toBe('true');
    w.unmount();
    const added = add.mock.calls.map((c) => c[0]), removed = remove.mock.calls.map((c) => c[0]);
    for (const type of new Set(added)) expect(removed.filter((r) => r === type).length).toBeGreaterThanOrEqual(added.filter((a) => a === type).length);
    add.mockRestore(); remove.mockRestore();
    expect(dragPreview.value).toBeNull();
  });
});
