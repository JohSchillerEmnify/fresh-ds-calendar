import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useItemDrag } from '@/features/tasklists/useItemDrag';
import { setAnimationSetting, __setSystemReducedForTest } from '@/motion/level';
import { clearEffects } from '@/motion/effects';
import { flush, installWaapi, pe, removeWaapi } from './motion/helpers';

const rect = (top: number) => ({ left: 0, top, width: 200, height: 40, right: 200, bottom: top + 40, x: 0, y: top, toJSON() {} }) as DOMRect;

/** Three rows of 40 px at 0, 40 and 80, each with a grip. */
function setup(gripOnly: boolean, fingerWrites = false) {
  const onMove = vi.fn();
  const Host = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null);
      useItemDrag({ root, signature: () => 'a,b,c', gripOnly: () => gripOnly, fingerWrites: () => fingerWrites, disabled: () => false, onMove });
      return () => h('ul', { ref: root }, ['a', 'b', 'c'].map((id) => h('li', { 'data-testid': 'tasklist-item', 'data-item-id': id }, [h('span', { 'data-item-grip': '' }), h('b', id), h('svg', { 'data-testid': 'ink-line' })])));
    },
  });
  const w = mount(Host, { attachTo: document.body });
  const rows = Array.from((w.element as HTMLElement).querySelectorAll<HTMLElement>('li'));
  // like a browser, the rect includes the translateY the hook gives rows that make room
  rows.forEach((r, i) => { r.getBoundingClientRect = () => rect(i * 40 + parseFloat(/translateY\((-?[\d.]+)px\)/.exec(r.style.transform)?.[1] ?? '0')); });
  return { w, rows, onMove };
}
const touch = (el: Element, type: string, y: number) => el.dispatchEvent(pe(type, { x: 10, y, pointerType: 'touch' }));
const win = (type: string, y: number) => window.dispatchEvent(pe(type, { x: 10, y, pointerType: 'touch' }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  // jsdom has no DOMMatrix (every real browser has); a stand-in that reads the translateY the hook writes
  vi.stubGlobal('DOMMatrix', class { m42: number; constructor(t: string) { this.m42 = parseFloat(/translateY\((-?[\d.]+)px\)/.exec(t)?.[1] ?? '0'); } });
  installWaapi();
  setAnimationSetting('full'); __setSystemReducedForTest(false);
});
afterEach(() => { clearEffects(); removeWaapi(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

async function longPressDrag(row: HTMLElement, from: number, to: number, target: Element = row): Promise<void> {
  touch(target, 'pointerdown', from);
  vi.advanceTimersByTime(400);
  win('pointermove', to);
  vi.advanceTimersByTime(100);
  win('pointerup', to);
  await flush();
}

describe('useItemDrag', () => {
  it('a finger resting on the ink line does not lift the row while "Draw with finger" is on; the grip and the title still do', async () => {
    const { w, rows, onMove } = setup(false, true);
    await longPressDrag(rows[0], 20, 100, rows[0].querySelector('svg')!);
    expect(rows[0].dataset.dragging).toBeUndefined();
    expect(onMove).not.toHaveBeenCalled();
    await longPressDrag(rows[0], 20, 100, rows[0].querySelector('b')!);
    expect(onMove).toHaveBeenCalledTimes(1);
    w.unmount();
  });
  it('the gap is the lifted row\'s layout height, however its lifted (scaled, tilted) rect looks', () => {
    const { w, rows } = setup(false);
    // the lifted card is drawn larger than its place (scale 1.05, tilt): 50 px tall instead of 40
    rows[2].getBoundingClientRect = () => (rows[2].dataset.dragging ? { ...rect(75), height: 50, bottom: 125 } : rect(80)) as DOMRect;
    touch(rows[2], 'pointerdown', 100);
    vi.advanceTimersByTime(400);
    win('pointermove', 10);
    vi.advanceTimersByTime(100);
    expect(rows[0].style.transform).toBe('translateY(40px)');
    expect(rows[1].style.transform).toBe('translateY(40px)');
    win('pointerup', 10);
    w.unmount();
  });
  it('a row that goes while another is held: the gap is opened again for the same place', async () => {
    const ids = ref(['a', 'b', 'c', 'd']);
    const Host = defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null);
        useItemDrag({ root, signature: () => ids.value.join(','), gripOnly: () => false, disabled: () => false, onMove: vi.fn() });
        return () => h('ul', { ref: root }, ids.value.map((id) => h('li', { key: id, 'data-testid': 'tasklist-item', 'data-item-id': id }, id)));
      },
    });
    const w = mount(Host, { attachTo: document.body });
    const mock = () => Array.from((w.element as HTMLElement).querySelectorAll<HTMLElement>('li')).forEach((r, i) => {
      r.getBoundingClientRect = () => rect(i * 40 + parseFloat(/translateY\((-?[\d.]+)px\)/.exec(r.style.transform)?.[1] ?? '0'));
    });
    mock();
    const lis = () => Array.from((w.element as HTMLElement).querySelectorAll<HTMLElement>('li'));
    touch(lis()[3], 'pointerdown', 140);
    vi.advanceTimersByTime(400);
    win('pointermove', 50);
    vi.advanceTimersByTime(100);
    expect(lis()[1].style.transform).toBe('translateY(40px)');
    ids.value = ['a', 'b', 'c', 'd', 'e'].filter((x) => x !== 'a');
    await flush();
    mock();
    // the rows after the new place stay shifted: the gap is not left closed
    expect(lis().filter((r) => r.style.transform).length).toBeGreaterThan(0);
    win('pointerup', 50);
    w.unmount();
  });
  it('a row dropped on another row reports that place', async () => {
    const { w, rows, onMove } = setup(false);
    await longPressDrag(rows[2], 100, 10);
    expect(onMove).toHaveBeenCalledWith('c', 0);
    w.unmount();
  });
  it('a row dropped where it was reports nothing', async () => {
    const { w, rows, onMove } = setup(false);
    await longPressDrag(rows[1], 60, 60);
    expect(onMove).not.toHaveBeenCalled();
    w.unmount();
  });
  it('grip only (a Canvas note): a press on the row picks nothing up, a press on the grip does', async () => {
    const { w, rows, onMove } = setup(true);
    await longPressDrag(rows[2], 100, 10, rows[2].querySelector('b')!);
    expect(onMove).not.toHaveBeenCalled();
    expect(rows[2].dataset.dragging).toBeUndefined();
    await longPressDrag(rows[2], 100, 10, rows[2].querySelector('[data-item-grip]')!);
    expect(onMove).toHaveBeenCalledWith('c', 0);
    w.unmount();
  });
});
