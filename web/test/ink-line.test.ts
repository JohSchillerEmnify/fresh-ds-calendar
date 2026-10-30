import { beforeEach, describe, expect, it } from 'vitest';
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

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

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
    draw(svg, { pointerType: 'touch', width: 60 });
    expect(w.emitted('change')).toHaveLength(1);
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
    const palm = { pointerType: 'touch', width: 60 };
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
});
