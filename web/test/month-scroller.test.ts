/** The month list that scrolls up and down (feature month-vertical): staying on its month on rotation, with a slow router, at the end of the list. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { isPhone } from '@/composables/useViewport';
import { fetchRange } from '@/lib/dates';
import { listLayout, MONTH_COUNT, MONTH_HEADER_H, monthDate, monthIndex, weekHeight } from '@/lib/monthList';
import { useCalendarStore } from '@/stores/calendar';
import { useItemsStore } from '@/stores/items';
import { useSyncStore } from '@/stores/sync';
import MonthScroller from '@/views/MonthScroller.vue';
import { freshPinia } from './helpers';

const OCT = monthIndex(new Date(2026, 9, 1));
const NOV = OCT + 1;
const layoutOf = (phone: boolean) => listLayout({ weekH: weekHeight(phone), headerH: MONTH_HEADER_H });

let viewH = 600;
let queue: FrameRequestCallback[] = [];
const tops = new WeakMap<object, number>();
const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
const saved = { top: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'), scrollTo: proto.scrollTo };

/** jsdom has no layout: a scroll offset that is kept and clamped like a browser's, over the list's total height. */
beforeEach(() => {
  viewH = 600;
  queue = [];
  isPhone.value = true;
  Object.defineProperty(Element.prototype, 'scrollTop', { configurable: true, get() { return tops.get(this) ?? 0; }, set(v: number) { tops.set(this, v); } });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => viewH });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => layoutOf(isPhone.value).tops[MONTH_COUNT] });
  proto.scrollTo = function scrollTo(this: HTMLElement, o: ScrollToOptions) {
    tops.set(this, Math.min(o.top ?? 0, this.scrollHeight - this.clientHeight));
  };
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => queue.push(f));
  history.replaceState(null, '');
});
afterEach(() => {
  if (saved.top) Object.defineProperty(Element.prototype, 'scrollTop', saved.top);
  proto.scrollTo = saved.scrollTo;
  vi.unstubAllGlobals();
});

/** Mounts the list on `month` with a router whose `replace` never answers (the slow one) unless `replace` says otherwise. */
function setup(month = OCT) {
  freshPinia();
  const cal = useCalendarStore();
  cal.anchor = monthDate(month);
  const items = useItemsStore();
  vi.spyOn(items, 'prefetch').mockImplementation(() => undefined);
  const fetchSpy = vi.spyOn(items, 'fetchRange').mockResolvedValue(false);
  const sync = useSyncStore();
  const register = vi.spyOn(sync, 'registerTask');
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<i />' } }] });
  const replace = vi.spyOn(router, 'replace').mockImplementation(() => new Promise(() => undefined));
  const w = mount(MonthScroller, { props: { mode: 'vertical' }, global: { plugins: [router] } });
  const box = w.element as HTMLElement;
  /** The person scrolls to `top`: the scroll event, then the animation frame that follows it. */
  const scrollTo = (top: number) => {
    box.scrollTop = top;
    box.dispatchEvent(new Event('scroll'));
    const run = queue;
    queue = [];
    run.forEach((f) => f(0));
  };
  const months = () => w.findAll('[data-testid="month-block"]').map((b) => b.attributes('data-month'));
  return { w, box, cal, replace, scrollTo, months, fetchSpy, register };
}

describe('MonthScroller stays on its month', () => {
  it('rotation: the same month stays in view at the same place in it when the week height changes', async () => {
    const { box, scrollTo, replace } = setup();
    const was = layoutOf(true);
    scrollTo(was.tops[OCT] + 192);
    await nextTick();
    isPhone.value = false;
    await nextTick();
    const now = layoutOf(false);
    expect(box.scrollTop).toBe(now.tops[OCT] + (192 * weekHeight(false)) / weekHeight(true));
    scrollTo(box.scrollTop);
    expect(replace).not.toHaveBeenCalled();
  });

  it('coming back from a history entry saved with another week height scales the saved offset', () => {
    history.replaceState({ monthTop: layoutOf(true).tops[OCT] + 192, monthWeekH: weekHeight(true) }, '');
    isPhone.value = false;
    const { box } = setup();
    expect(box.scrollTop).toBe(layoutOf(false).tops[OCT] + (192 * weekHeight(false)) / weekHeight(true));
  });

  it('a slow router answer for the month scrolled into does not scroll the list back', async () => {
    const { box, scrollTo, replace, cal } = setup();
    const top = layoutOf(true).tops[NOV];
    scrollTo(top);
    expect(replace).toHaveBeenCalledTimes(1);
    cal.anchor = monthDate(NOV);
    await nextTick();
    expect(box.scrollTop).toBe(top);
  });

  it('an answer for a month the person has already scrolled away from does not scroll the list back', async () => {
    const { box, scrollTo, replace, cal } = setup();
    scrollTo(layoutOf(true).tops[NOV]);
    scrollTo(layoutOf(true).tops[OCT]);
    // the person is back in October, so that is asked of the router too, not left to the anchor
    expect(replace).toHaveBeenCalledTimes(2);
    cal.anchor = monthDate(NOV);
    await nextTick();
    expect(box.scrollTop).toBe(layoutOf(true).tops[OCT]);
  });

  it('a scroll to the last month ends where the browser clamps it, and then counts as arrived', async () => {
    viewH = 1400;
    const { box, cal, months, scrollTo } = setup();
    cal.anchor = monthDate(MONTH_COUNT - 1);
    await nextTick();
    await nextTick();
    expect(box.scrollTop).toBeLessThan(layoutOf(true).tops[MONTH_COUNT - 1]);
    scrollTo(box.scrollTop);
    await nextTick();
    // arrived: the last month stays the one built around, though the one before shows more of itself in so tall a view
    expect(months().at(-1)).toBe('2100-12');
    expect(months()).toHaveLength(2);
  });

  it('the live-sync refresh covers the three built months too', async () => {
    const { fetchSpy, register } = setup();
    const refresh = register.mock.calls[0][1];
    await refresh();
    expect(fetchSpy).toHaveBeenCalledWith(fetchRange('month', monthDate(OCT - 1))[0], fetchRange('month', monthDate(NOV))[1]);
  });

  it('is a labelled, focusable region', () => {
    const { w } = setup();
    expect(w.attributes('aria-label')).toBe('Months');
    expect(w.attributes('tabindex')).toBe('0');
  });
});

