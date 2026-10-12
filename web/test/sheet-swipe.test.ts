import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import { setAnimationSetting } from '@/motion/level';


vi.hoisted(() => {
  globalThis.matchMedia = ((q: string) => ({ matches: q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof matchMedia;
});

function touch(el: Element, type: string, x: number, y: number, t: number) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] });
  Object.defineProperty(e, 'timeStamp', { value: t });
  el.dispatchEvent(e);
  return e;
}
function swipe(el: Element, dy: number, ms = 600) {
  touch(el, 'touchstart', 100, 100, 0);
  touch(el, 'touchmove', 100, 100 + dy / 2, ms / 2);
  touch(el, 'touchmove', 100, 100 + dy, ms);
  touch(el, 'touchend', 100, 100 + dy, ms);
}
async function make() {
  const w = mount(AdaptiveSheet, {
    props: { open: true, label: 'x' }, attachTo: document.body,
    slots: { default: '<button id="b">b</button><input id="i"><div data-no-sheet-drag id="n">n</div>' },
  });
  const panel = w.get('.panel').element as HTMLElement;
  Object.defineProperty(panel, 'offsetHeight', { value: 400 });
  await nextTick();
  return { w, panel };
}

describe('sheet swipe', () => {
  afterEach(() => { setAnimationSetting('full'); document.body.innerHTML = ''; vi.useRealTimers(); });

  it('closes past 25% (after the slide) and tracks the finger', async () => {
    vi.useFakeTimers();
    const { w, panel } = await make();
    touch(panel, 'touchstart', 100, 100, 0);
    const mv = touch(panel, 'touchmove', 100, 250, 1000);
    expect(mv.defaultPrevented).toBe(true);
    await nextTick();
    expect(panel.style.transform).toContain('translateY(142px)');
    touch(panel, 'touchend', 100, 250, 1000);
    expect(w.emitted('close')).toBeUndefined();
    vi.advanceTimersByTime(200);
    expect(w.emitted('close')).toHaveLength(1);
  });

  it('closes on a fast flick below the distance threshold', async () => {
    setAnimationSetting('off');
    const { w, panel } = await make();
    swipe(panel, 60, 50);
    expect(w.emitted('close')).toHaveLength(1);
  });

  it('springs back below the threshold', async () => {
    const { w, panel } = await make();
    swipe(panel, 60, 900);
    expect(w.emitted('close')).toBeUndefined();
    expect(panel.style.transform).toBe('');
  });

  it('does not start when content is scrolled', async () => {
    const { w, panel } = await make();
    (w.get('.body').element as HTMLElement).scrollTop = 30;
    swipe(w.get('#b').element, 300, 100);
    expect(w.emitted('close')).toBeUndefined();
    expect(panel.style.transform).toBe('');
  });

  it('ignores inputs, no-drag elements and horizontal moves', async () => {
    setAnimationSetting('off');
    const { w } = await make();
    swipe(w.get('#i').element, 300, 100);
    swipe(w.get('#n').element, 300, 100);
    touch(w.get('#b').element, 'touchstart', 100, 100, 0);
    touch(w.get('#b').element, 'touchmove', 300, 130, 50);
    touch(w.get('#b').element, 'touchend', 300, 130, 50);
    expect(w.emitted('close')).toBeUndefined();
  });

  it('dirty guard: emits close immediately and snaps back', async () => {
    const w = mount(AdaptiveSheet, { props: { open: true, label: 'x', dismissOnScrim: false }, attachTo: document.body });
    const panel = w.get('.panel').element as HTMLElement;
    Object.defineProperty(panel, 'offsetHeight', { value: 400 });
    await nextTick();
    swipe(panel, 300, 100);
    expect(w.emitted('close')).toHaveLength(1);
    expect(panel.style.transform).toBe('');
  });

  it('removes listeners and pending timer on unmount', async () => {
    vi.useFakeTimers();
    const { w, panel } = await make();
    swipe(panel, 300, 100);
    w.unmount();
    vi.advanceTimersByTime(500);
    expect(w.emitted('close')).toBeUndefined();
    const e = touch(panel, 'touchmove', 100, 400, 1);
    expect(e.defaultPrevented).toBe(false);
  });
});
