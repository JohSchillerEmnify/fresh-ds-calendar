import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import InkLine from '@/features/tasklists/InkLine.vue';
import { useInkStore } from '@/stores/ink';
import { usePrefsStore } from '@/stores/prefs';

/** A pointer event as a pen, a finger or a mouse sends it. */
const ev = (type: string, x: number, y: number, o: { pointerType: string; buttons?: number; pressure?: number; width?: number }) => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: o.buttons ?? 1 });
  Object.assign(e, { pointerId: o.pointerType === 'touch' ? 2 : 1, pointerType: o.pointerType, pressure: o.pressure ?? 0.5, width: o.width ?? 1, height: o.width ?? 1 });
  return e;
};

function setup(strokes: { p: [number, number, number][] }[] = []) {
  setActivePinia(createPinia());
  const w = mount(InkLine, { props: { strokes, editable: true }, attachTo: document.body });
  const svg = w.element as SVGSVGElement;
  // jsdom lays nothing out: a 200 x 40 px line, so 1 line height = 40 px
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 40, right: 200, bottom: 40, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return { w, svg };
}
const draw = (svg: Element, o: { pointerType: string; width?: number }) => {
  svg.dispatchEvent(ev('pointerdown', 10, 20, o));
  svg.dispatchEvent(ev('pointermove', 40, 22, o));
  svg.dispatchEvent(ev('pointerup', 80, 20, o));
};

beforeEach(() => { document.body.innerHTML = ''; document.documentElement.removeAttribute('style'); localStorage.clear(); });

describe('InkLine', () => {
  it('takes a pen stroke in line heights with its pressure and remembers that a pen is in use', () => {
    const { w, svg } = setup();
    draw(svg, { pointerType: 'pen' });
    const out = w.emitted('change')![0]![0] as { p: number[][] }[];
    expect(out).toHaveLength(1);
    expect(out[0]!.p[0]).toEqual([0.25, 0.5, 0.5]);
    expect(out[0]!.p.at(-1)![0]).toBeCloseTo(2);
    expect(useInkStore().penSeen).toBe(true);
  });

  it('never draws with the mouse; a click that drew nothing is a tap', () => {
    const { w, svg } = setup();
    draw(svg, { pointerType: 'mouse' });
    expect(w.emitted('change')).toBeUndefined();
    const { w: w2, svg: svg2 } = setup();
    svg2.dispatchEvent(ev('pointerdown', 5, 5, { pointerType: 'mouse' }));
    svg2.dispatchEvent(ev('pointerup', 5, 5, { pointerType: 'mouse' }));
    expect(w2.emitted('tap')).toHaveLength(1);
  });

  it('does not draw with a finger unless "Draw with finger" is on, and never with a palm', () => {
    const { w, svg } = setup();
    draw(svg, { pointerType: 'touch' });
    expect(w.emitted('change')).toBeUndefined();
    usePrefsStore().labsDrawWithFinger = true;
    draw(svg, { pointerType: 'touch' });
    expect(w.emitted('change')).toHaveLength(1);
    draw(svg, { pointerType: 'touch', width: 50 });
    expect(w.emitted('change')).toHaveLength(2);
    draw(svg, { pointerType: 'touch', width: 80 });
    expect(w.emitted('change')).toHaveLength(2);
  });

  it('ignores a finger that comes right after the pen (a resting palm)', () => {
    const { w, svg } = setup();
    usePrefsStore().labsDrawWithFinger = true;
    svg.dispatchEvent(ev('pointerdown', 10, 20, { pointerType: 'pen' }));
    svg.dispatchEvent(ev('pointerdown', 50, 30, { pointerType: 'touch' }));
    svg.dispatchEvent(ev('pointerup', 50, 30, { pointerType: 'touch' }));
    svg.dispatchEvent(ev('pointermove', 40, 22, { pointerType: 'pen' }));
    svg.dispatchEvent(ev('pointerup', 80, 20, { pointerType: 'pen' }));
    expect(w.emitted('change')).toHaveLength(1);
    expect((w.emitted('change')![0]![0] as unknown[]).length).toBe(1);
  });

  it('erases the strokes the eraser end touches', () => {
    const { w, svg } = setup([{ p: [[0.2, 0.5, 0.5], [2, 0.5, 0.5]] }, { p: [[3, 0.5, 0.5], [4, 0.5, 0.5]] }]);
    svg.dispatchEvent(ev('pointerdown', 40, 20, { pointerType: 'pen', buttons: 32 }));
    svg.dispatchEvent(ev('pointerup', 40, 20, { pointerType: 'pen', buttons: 0 }));
    const out = w.emitted('change')![0]![0] as unknown[];
    expect(out).toHaveLength(1);
  });

  it('erases with the pen after the eraser button, and draws again after pressing it twice', () => {
    const { w, svg } = setup([{ p: [[0.2, 0.5, 0.5], [2, 0.5, 0.5]] }]);
    const ink = useInkStore();
    ink.eraser = true;
    svg.dispatchEvent(ev('pointerdown', 40, 20, { pointerType: 'pen' }));
    svg.dispatchEvent(ev('pointerup', 40, 20, { pointerType: 'pen' }));
    expect(w.emitted('change')![0]![0]).toEqual([]);
    ink.eraser = false;
    draw(svg, { pointerType: 'pen' });
    expect((w.emitted('change')![1]![0] as unknown[]).length).toBe(2);
  });

  it('colours the stroke with the chosen ink colour and leaves the theme colour out', () => {
    const { w, svg } = setup();
    draw(svg, { pointerType: 'pen' });
    expect((w.emitted('change')![0]![0] as { c?: string }[])[0]!.c).toBeUndefined();
    useInkStore().setColour('#12ab56');
    draw(svg, { pointerType: 'pen' });
    expect((w.emitted('change')![1]![0] as { c?: string }[])[0]!.c).toBe('#12ab56');
  });

  it('draws nothing when read-only', () => {
    setActivePinia(createPinia());
    const w = mount(InkLine, { props: { strokes: [], editable: false }, attachTo: document.body });
    draw(w.element, { pointerType: 'pen' });
    expect(w.emitted('change')).toBeUndefined();
  });

  it('a palm moving or lifting while the pen writes does not add to the pen stroke or end it', () => {
    const { w, svg } = setup();
    const pen = { pointerType: 'pen' };
    const palm = { pointerType: 'touch', width: 80 };
    svg.dispatchEvent(ev('pointerdown', 150, 30, palm));
    svg.dispatchEvent(ev('pointerdown', 10, 20, pen));
    svg.dispatchEvent(ev('pointermove', 150, 35, palm));
    svg.dispatchEvent(ev('pointermove', 40, 22, pen));
    svg.dispatchEvent(ev('pointerup', 150, 35, palm));
    expect(w.emitted('change')).toBeUndefined();
    svg.dispatchEvent(ev('pointerup', 80, 20, pen));
    const out = w.emitted('change')![0]![0] as { p: number[][] }[];
    expect(out[0]!.p.every((q) => q[0]! < 3)).toBe(true);
  });
  it('a finger touching after a pen hover gives the pan back', async () => {
    const { w, svg } = setup();
    svg.dispatchEvent(ev('pointerenter', 10, 20, { pointerType: 'pen' }));
    expect(svg.style.touchAction).toBe('none');
    await nextTick();
    expect(w.classes()).toContain('pen');
    svg.dispatchEvent(ev('pointerdown', 10, 20, { pointerType: 'touch' }));
    await nextTick();
    expect(svg.style.touchAction).toBe('');
    expect(w.classes()).not.toContain('pen');
  });

  it('a pen going down sets touch-action at once, and losing editable or unmounting resets it', async () => {
    const { w, svg } = setup();
    svg.dispatchEvent(ev('pointerdown', 10, 20, { pointerType: 'pen' }));
    expect(svg.style.touchAction).toBe('none');
    await w.setProps({ editable: false });
    expect(svg.style.touchAction).toBe('');
    await w.setProps({ editable: true });
    svg.dispatchEvent(ev('pointerenter', 10, 20, { pointerType: 'pen' }));
    expect(svg.style.touchAction).toBe('none');
    w.unmount();
    expect(svg.style.touchAction).toBe('');
  });

  it('a cancelled pen stroke of one point is not saved', () => {
    const { w, svg } = setup();
    svg.dispatchEvent(ev('pointerdown', 10, 20, { pointerType: 'pen' }));
    svg.dispatchEvent(ev('pointercancel', 10, 20, { pointerType: 'pen' }));
    expect(w.emitted('change')).toBeUndefined();
  });
});

describe('InkLine on a card', () => {
  const stroke = [{ p: [[0.2, 0.5, 0.5], [2, 0.5, 0.5]] as [number, number, number][], c: '#444444' }];
  /** A card (`.tl`) with the given look around an ink line. */
  function onCard(style: string, props: Record<string, unknown> = { onCard: '#ffffff' }) {
    setActivePinia(createPinia());
    const card = document.createElement('div');
    card.className = 'tl';
    card.setAttribute('style', style);
    document.body.appendChild(card);
    const w = mount(InkLine, { props: { strokes: stroke, ...props }, attachTo: card });
    return { w, card, ink: () => w.find('[data-testid=ink-stroke]').attributes('style') };
  }

  it('lays a see-through card over what is behind it, so the ink reads on the ground the user sees', async () => {
    document.documentElement.style.backgroundColor = 'rgb(0, 0, 0)';
    const { ink, card } = onCard('color: rgb(255, 255, 255); background-color: rgba(255, 255, 255, 0.2)');
    await nextTick();
    expect(ink()).not.toContain('#444444');
    card.remove();
  });

  it('keeps the colour on a ground it already reads on', () => {
    const { ink } = onCard('color: rgb(255, 255, 255); background-color: rgb(255, 255, 255)');
    expect(ink()).toContain('#444444');
  });

  it('reads the ground again when the card colour (onCard) changes, and once after mount', async () => {
    const { w, card, ink } = onCard('color: rgb(255, 255, 255); background-color: rgb(255, 255, 255)');
    expect(ink()).toContain('#444444');
    card.style.background = 'rgb(51, 51, 51)';
    await w.setProps({ onCard: '#333333' });
    await nextTick();
    expect(ink()).not.toContain('#444444');
  });

  it('watches only the attributes that change the theme on <html>', () => {
    const spy = vi.spyOn(MutationObserver.prototype, 'observe');
    const { card } = onCard('');
    const opts = spy.mock.calls.find((c) => c[0] === document.documentElement)?.[1];
    spy.mockRestore();
    expect(opts?.attributeFilter).toEqual(expect.arrayContaining(['data-theme', 'data-theme-name', 'style']));
    card.remove();
  });

  it('re-reads on the card\'s own background-color transition end only', async () => {
    const { card, ink } = onCard('color: rgb(255, 255, 255); background-color: rgb(255, 255, 255)');
    card.style.background = 'rgb(51, 51, 51)';
    const end = (target: Element, propertyName: string) => { const e = Object.assign(new Event('transitionend', { bubbles: true }), { propertyName }); target.dispatchEvent(e); };
    end(card, 'opacity');
    end(card.querySelector('svg')!, 'background-color');
    await nextTick();
    expect(ink()).toContain('#444444');
    end(card, 'background-color');
    await nextTick();
    expect(ink()).not.toContain('#444444');
  });
});
