/** Turning the day or week while dragging: the hold times (feature drag-to-reschedule, owner 2026-10-25). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { routerKey } from 'vue-router';
import EventItem from '@/features/calendar/EventItem.vue';
import { edgeBand } from '@/features/calendar/dnd';
import { itemSegments } from '@/lib/items';
import { parseIsoDate } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useItemsStore } from '@/stores/items';
import { config, freshPinia, mockFetch } from '../helpers';
import { installWaapi, pe, removeWaapi } from '../motion/helpers';
import { ev, t } from './helpers';

const dentist = ev('dentist', t('2026-10-14', '09:00'), t('2026-10-14', '10:00'), { title: 'Dentist' });
const rect = (l: number, tp: number, wd: number, ht: number) => ({ left: l, top: tp, right: l + wd, bottom: tp + ht, width: wd, height: ht, x: l, y: tp, toJSON() { /* */ } }) as DOMRect;

/** A day (one 300 px column) or week (seven 100 px columns) grid after a 44 px gutter, with Dentist on 2026-10-14. */
async function mountGrid(view: 'day' | 'week', push: ReturnType<typeof vi.fn>) {
  const dates = view === 'day' ? ['2026-10-14'] : ['12', '13', '14', '15', '16', '17', '18'].map((d) => `2026-10-${d}`);
  const colId = view === 'day' ? 'day-column' : 'week-day-column';
  const width = view === 'day' ? 300 : 100;
  const Harness = defineComponent({
    setup: () => () => h('div', { class: 'tg' }, [h('div', { 'data-scroll-area': '' }, [
      h('div', { 'data-testid': 'time-grid', 'data-hour-height': 48 }, [
        h('div', { class: 'gutter' }),
        ...dates.map((d) => h('div', { 'data-testid': colId, 'data-date': d }, d === '2026-10-14' ? [h(EventItem, { segment: itemSegments(dentist)[0], variant: 'block', height: 48 })] : [])),
      ]),
    ])]),
  });
  const router = { push, currentRoute: { value: { query: {} } } };
  const w = mount(Harness, { attachTo: document.body, global: { provide: { [routerKey as symbol]: router } } });
  const right = 44 + width * dates.length;
  (w.element as HTMLElement).getBoundingClientRect = () => rect(0, 0, right, 1152);
  w.get('[data-testid=time-grid]').element.getBoundingClientRect = () => rect(0, 0, right, 1152);
  w.findAll(`[data-testid=${colId}]`).forEach((c, i) => { c.element.getBoundingClientRect = () => rect(44 + width * i, 0, width, 1152); });
  const card = w.get('[data-testid=event-chip]').element as HTMLElement;
  const col = dates.indexOf('2026-10-14');
  card.getBoundingClientRect = () => rect(44 + width * col, 432, width, 48);
  await flushPromises();
  return { w, card, right, x: 44 + width * col + 10 };
}

describe('the hold before the view turns', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
    installWaapi();
    document.body.innerHTML = '';
    freshPinia();
    mockFetch({ 'GET /api/config': () => config() });
    useItemsStore().upsert(dentist);
  });
  afterEach(() => { removeWaapi(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  for (const [view, hold, path] of [['day', 600, '/day/2026-10-15'], ['week', 1000, '/week/']] as const) {
    it(`${view} view: turns after ${hold} ms at the edge, not a millisecond earlier, and the band goes with the drag`, async () => {
      const cal = useCalendarStore();
      cal.view = view;
      cal.anchor = parseIsoDate('2026-10-14')!;
      const push = vi.fn(async () => {});
      const { w, card, right, x } = await mountGrid(view, push);
      card.dispatchEvent(pe('pointerdown', { x, y: 440 }));
      window.dispatchEvent(pe('pointermove', { x: x + 10, y: 440 }));
      window.dispatchEvent(pe('pointermove', { x: right - 6, y: 440 }));
      expect(edgeBand.value?.side).toBe('right');
      vi.advanceTimersByTime(hold - 1);
      expect(push).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(push).toHaveBeenCalledTimes(1);
      expect((push.mock.calls[0] as unknown as [{ path: string }])[0].path.startsWith(path)).toBe(true);
      // the card's component goes mid-drag (as when its day leaves the screen): the drag ends at the drop, the band with it
      window.dispatchEvent(pe('pointerup', { x: right - 6, y: 440 }));
      await flushPromises();
      expect(edgeBand.value).toBeNull();
      w.unmount();
    });
  }

  it('a drag that ends some other way (the card unmounted, not carried) takes the band with it', async () => {
    const cal = useCalendarStore();
    cal.view = 'day';
    cal.anchor = parseIsoDate('2026-10-14')!;
    const { w, card, right, x } = await mountGrid('day', vi.fn(async () => {}));
    card.dispatchEvent(pe('pointerdown', { x, y: 440 }));
    window.dispatchEvent(pe('pointermove', { x: x + 10, y: 440 }));
    window.dispatchEvent(pe('pointermove', { x: right - 6, y: 440 }));
    expect(edgeBand.value).not.toBeNull();
    w.unmount();
    expect(edgeBand.value).toBeNull();
  });
});
