import { describe, expect, it, vi } from 'vitest';
import {
  bindSwipeCarousel, followOffset, lockAxis, releaseTarget, settleVelocity, type CarouselHooks,
} from '@/composables/useSwipeCarousel';

describe('swipe carousel gesture math', () => {
  it('locks the axis only after the slop, horizontal when |dx| > 1.5·|dy|', () => {
    expect(lockAxis(9, 0)).toBeNull();
    expect(lockAxis(-12, 4)).toBe('h');
    expect(lockAxis(15, 10)).toBe('v'); // exactly 1.5: not horizontal
    expect(lockAxis(2, -20)).toBe('v');
  });

  it('settles past a third of the width, else springs back', () => {
    expect(releaseTarget(-131, 0, 390)).toBe(1);
    expect(releaseTarget(-130, 0, 390)).toBe(0);
    expect(releaseTarget(140, 0, 390)).toBe(-1);
    expect(releaseTarget(0, -2, 390)).toBe(0);
  });

  it('settles on a flick > 0.5 px/ms toward the neighbour, whatever the distance', () => {
    expect(releaseTarget(-30, -0.6, 390)).toBe(1);
    expect(releaseTarget(30, 0.6, 390)).toBe(-1);
    expect(releaseTarget(-30, -0.5, 390)).toBe(0);
    // moving away from the neighbour is no flick toward it
    expect(releaseTarget(-30, 0.9, 390)).toBe(0);
  });

  it('springs back on a flick back toward the start, even past a third', () => {
    expect(releaseTarget(-300, 0.6, 390)).toBe(0);
    expect(releaseTarget(300, -0.6, 390)).toBe(0);
    // a slow drift back does not cancel
    expect(releaseTarget(-300, 0.4, 390)).toBe(1);
  });

  it('follows the finger up to one width', () => {
    expect(followOffset(-120, 390)).toBe(-120);
    expect(followOffset(-500, 390)).toBe(-390);
    expect(followOffset(500, 390)).toBe(390);
  });

  it('normalises the release velocity toward the target for the spring', () => {
    // 1 px/ms over 200 px left to go = 5 widths of the remaining distance per second
    expect(settleVelocity(-190, -390, -1)).toBe(5);
    expect(settleVelocity(-100, 0, -1)).toBe(0); // moving away from the target
    expect(settleVelocity(-389, -390, -5)).toBe(30); // capped
    expect(settleVelocity(0, 0, 3)).toBe(0);
  });
});

function touch(el: Element, type: string, x: number, y: number, t: number) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] });
  Object.defineProperty(e, 'timeStamp', { value: t });
  el.dispatchEvent(e);
}

function bind(over: Partial<Pick<CarouselHooks, 'disabled' | 'width'>> = {}) {
  const el = document.createElement('div');
  const h = { disabled: () => false, width: () => 400, ...over, start: vi.fn(), move: vi.fn(), end: vi.fn(), cancel: vi.fn() };
  const off = bindSwipeCarousel(el, h);
  return { el, h, off };
}

describe('swipe carousel binding', () => {
  it('starts on a horizontal move, follows, and springs back on a slow short release', () => {
    const { el, h } = bind();
    touch(el, 'touchstart', 300, 100, 0);
    touch(el, 'touchmove', 296, 101, 50);
    expect(h.start).not.toHaveBeenCalled();
    touch(el, 'touchmove', 250, 102, 250);
    expect(h.start).toHaveBeenCalledWith(1);
    expect(h.move).toHaveBeenLastCalledWith(-50);
    touch(el, 'touchmove', 200, 102, 500);
    touch(el, 'touchend', 200, 102, 520);
    expect(h.end).toHaveBeenCalledWith(0, expect.any(Number));
  });

  it('settles on the next period when let go past a third', () => {
    const { el, h } = bind();
    touch(el, 'touchstart', 300, 100, 0);
    for (let i = 1; i <= 10; i++) touch(el, 'touchmove', 300 - 20 * i, 100, i * 60);
    touch(el, 'touchend', 100, 100, 1000);
    expect(h.end).toHaveBeenCalledWith(1, 0); // the finger rested: no velocity
  });

  it('settles on a quick flick below the distance', () => {
    const { el, h } = bind();
    touch(el, 'touchstart', 100, 100, 0);
    touch(el, 'touchmove', 120, 100, 20);
    touch(el, 'touchmove', 160, 100, 60);
    touch(el, 'touchend', 160, 100, 70);
    expect(h.start).toHaveBeenCalledWith(-1);
    expect(h.end).toHaveBeenCalledWith(-1, expect.any(Number));
    expect(h.end.mock.calls[0][1]).toBeGreaterThan(0.5);
  });

  it('swaps the neighbour when the finger crosses back over the start', () => {
    const { el, h } = bind();
    touch(el, 'touchstart', 200, 100, 0);
    touch(el, 'touchmove', 170, 100, 100);
    touch(el, 'touchmove', 230, 100, 300);
    expect(h.start.mock.calls).toEqual([[1], [-1]]);
  });

  it('leaves vertical moves alone for the rest of the touch', () => {
    const { el, h } = bind();
    touch(el, 'touchstart', 200, 100, 0);
    touch(el, 'touchmove', 198, 140, 50);
    touch(el, 'touchmove', 100, 140, 100);
    touch(el, 'touchend', 100, 140, 120);
    expect(h.start).not.toHaveBeenCalled();
    expect(h.end).not.toHaveBeenCalled();
  });

  it('ignores touches while disabled and cancels when the gesture is claimed mid-way', () => {
    let off = true;
    const { el, h } = bind({ disabled: () => off });
    touch(el, 'touchstart', 200, 100, 0);
    touch(el, 'touchmove', 150, 100, 100);
    expect(h.start).not.toHaveBeenCalled();
    off = false;
    touch(el, 'touchstart', 200, 100, 200);
    touch(el, 'touchmove', 150, 100, 300);
    off = true;
    touch(el, 'touchmove', 140, 100, 350);
    expect(h.cancel).toHaveBeenCalledTimes(1);
    touch(el, 'touchend', 140, 100, 400);
    expect(h.end).not.toHaveBeenCalled();
  });

  it('springs back on touchcancel and stops listening once disposed', () => {
    const { el, h, off } = bind();
    touch(el, 'touchstart', 200, 100, 0);
    touch(el, 'touchmove', 150, 100, 100);
    touch(el, 'touchcancel', 150, 100, 120);
    expect(h.cancel).toHaveBeenCalledTimes(1);
    off();
    touch(el, 'touchstart', 200, 100, 200);
    touch(el, 'touchmove', 150, 100, 300);
    expect(h.start).toHaveBeenCalledTimes(1);
  });
});
