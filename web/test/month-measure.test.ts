/**
 * Layout reads of the month view (feature resource-efficiency, "A busy month renders and swipes smoothly"): a read after
 * a DOM write forces the browser to lay the page out again, so a month of entries must not interleave them per entry.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { DirectiveBinding, ObjectDirective, VNode } from 'vue';
import type { CalendarEvent } from '@/api/types';
import EventItem from '@/features/calendar/EventItem.vue';
import { vFade } from '@/lib/fade';
import { itemSegments } from '@/lib/items';
import { eventFixture, freshPinia } from './helpers';

/** A clipping box whose scrollHeight reads and data-fade writes are logged in order. */
function box(log: string[], content: number, height: number): HTMLElement {
  const el = document.createElement('div');
  const data: Record<string, string> = {};
  Object.defineProperty(el, 'scrollHeight', { get: () => { log.push('read'); return content; } });
  Object.defineProperty(el, 'clientHeight', { get: () => height });
  Object.defineProperty(el, 'dataset', { value: new Proxy(data, { set: (t, k, v) => { log.push('write'); t[k as string] = v; return true; } }) });
  document.body.appendChild(el);
  return el;
}
const hook = (name: 'mounted' | 'updated', el: HTMLElement) =>
  ((vFade as ObjectDirective<HTMLElement>)[name] as (el: HTMLElement, b: DirectiveBinding, v: VNode, p: VNode | null) => void)(el, {} as DirectiveBinding, {} as VNode, null);

describe('v-fade', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('measures every cell of a render together: all reads before any write, after the render', async () => {
    const log: string[] = [];
    const els = [box(log, 100, 50), box(log, 40, 50), box(log, 80, 50)];
    els.forEach((el) => hook('mounted', el));
    expect(log).toEqual([]);
    await Promise.resolve();
    expect(log).toEqual(['read', 'read', 'read', 'write', 'write', 'write']);
    expect(els.map((el) => el.dataset.fade)).toEqual(['true', 'false', 'true']);
  });

  it('re-measures on update the same way', async () => {
    const log: string[] = [];
    const els = [box(log, 100, 50), box(log, 100, 50)];
    els.forEach((el) => hook('updated', el));
    els.forEach((el) => hook('updated', el));
    await Promise.resolve();
    expect(log).toEqual(['read', 'read', 'write', 'write']);
  });

  it('fades a box that leaves entries out even when what it shows fits', async () => {
    const el = box([], 40, 50);
    el.dataset.more = '2';
    hook('mounted', el);
    await Promise.resolve();
    expect(el.dataset.fade).toBe('true');
  });
});

describe('event entry size', () => {
  afterEach(() => vi.restoreAllMocks());
  const seg = itemSegments(eventFixture('a', '2026-10-14T09:00:00+02:00', '2026-10-14T10:00:00+02:00') as CalendarEvent)[0];
  const widthReads = () => vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get');

  it('a month chip never reads its width (its look does not depend on it)', () => {
    freshPinia();
    const spy = widthReads();
    mount(EventItem, { props: { segment: seg, variant: 'chip' }, attachTo: document.body }).unmount();
    mount(EventItem, { props: { segment: seg, variant: 'allday' }, attachTo: document.body }).unmount();
    expect(spy).not.toHaveBeenCalled();
  });

  it('a time grid block still measures its width (narrow type, title lines)', () => {
    freshPinia();
    const spy = widthReads();
    mount(EventItem, { props: { segment: seg, variant: 'block', height: 60 }, attachTo: document.body }).unmount();
    expect(spy).toHaveBeenCalled();
  });
});
