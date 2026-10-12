import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { createDragController, createCellGrid, createSlotGrid, isGestureClaimed, useDraggable } from '@/motion/drag';
import { setAnimationSetting, __setSystemReducedForTest } from '@/motion/level';
import { clearEffects } from '@/motion/effects';
import { installWaapi, removeWaapi, finishAll, pe, flush } from './helpers';

let el: HTMLElement;
const rect = (l: number, t: number, w: number, h: number) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t, toJSON() {} }) as DOMRect;
const down = (type = 'touch', x = 50, y = 50) => el.dispatchEvent(pe('pointerdown', { x, y, pointerType: type }));
const move = (x: number, y: number, type = 'touch') => window.dispatchEvent(pe('pointermove', { x, y, pointerType: type }));
const up = (x: number, y: number, type = 'touch') => window.dispatchEvent(pe('pointerup', { x, y, pointerType: type }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  installWaapi();
  setAnimationSetting('full'); __setSystemReducedForTest(false);
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  el = document.createElement('div');
  el.getBoundingClientRect = () => rect(40, 40, 100, 40);
  document.body.appendChild(el);
});
afterEach(() => {
  clearEffects(); el.remove(); removeWaapi(); vi.useRealTimers(); vi.unstubAllGlobals();
});

const target = { key: 'slot', dx: 100, dy: 60 };
function make(over: Partial<Parameters<typeof createDragController>[1]> = {}) {
  const onDrop = vi.fn(async () => {});
  const states: string[] = [];
  const c = createDragController(el, { hitTest: () => target, onDrop, onStateChange: (s) => states.push(s), ...over });
  return { c, onDrop, states };
}

describe('drag state machine', () => {
  it('touch: long-press picks up with haptic, lifts, claims gesture, drops', async () => {
    const vib = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true });
    const { c, onDrop, states } = make();
    down();
    expect(c.state).toBe('pending');
    vi.advanceTimersByTime(349);
    expect(c.state).toBe('pending');
    vi.advanceTimersByTime(2);
    expect(c.state).toBe('dragging');
    expect(el.dataset.dragging).toBe('true');
    expect(vib).toHaveBeenCalledWith(10);
    expect(isGestureClaimed()).toBe(true);
    move(80, 90);
    vi.advanceTimersByTime(200);
    expect(el.style.transform).toContain('scale(1.05)');
    up(80, 90);
    expect(onDrop).toHaveBeenCalledWith(target);
    expect(c.state).toBe('dropping');
    await flush();
    finishAll();
    await flush();
    expect(c.state).toBe('idle');
    expect(states).toEqual(['pending', 'dragging', 'dropping', 'idle']);
    expect(isGestureClaimed()).toBe(false);
    expect(el.style.transform).toBe('');
    expect(document.querySelectorAll('[data-testid="reward-effect"][data-kind="drop"]').length).toBeLessThanOrEqual(1);
    delete (navigator as unknown as { vibrate?: unknown }).vibrate;
  });
  it('touch: moving before the long-press fires cancels (scroll wins)', () => {
    const { c, onDrop } = make();
    down();
    move(50, 70);
    expect(c.state).toBe('idle');
    vi.advanceTimersByTime(1000);
    expect(c.state).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
    up(50, 70);
    expect(onDrop).not.toHaveBeenCalled();
  });
  it('touch: release before long-press is a tap', () => {
    const { c } = make();
    down(); up(50, 50);
    expect(c.state).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('mouse: drag starts after slop and swallows the click', async () => {
    const { c, onDrop } = make();
    down('mouse');
    move(52, 50, 'mouse');
    expect(c.state).toBe('pending');
    move(60, 50, 'mouse');
    expect(c.state).toBe('dragging');
    up(60, 50, 'mouse');
    await flush();
    const click = vi.fn();
    el.parentElement!.addEventListener('click', click);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(click).not.toHaveBeenCalled();
    expect(onDrop).toHaveBeenCalled();
    finishAll(); await flush(); vi.advanceTimersByTime(500);
  });
  it('claims moves: bubble listeners never see them while dragging', () => {
    const { c } = make();
    const seen = vi.fn();
    document.body.addEventListener('pointermove', seen);
    down('mouse'); move(70, 50, 'mouse');
    expect(c.state).toBe('dragging');
    move(90, 50, 'mouse');
    expect(seen).not.toHaveBeenCalled();
    c.cancel(); finishAll();
    document.body.removeEventListener('pointermove', seen);
  });
  it('rejecting onDrop springs back to the origin', async () => {
    const onDrop = vi.fn(async () => { throw new Error('409'); });
    const { c } = make({ onDrop });
    down('mouse'); move(70, 50, 'mouse'); up(70, 50, 'mouse');
    await flush();
    const frames = () => (installed.at(-1)!.frames as Keyframe[]);
    const installed = (await import('./helpers')).mockAnims;
    expect(c.state).toBe('returning');
    expect(frames().at(-1)!.transform).toBe('translate3d(0,0,0) scale(1)');
    expect(String(frames()[0].transform)).toContain('translate3d(100px, 60px');
    finishAll(); await flush();
    expect(c.state).toBe('idle');
    expect(el.style.transform).toBe('');
    expect(isGestureClaimed()).toBe(false);
  });
  it('drop outside any target springs back without onDrop', async () => {
    const { c, onDrop } = make({ hitTest: () => null });
    down('mouse'); move(70, 50, 'mouse'); up(70, 50, 'mouse');
    expect(c.state).toBe('returning');
    finishAll(); await flush();
    expect(c.state).toBe('idle');
    expect(onDrop).not.toHaveBeenCalled();
  });
  it('Escape cancels a drag and removes the key listener', async () => {
    const { c, onDrop } = make();
    down('mouse'); move(70, 50, 'mouse');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(c.state).toBe('returning');
    finishAll(); await flush();
    expect(c.state).toBe('idle');
    expect(onDrop).not.toHaveBeenCalled();
  });
  it('pointercancel cancels', async () => {
    const { c } = make();
    down('mouse'); move(70, 50, 'mouse');
    window.dispatchEvent(pe('pointercancel', { pointerType: 'mouse' }));
    expect(c.state).toBe('returning');
    finishAll(); await flush();
  });
  it('disabled never starts', () => {
    const { c } = make({ disabled: () => true });
    down('mouse'); move(90, 50, 'mouse');
    expect(c.state).toBe('idle');
  });
  it('destroy mid-drag leaves no listeners, timers or claim', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const rem = vi.spyOn(window, 'removeEventListener');
    const { c } = make();
    down();
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('dragging');
    c.destroy();
    const added = add.mock.calls.filter((c) => ['pointermove', 'pointerup', 'pointercancel', 'keydown', 'contextmenu', 'touchmove'].includes(c[0] as string)).length;
    const removed = rem.mock.calls.filter((c) => ['pointermove', 'pointerup', 'pointercancel', 'keydown', 'contextmenu', 'touchmove'].includes(c[0] as string)).length;
    expect(removed).toBe(added);
    expect(isGestureClaimed()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    down(); expect(c.state).toBe('idle'); // pointerdown listener gone
    add.mockRestore(); rem.mockRestore();
  });
  it('useDraggable cleans up on scope stop', async () => {
    const s = effectScope();
    s.run(() => useDraggable(() => el, { hitTest: () => target, onDrop: () => {} }));
    await flush();
    s.stop();
    down('mouse'); move(90, 50, 'mouse');
    expect(el.dataset.dragging).toBeUndefined();
  });
  it('Reduced level still drags but without wiggle/spring lag', async () => {
    setAnimationSetting('reduced');
    const { c } = make();
    down('mouse'); move(70, 50, 'mouse');
    vi.advanceTimersByTime(40);
    expect(el.style.transform).toContain('translate3d(100.00px, 60.00px');
    c.cancel(); finishAll();
  });
  it('non-optimistic drop keeps the card at the slot until the server answers', async () => {
    let resolve!: () => void;
    const onDrop = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { c } = make({ onDrop, optimistic: false });
    down('mouse'); move(70, 50, 'mouse'); up(70, 50, 'mouse');
    expect(el.style.transform).toContain('translate3d(100px, 60px');
    resolve(); await flush();
    expect(c.state).toBe('idle');
    expect(el.style.transform).toBe('');
  });
});

describe('hit-test grids', () => {
  const ctx = { originRect: rect(40, 100, 80, 60), grab: { x: 10, y: 10 } };
  it('slot grid snaps to 15 minutes and columns', () => {
    const hit = createSlotGrid({ rect: () => rect(0, 0, 370, 1440), columns: 7, pxPerMinute: 1, gutter: 20 });
    const t = hit(100, 37 + 10 + 100, ctx)!; // top edge 137 -> 137 min -> 135
    expect(t.key).toEqual({ column: 1, minutes: 135 });
    expect(t.dy).toBe(135 - 100);
    expect(hit(-50, -50, ctx)!.key).toEqual({ column: 0, minutes: 0 });
    expect(hit(9999, 99999, ctx)!.key.column).toBe(6);
  });
  it('cell grid finds the cell under the pointer', () => {
    const a = document.createElement('div'); a.getBoundingClientRect = () => rect(0, 0, 50, 50);
    const b = document.createElement('div'); b.getBoundingClientRect = () => rect(50, 0, 50, 50);
    const hit = createCellGrid({ cells: () => [{ el: a, key: 'a' }, { el: b, key: 'b' }] });
    expect(hit(60, 10, ctx)!.key).toBe('b');
    expect(hit(500, 10, ctx)).toBeNull();
  });
});
