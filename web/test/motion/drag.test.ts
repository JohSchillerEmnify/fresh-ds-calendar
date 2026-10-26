import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { createDragController, createCellGrid, createSlotGrid, isGestureClaimed, useDraggable, watchDrags, type DragFrame } from '@/motion/drag';
import { setAnimationSetting, __setSystemReducedForTest } from '@/motion/level';
import { clearEffects } from '@/motion/effects';
import { installWaapi, removeWaapi, finishAll, pe, flush } from './helpers';

let el: HTMLElement;
const rect = (l: number, t: number, w: number, h: number) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t, toJSON() {} }) as DOMRect;
const down = (type = 'touch', x = 50, y = 50) => el.dispatchEvent(pe('pointerdown', { x, y, pointerType: type }));
const move = (x: number, y: number, type = 'touch') => window.dispatchEvent(pe('pointermove', { x, y, pointerType: type }));
const up = (x: number, y: number, type = 'touch') => window.dispatchEvent(pe('pointerup', { x, y, pointerType: type }));
/** A touch event with one finger at x, y (`released`: touchend/touchcancel, no finger left on the screen). */
const touch = (type: string, x: number, y: number, released = false, others: { identifier: number; clientX: number; clientY: number }[] = []) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  const t = { identifier: 1, clientX: x, clientY: y };
  Object.defineProperty(e, 'touches', { value: released ? others : [...others, t] });
  Object.defineProperty(e, 'changedTouches', { value: [t] });
  return e;
};
/** Finger down on the card the way a browser sends it: pointerdown, then touchstart. */
const fingerDown = (x = 50, y = 50) => { down('touch', x, y); el.dispatchEvent(touch('touchstart', x, y)); };

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
  clearEffects(); el.remove(); document.querySelectorAll('[data-drag-ghost]').forEach((g) => g.remove()); removeWaapi(); vi.useRealTimers(); vi.unstubAllGlobals();
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
  it('touchmove is stopped while dragging (a sheet swipe underneath never sees it) and left alone when idle', () => {
    const seen = vi.fn();
    el.parentElement!.addEventListener('touchmove', seen);
    const tm = () => {
      const e = new Event('touchmove', { bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    };
    const { c } = make();
    expect(tm()).toBe(false);
    expect(seen).toHaveBeenCalledTimes(1);
    down();
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('dragging');
    expect(tm()).toBe(true);
    expect(seen).toHaveBeenCalledTimes(1); // not called again
    c.destroy();
  });
  it('scale: the translate is the viewport offset divided by the ancestor scale', async () => {
    const { c } = make({ scale: () => 0.5 });
    down();
    vi.advanceTimersByTime(400);
    vi.advanceTimersByTime(600);
    expect(c.state).toBe('dragging');
    // magnet target dx 100, dy 60 viewport px -> 200, 120 local px
    expect(el.style.transform).toContain('translate3d(200.00px, 120.00px');
    c.destroy();
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
    await flush(); finishAll(); await flush(); // wobble ends, rejection already known
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
  it('a slow PATCH does not keep the card in dropping: it can be picked up again right after the wobble', async () => {
    let resolve!: () => void;
    const onDrop = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    const { c } = make({ onDrop });
    down(); vi.advanceTimersByTime(351); move(80, 90); up(80, 90);
    expect(c.state).toBe('dropping');
    await flush(); finishAll(); await flush();
    expect(c.state).toBe('idle');
    expect(isGestureClaimed()).toBe(false);
    down(); vi.advanceTimersByTime(351); // second pick-up while the first PATCH is still in flight
    expect(c.state).toBe('dragging');
    up(80, 90); await flush(); finishAll(); await flush();
    resolve(); await flush();
    expect(c.state).toBe('idle');
    expect(onDrop).toHaveBeenCalledTimes(2);
  });
  it('late PATCH failure rolls back visually without touching a new gesture', async () => {
    let reject!: (e: Error) => void;
    const onDrop = vi.fn(() => new Promise<void>((_, r) => { reject = r; }));
    const { c } = make({ onDrop });
    down(); vi.advanceTimersByTime(351); up(80, 90);
    await flush(); finishAll(); await flush();
    down(); vi.advanceTimersByTime(351);
    expect(c.state).toBe('dragging');
    reject(new Error('412')); await flush();
    expect(c.state).toBe('dragging');
    c.cancel(); finishAll(); await flush();
  });
  it('touch: 2-6 px finger jitter during the hold still picks up', () => {
    for (const j of [2, 4, 6]) {
      const { c } = make();
      down(); vi.advanceTimersByTime(100); move(50 + j, 50); vi.advanceTimersByTime(100); move(50, 50 - j);
      vi.advanceTimersByTime(200);
      expect(c.state).toBe('dragging');
      c.destroy();
      expect(isGestureClaimed()).toBe(false);
    }
  });
  it('successive drops leave no stale claim; a destroy mid-drop releases it', async () => {
    const { c } = make();
    for (let i = 0; i < 3; i++) {
      down(); vi.advanceTimersByTime(351); up(80, 90); await flush(); finishAll(); await flush();
      expect(c.state).toBe('idle'); expect(isGestureClaimed()).toBe(false);
    }
    down(); vi.advanceTimersByTime(351); c.destroy();
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
  // owner, 2026-10-25: iOS WebKit decides at touchstart whether touch moves can stop scrolling, from the non-passive
  // touchmove listeners present then: one added on pointerdown is too late
  it('touch: the card has its own non-passive touchmove listener from creation until destroy', () => {
    const add = vi.spyOn(el, 'addEventListener');
    const rem = vi.spyOn(el, 'removeEventListener');
    const { c } = make();
    const reg = add.mock.calls.find((a) => a[0] === 'touchmove');
    expect(reg?.[2]).toMatchObject({ passive: false });
    c.destroy();
    expect(rem.mock.calls.some((a) => a[0] === 'touchmove' && a[1] === reg![1])).toBe(true);
  });
  it('touch: the card\'s own listener prevents moves while lifted', () => {
    const { c } = make();
    const e1 = touch('touchmove', 50, 50);
    expect(el.dispatchEvent(e1)).toBe(true);
    down();
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('dragging');
    const e2 = touch('touchmove', 60, 60);
    el.dispatchEvent(e2);
    expect(e2.defaultPrevented).toBe(true);
    c.destroy();
  });
  it('touch: a move while the press is still pending is never prevented (iOS lets the first move decide on scrolling)', () => {
    const { c } = make();
    fingerDown();
    expect(c.state).toBe('pending');
    const e = touch('touchmove', 52, 51);
    el.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    c.destroy();
  });
  it('touch: a pointercancel while lifted (the browser started a pan) keeps the drag and follows the touch to the drop', async () => {
    const { c, onDrop } = make();
    fingerDown();
    vi.advanceTimersByTime(400);
    window.dispatchEvent(pe('pointercancel', { pointerType: 'touch' }));
    expect(c.state).toBe('dragging');
    el.dispatchEvent(touch('touchmove', 80, 90));
    vi.advanceTimersByTime(50);
    expect(el.style.transform).toContain('scale(1.05)');
    el.dispatchEvent(touch('touchend', 80, 90, true));
    expect(onDrop).toHaveBeenCalledWith(target);
    await flush(); finishAll(); await flush();
    expect(c.state).toBe('idle');
    expect(isGestureClaimed()).toBe(false);
  });
  it('touch: the touch events carry a lifted drag even when the pointer events just stop (no pointercancel, a sideways move on iOS)', async () => {
    const at: number[][] = [];
    const { c, onDrop } = make({ hitTest: (x, y) => { at.push([x, y]); return target; } });
    fingerDown();
    vi.advanceTimersByTime(400);
    el.dispatchEvent(touch('touchmove', 120, 50));
    expect(at.at(-1)).toEqual([120, 50]);
    el.dispatchEvent(touch('touchend', 120, 50, true));
    expect(onDrop).toHaveBeenCalledWith(target);
    await flush(); finishAll(); await flush();
    expect(c.state).toBe('idle');
  });
  it('touch: after a pointercancel only the first finger steers, a second one is ignored', () => {
    const at: number[][] = [];
    const { c } = make({ hitTest: (x, y) => { at.push([x, y]); return target; } });
    fingerDown();
    vi.advanceTimersByTime(400);
    window.dispatchEvent(pe('pointercancel', { pointerType: 'touch' }));
    // a second finger lands and moves; it is listed first
    el.dispatchEvent(touch('touchmove', 80, 90, false, [{ identifier: 2, clientX: 300, clientY: 300 }]));
    expect(at.at(-1)).toEqual([80, 90]);
    // the second finger lifts: the drag goes on
    el.dispatchEvent(Object.defineProperties(new Event('touchend', { bubbles: true }), {
      touches: { value: [{ identifier: 1, clientX: 80, clientY: 90 }] }, changedTouches: { value: [{ identifier: 2, clientX: 300, clientY: 300 }] },
    }));
    expect(c.state).toBe('dragging');
    c.destroy();
  });
  it('pen: a pointercancel while lifted with no touch events (pen on Windows/ChromeOS) springs back instead of staying lifted', async () => {
    const { c, onDrop } = make();
    down('pen');
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('dragging');
    window.dispatchEvent(pe('pointercancel', { pointerType: 'pen' }));
    expect(c.state).toBe('returning');
    expect(onDrop).not.toHaveBeenCalled();
    finishAll(); await flush();
    expect(c.state).toBe('idle');
    expect(isGestureClaimed()).toBe(false);
  });
  it('touch: a touchcancel while lifted springs back', async () => {
    const { c, onDrop } = make();
    fingerDown();
    vi.advanceTimersByTime(400);
    window.dispatchEvent(pe('pointercancel', { pointerType: 'touch' }));
    el.dispatchEvent(touch('touchcancel', 80, 90, true));
    expect(c.state).toBe('returning');
    expect(onDrop).not.toHaveBeenCalled();
    finishAll(); await flush();
  });
  it('the click right after a drop never reaches an ancestor\'s capture listener (phone month opens the day on a chip click)', async () => {
    const seen = vi.fn();
    el.parentElement!.addEventListener('click', seen, true);
    make();
    down();
    vi.advanceTimersByTime(400);
    up(50, 50);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(seen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(seen).toHaveBeenCalledTimes(1);
    el.parentElement!.removeEventListener('click', seen, true);
    await flush(); finishAll(); await flush();
  });
  it('back-to-back drops: the click after the second drop is still swallowed (the first drop\'s timer does not disarm it)', async () => {
    const seen = vi.fn();
    el.parentElement!.addEventListener('click', seen, true);
    make();
    const mouseDrop = () => { down('mouse'); move(70, 50, 'mouse'); up(70, 50, 'mouse'); };
    mouseDrop();
    await flush(); finishAll(); await flush();
    vi.advanceTimersByTime(300);
    mouseDrop();
    await flush(); finishAll(); await flush();
    vi.advanceTimersByTime(150); // 450 ms after the first drop, 150 ms after the second
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(seen).not.toHaveBeenCalled();
    el.parentElement!.removeEventListener('click', seen, true);
  });
  it('a press that may become a drag never starts a text selection', () => {
    const { c } = make();
    const sel = () => { const e = new Event('selectstart', { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
    expect(sel()).toBe(false);
    down();
    expect(sel()).toBe(true);
    vi.advanceTimersByTime(400);
    expect(sel()).toBe(true);
    c.destroy();
    expect(sel()).toBe(false);
  });
  it('touch: a pointercancel before the long press gives way to the scroll', () => {
    const { c } = make();
    down();
    window.dispatchEvent(pe('pointercancel', { pointerType: 'touch' }));
    expect(c.state).toBe('idle');
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('idle');
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
  it('a destroy mid-drag tells onStateChange the drag is over (its owner clears what it showed)', () => {
    const { c, states } = make();
    down();
    vi.advanceTimersByTime(400);
    c.destroy();
    expect(states.at(-1)).toBe('idle');
  });
  it('Android: pointer and touch events for the same finger drop once, whichever comes first', async () => {
    for (const order of [['pointerup', 'touchend'], ['touchend', 'pointerup']]) {
      const { c, onDrop } = make();
      fingerDown();
      vi.advanceTimersByTime(400);
      move(80, 90);
      el.dispatchEvent(touch('touchmove', 80, 90));
      for (const ev of order) {
        if (ev === 'pointerup') up(80, 90);
        else el.dispatchEvent(touch('touchend', 80, 90, true));
      }
      expect(onDrop).toHaveBeenCalledTimes(1);
      await flush(); finishAll(); await flush();
      expect(c.state).toBe('idle');
      c.destroy();
    }
  });
  it('a move to the same point does not run the hit test again; a refresh does', () => {
    const hitTest = vi.fn(() => target);
    const { c } = make({ hitTest });
    down('mouse');
    move(60, 50, 'mouse');
    const n = hitTest.mock.calls.length;
    move(60, 50, 'mouse');
    expect(hitTest.mock.calls.length).toBe(n);
    c.refresh();
    expect(hitTest.mock.calls.length).toBe(n + 1);
    c.destroy();
  });
  it('useDraggable re-binds when the element is replaced', async () => {
    const { ref, nextTick } = await import('vue');
    const r = ref<HTMLElement | null>(el);
    const s = effectScope();
    s.run(() => useDraggable(r, { hitTest: () => target, onDrop: () => {} }));
    await flush();
    const el2 = document.createElement('div');
    el2.getBoundingClientRect = () => rect(40, 40, 100, 40);
    document.body.appendChild(el2);
    r.value = el2; await nextTick(); await flush();
    el2.dispatchEvent(pe('pointerdown', { x: 50, y: 50, pointerType: 'touch' }));
    vi.advanceTimersByTime(351);
    expect(el2.dataset.dragging).toBe('true');
    window.dispatchEvent(pe('pointerup', { x: 50, y: 50, pointerType: 'touch' }));
    s.stop(); el2.remove();
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

describe('carry: the card may leave the page mid-drag (the view turns to another day or week)', () => {
  const ghost = () => document.querySelector<HTMLElement>('[data-drag-ghost]');
  it('a ghost copy at the card\'s place keeps following, the hidden card can go, and the drop still lands', async () => {
    const { c, onDrop } = make();
    fingerDown();
    vi.advanceTimersByTime(400);
    c.carry();
    const g = ghost()!;
    expect(g).not.toBeNull();
    expect([g.style.position, g.style.left, g.style.top, g.style.width, g.style.height]).toEqual(['fixed', '40px', '40px', '100px', '40px']);
    expect(el.style.visibility).toBe('hidden');
    el.remove();
    move(80, 90);
    vi.advanceTimersByTime(200);
    expect(g.style.transform).toContain('scale(1.05)');
    up(80, 90);
    expect(onDrop).toHaveBeenCalledWith(target);
    await flush(); finishAll(); await flush();
    vi.advanceTimersByTime(50);
    expect(ghost()).toBeNull();
    expect(c.state).toBe('idle');
    expect(isGestureClaimed()).toBe(false);
  });
  it('touch events sent to the removed card still carry the drag (iOS after a pointercancel)', async () => {
    const { c, onDrop } = make();
    fingerDown();
    vi.advanceTimersByTime(400);
    window.dispatchEvent(pe('pointercancel', { pointerType: 'touch' }));
    c.carry();
    el.remove();
    const tm = touch('touchmove', 80, 90);
    el.dispatchEvent(tm);
    expect(tm.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(50);
    expect(ghost()!.style.transform).toContain('scale(1.05)');
    el.dispatchEvent(touch('touchend', 80, 90, true));
    expect(onDrop).toHaveBeenCalledWith(target);
    await flush(); finishAll(); await flush();
    expect(c.state).toBe('idle');
  });
  it('a destroy while carried (the card unmounted) waits for the drop, then cleans up', async () => {
    const rem = vi.spyOn(window, 'removeEventListener');
    const { c, onDrop } = make();
    down();
    vi.advanceTimersByTime(400);
    c.carry();
    c.destroy();
    expect(c.state).toBe('dragging');
    up(80, 90);
    expect(onDrop).toHaveBeenCalledWith(target);
    await flush(); finishAll(); await flush();
    expect(c.state).toBe('idle');
    expect(rem.mock.calls.some((x) => x[0] === 'pointermove')).toBe(true);
    down(); expect(c.state).toBe('idle'); // fully destroyed: the pointerdown listener is gone
    vi.advanceTimersByTime(50);
    expect(ghost()).toBeNull();
    rem.mockRestore();
  });
  it('the ghost carries no id or test ids (it never counts as the card), and stays until the moved card had a frame to render', async () => {
    el.id = 'card';
    el.dataset.testid = 'event-chip';
    el.innerHTML = '<span data-testid="event-chip-title">T</span>';
    const { c } = make();
    down();
    vi.advanceTimersByTime(400);
    c.carry();
    const g = ghost()!;
    expect([g.id, g.dataset.testid, g.querySelector('[data-testid]')]).toEqual(['', undefined, null]);
    up(80, 90);
    await flush();
    expect(ghost()).not.toBeNull();
    vi.advanceTimersByTime(50);
    expect(ghost()).toBeNull();
  });
  it('a cancel while carried removes the ghost', async () => {
    const { c } = make();
    down();
    vi.advanceTimersByTime(400);
    c.carry();
    c.cancel();
    await flush(); finishAll(); await flush();
    vi.advanceTimersByTime(50);
    expect(ghost()).toBeNull();
    expect(c.state).toBe('idle');
    expect(el.style.visibility).toBe('');
  });
  it('useDraggable still answers for a carried drag after its card was unbound (the component unmounted)', async () => {
    const { ref } = await import('vue');
    const r = ref<HTMLElement | null>(el);
    const hitTest = vi.fn(() => target);
    const s = effectScope();
    const d = s.run(() => useDraggable(r, { hitTest, onDrop: async () => {} }))!;
    await flush();
    down();
    vi.advanceTimersByTime(400);
    d.carry();
    r.value = null;
    await flush();
    expect(d.state).toBe('dragging');
    const n = hitTest.mock.calls.length;
    d.refresh();
    expect(hitTest.mock.calls.length).toBe(n + 1);
    up(80, 90);
    await flush(); finishAll(); await flush();
    expect(d.state).toBe('idle');
    s.stop();
  });
  it('refresh re-runs the hit test where the pointer is (the grid changed under a still pointer)', () => {
    const hitTest = vi.fn(() => target);
    const { c } = make({ hitTest });
    down();
    vi.advanceTimersByTime(400);
    const n = hitTest.mock.calls.length;
    c.refresh();
    expect(hitTest.mock.calls.length).toBe(n + 1);
    c.destroy();
  });
});

describe('drag inside a scroll container', () => {
  // The card lives inside the scroller: scrolling moves its layout box (and the grid) up by scrollTop.
  let sc: HTMLElement;
  let scrollTop = 0;
  const TOP0 = 300; // card's viewport top at pick-up (scrollTop 0), grid starts at viewport y 0, 1 px per minute
  beforeEach(() => {
    setAnimationSetting('reduced'); // no spring lag: the ghost sits exactly at its target every frame
    scrollTop = 0;
    sc = document.createElement('div');
    Object.defineProperty(sc, 'scrollTop', { get: () => scrollTop, set: (v: number) => { scrollTop = Math.max(0, Math.min(1000, v)); } });
    sc.getBoundingClientRect = () => rect(0, 0, 800, 400);
    sc.appendChild(el);
    document.body.appendChild(sc);
    el.getBoundingClientRect = () => rect(40, TOP0 - scrollTop, 100, 40);
  });
  afterEach(() => sc.remove());

  function makeScroll() {
    const grid = createSlotGrid({ rect: () => rect(0, -scrollTop, 800, 1440), columns: 1, pxPerMinute: 1 });
    const targets: (number | null)[] = [];
    let last: { key: { minutes: number } } | null = null;
    const c = createDragController(el, {
      hitTest: grid, onDrop: async () => {}, scrollEl: () => sc,
      onTarget: (t) => { last = t; targets.push(t ? t.key.minutes : null); },
    });
    // where the ghost is drawn (layout box + transform) vs where the drop indicator is drawn (slot in the scrolled grid)
    const ghostTop = () => el.getBoundingClientRect().top + Number(/translate3d\([^,]+, (-?[\d.]+)px/.exec(el.style.transform)![1]);
    const indicatorTop = () => -scrollTop + last!.key.minutes;
    return { c, targets, ghostTop, indicatorTop, minutes: () => last!.key.minutes };
  }

  it('touch: the scroll container does not scroll natively while a card is lifted, and does again after the drop', async () => {
    sc.style.overflowY = 'auto';
    const { c } = makeScroll();
    down('touch', 60, TOP0 + 10);
    expect(sc.style.overflowY).toBe('auto');
    vi.advanceTimersByTime(400);
    expect(c.state).toBe('dragging');
    expect(sc.style.overflowY).toBe('hidden');
    up(60, TOP0 + 10);
    await flush(); finishAll(); await flush();
    expect(c.state).toBe('idle');
    expect(sc.style.overflowY).toBe('auto');
  });
  it('touch: the scroll container scrolls again after a touchcancel, Escape, a pen pointercancel and a destroy mid-drag', async () => {
    sc.style.overflowY = 'auto';
    const lifted = (type = 'touch') => {
      down(type, 60, TOP0 + 10);
      if (type === 'touch') el.dispatchEvent(touch('touchstart', 60, TOP0 + 10));
      vi.advanceTimersByTime(400);
      expect(sc.style.overflowY).toBe('hidden');
    };
    const { c } = makeScroll();
    lifted();
    window.dispatchEvent(pe('pointercancel', { pointerType: 'touch' }));
    el.dispatchEvent(touch('touchcancel', 60, TOP0 + 10, true));
    finishAll(); await flush();
    expect(c.state).toBe('idle');
    expect(sc.style.overflowY).toBe('auto');
    lifted();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    finishAll(); await flush();
    expect(sc.style.overflowY).toBe('auto');
    lifted('pen');
    window.dispatchEvent(pe('pointercancel', { pointerType: 'pen' }));
    finishAll(); await flush();
    expect(sc.style.overflowY).toBe('auto');
    lifted();
    c.destroy();
    expect(sc.style.overflowY).toBe('auto');
  });
  it('mouse: the scroll container keeps scrolling while dragging (wheel)', () => {
    const { c } = makeScroll();
    down('mouse', 60, TOP0 + 10); move(60, TOP0 + 30, 'mouse');
    expect(c.state).toBe('dragging');
    expect(sc.style.overflowY).toBe('');
    c.destroy();
  });
  it('wheel scroll while dragging recomputes the indicator and keeps the ghost on it', () => {
    const { c, ghostTop, indicatorTop, minutes } = makeScroll();
    down('mouse', 50, 310); move(50, 350, 'mouse'); vi.advanceTimersByTime(40);
    expect(minutes()).toBe(345);
    expect(ghostTop()).toBeCloseTo(indicatorTop(), 1);
    // wheel: the browser scrolls the container, no pointermove follows
    sc.scrollTop = 200; sc.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(40);
    expect(minutes()).toBe(540); // pointer still at viewport 350 -> content 550, minus the 10 px grab
    expect(ghostTop()).toBeCloseTo(indicatorTop(), 1);
    expect(ghostTop()).toBeCloseTo(350 - 10, 1); // still under the pointer
    c.cancel(); finishAll();
  });

  it.each(['reduced', 'full'] as const)('auto-scroll at the bottom edge keeps the ghost on the indicator (%s motion)', (lvl) => {
    setAnimationSetting(lvl);
    const { c, ghostTop, indicatorTop } = makeScroll();
    down('mouse', 50, 310); move(50, 390, 'mouse');
    vi.advanceTimersByTime(1500);
    expect(scrollTop).toBeGreaterThan(50);
    // while scrolling the full-motion magnet may trail the snapping indicator by less than one 15 min slot
    expect(Math.abs(ghostTop() - indicatorTop())).toBeLessThan(15);
    move(50, 300, 'mouse'); // out of the edge zone: scrolling stops, the ghost settles exactly on the indicator
    vi.advanceTimersByTime(1000);
    expect(ghostTop()).toBeCloseTo(indicatorTop(), 1);
    c.cancel(); finishAll();
  });

  it('a scroll after the drag ends is ignored', () => {
    const { c, targets } = makeScroll();
    down('mouse', 50, 310); move(50, 350, 'mouse'); c.cancel(); finishAll();
    const n = targets.length;
    sc.scrollTop = 100; sc.dispatchEvent(new Event('scroll'));
    expect(targets.length).toBe(n);
  });
});

describe('drag watch (read-only state for the drag helper cat)', () => {
  it('reports start, the drawn rect and displacement per frame, rest time, and one end on drop', async () => {
    setAnimationSetting('reduced'); // the card snaps to the target, so the drawn rect is exact
    const frames: DragFrame[] = [];
    const stop = watchDrags((f) => frames.push(f));
    const { c } = make({ hitTest: () => ({ key: 'slot', dx: 0, dy: 96 }) });
    down('mouse', 50, 50); move(50, 146, 'mouse');
    expect(frames[0]).toMatchObject({ phase: 'start', rect: { left: 40, top: 40, width: 100, height: 40 } });
    vi.advanceTimersByTime(40);
    const last = frames.at(-1)!;
    expect(last).toMatchObject({ phase: 'move', dx: 0, dy: 96, rect: { left: 40, top: 136 } });
    expect(last.stillMs).toBeLessThan(100);
    // the pointer rests: stillMs grows with frame time
    vi.advanceTimersByTime(600);
    expect(frames.at(-1)!.stillMs).toBeGreaterThan(500);
    up(50, 146, 'mouse');
    expect(frames.filter((f) => f.phase === 'end')).toHaveLength(1);
    expect(frames.at(-1)).toMatchObject({ phase: 'end', dy: 96 });
    await flush(); finishAll(); await flush();
    expect(c.state).toBe('idle');
    expect(frames.filter((f) => f.phase === 'end')).toHaveLength(1);
    stop();
  });

  it('reports end on cancel, nothing for a press that never picks up, and nothing after unsubscribing', () => {
    const frames: DragFrame[] = [];
    const stop = watchDrags((f) => frames.push(f));
    const { c } = make();
    down('mouse', 50, 50); up(50, 50, 'mouse');
    expect(frames).toEqual([]);
    down('mouse', 50, 50); move(80, 90, 'mouse'); vi.advanceTimersByTime(40);
    c.cancel();
    expect(frames.map((f) => f.phase).filter((p) => p !== 'move')).toEqual(['start', 'end']);
    finishAll();
    stop();
    const n = frames.length;
    down('mouse', 50, 50); move(80, 90, 'mouse'); vi.advanceTimersByTime(40); c.cancel(); finishAll();
    expect(frames.length).toBe(n);
  });

  it('a throwing watcher never breaks the drag', () => {
    const stop = watchDrags(() => { throw new Error('boom'); });
    const { c } = make();
    down('mouse', 50, 50); move(80, 90, 'mouse'); vi.advanceTimersByTime(40);
    expect(c.state).toBe('dragging');
    c.cancel(); finishAll();
    stop();
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
  it('slot grid keeps the card at its place inside the column (a right-hand side-by-side card stays under the finger)', () => {
    // 7 columns of 50 px after a 20 px gutter; column 1 spans 70..120
    const hit = createSlotGrid({ rect: () => rect(0, 0, 370, 1440), columns: 7, pxPerMinute: 1, gutter: 20 });
    const right = { originRect: rect(96, 100, 23, 60), grab: { x: 10, y: 10 } }; // right half of column 1
    expect(hit(106, 110, right)!.dx).toBe(0);
    expect(hit(206, 110, right)!.dx).toBe(100); // column 3: two whole columns further
    const left = { originRect: rect(71, 100, 23, 60), grab: { x: 10, y: 10 } }; // left edge of column 1
    expect(hit(81, 110, left)!.dx).toBe(0);
    expect(hit(131, 110, left)!.dx).toBe(50);
    // the card's left edge is in column 0 but it was pressed in column 1: the press point decides (no 50 px jump)
    const straddling = { originRect: rect(60, 100, 40, 60), grab: { x: 20, y: 10 } };
    expect(hit(80, 110, straddling)!.dx).toBe(0);
  });
  it('cell grid finds the cell under the pointer', () => {
    const a = document.createElement('div'); a.getBoundingClientRect = () => rect(0, 0, 50, 50);
    const b = document.createElement('div'); b.getBoundingClientRect = () => rect(50, 0, 50, 50);
    const hit = createCellGrid({ cells: () => [{ el: a, key: 'a' }, { el: b, key: 'b' }] });
    expect(hit(60, 10, ctx)!.key).toBe('b');
    expect(hit(500, 10, ctx)).toBeNull();
  });
});
