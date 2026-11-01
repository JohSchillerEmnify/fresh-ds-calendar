// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import OverflowMenu from '@/components/m3/OverflowMenu.vue';
import Menu from '@/components/m3/Menu.vue';

const Icon = defineComponent({ render: () => h('svg') });
const items = ['a', 'b', 'c'].map((id) => ({ id, label: id, icon: Icon, testid: `it-${id}` }));
const key = (el: Element, k: string, init: KeyboardEventInit = {}) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }); el.dispatchEvent(e); return e; };
const panel = () => document.querySelector('[role="menu"]');
const focused = () => (document.activeElement as HTMLElement | null)?.dataset.testid;
let w: VueWrapper | null = null;
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = ''; });

async function openOverflow(host: HTMLElement = document.body) {
  w = mount(OverflowMenu, { props: { label: 'More', items, testid: 'more' }, attachTo: host });
  await w.get('[data-testid="more"]').trigger('click');
  await nextTick();
  await nextTick();
}

describe('OverflowMenu keyboard and focus', () => {
  it('Tab closes the menu, puts focus on the trigger and lets the browser carry on', async () => {
    await openOverflow();
    expect(focused()).toBe('it-a');
    const e = key(panel()!, 'Tab');
    await nextTick();
    expect(panel()).toBeNull();
    expect(e.defaultPrevented).toBe(false);
    expect(focused()).toBe('more');
  });
  it('Home and End jump to the first and last item', async () => {
    await openOverflow();
    key(panel()!, 'End');
    expect(focused()).toBe('it-c');
    key(panel()!, 'Home');
    expect(focused()).toBe('it-a');
  });
  it('ArrowUp with no item focused goes to the last item', async () => {
    await openOverflow();
    (document.querySelector('[data-testid="more"]') as HTMLElement).focus();
    key(panel()!, 'ArrowUp');
    expect(focused()).toBe('it-c');
  });
  it('Escape works while focus is on the trigger', async () => {
    await openOverflow();
    const trigger = document.querySelector('[data-testid="more"]') as HTMLElement;
    trigger.focus();
    key(trigger, 'Escape');
    await nextTick();
    expect(panel()).toBeNull();
  });
  it('closes when focus moves outside the trigger and the panel', async () => {
    const other = document.createElement('button');
    document.body.append(other);
    await openOverflow();
    other.focus();
    await nextTick();
    expect(panel()).toBeNull();
  });
  it('stays open on a scroll that does not move its button (iOS scrolls on a tap), so the tap on an item lands', async () => {
    await openOverflow();
    document.body.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(panel()).not.toBeNull();
  });
  it('closes on a scroll that moves its button and on resize', async () => {
    await openOverflow();
    const trigger = document.querySelector('[data-testid="more"]') as HTMLElement;
    trigger.getBoundingClientRect = () => ({ top: 40, left: 0, bottom: 88, right: 48, width: 48, height: 48, x: 0, y: 40, toJSON: () => ({}) });
    document.body.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(panel()).toBeNull();
    await w!.get('[data-testid="more"]').trigger('click');
    await nextTick();
    expect(panel()).not.toBeNull();
    window.dispatchEvent(new Event('resize'));
    await nextTick();
    expect(panel()).toBeNull();
  });
  it('on a touch screen opens outside a sheet, so iOS never hit-tests it inside the moving sheet', async () => {
    const mq = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    try {
      const dlg = document.createElement('section');
      dlg.setAttribute('role', 'dialog');
      document.body.append(dlg);
      await openOverflow(dlg);
      expect(dlg.contains(panel())).toBe(false);
      expect(panel()?.parentElement).toBe(document.body);
    } finally { window.matchMedia = mq; }
  });
  it('opens inside the enclosing modal dialog so the dialog stays modal for it', async () => {
    const dlg = document.createElement('section');
    dlg.setAttribute('role', 'dialog');
    document.body.append(dlg);
    await openOverflow(dlg);
    expect(dlg.contains(panel())).toBe(true);
  });
});

describe('Menu keyboard', () => {
  it('shares the same keys: End, ArrowUp from nothing, Tab and Escape', async () => {
    w = mount(Menu, { props: { open: false, items, label: 'Menu' }, attachTo: document.body });
    await w.setProps({ open: true });
    await nextTick();
    await nextTick();
    expect(focused()).toBe('it-a');
    key(panel()!, 'End');
    expect(focused()).toBe('it-c');
    (document.activeElement as HTMLElement).blur();
    key(panel()!, 'ArrowUp');
    expect(focused()).toBe('it-c');
    key(panel()!, 'Tab');
    expect(w.emitted('close')).toHaveLength(1);
    key(panel()!, 'Escape');
    expect(w.emitted('close')).toHaveLength(2);
  });
});
