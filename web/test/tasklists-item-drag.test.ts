import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useItemDrag } from '@/features/tasklists/useItemDrag';
import { setAnimationSetting, __setSystemReducedForTest } from '@/motion/level';
import { clearEffects } from '@/motion/effects';
import { flush, installWaapi, pe, removeWaapi } from './motion/helpers';

const rect = (top: number) => ({ left: 0, top, width: 200, height: 40, right: 200, bottom: top + 40, x: 0, y: top, toJSON() {} }) as DOMRect;

/** Three rows of 40 px at 0, 40 and 80, each with a grip. */
function setup(gripOnly: boolean) {
  const onMove = vi.fn();
  const Host = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null);
      useItemDrag({ root, signature: () => 'a,b,c', gripOnly: () => gripOnly, disabled: () => false, onMove });
      return () => h('ul', { ref: root }, ['a', 'b', 'c'].map((id) => h('li', { 'data-testid': 'tasklist-item', 'data-item-id': id }, [h('span', { 'data-item-grip': '' }), h('b', id)])));
    },
  });
  const w = mount(Host, { attachTo: document.body });
  const rows = Array.from((w.element as HTMLElement).querySelectorAll<HTMLElement>('li'));
  rows.forEach((r, i) => { r.getBoundingClientRect = () => rect(i * 40); });
  return { w, rows, onMove };
}
const touch = (el: Element, type: string, y: number) => el.dispatchEvent(pe(type, { x: 10, y, pointerType: 'touch' }));
const win = (type: string, y: number) => window.dispatchEvent(pe(type, { x: 10, y, pointerType: 'touch' }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
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
