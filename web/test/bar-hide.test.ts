import { describe, expect, it } from 'vitest';
import { nextBarHidden } from '@/composables/useBarHide';

describe('nextBarHidden', () => {
  it('hides after scrolling down far enough and shows on the first real scroll up', () => {
    let s = { hidden: false, run: 0 };
    s = nextBarHidden(s.hidden, 20, s.run, 100);
    expect(s.hidden).toBe(false);
    s = nextBarHidden(s.hidden, 30, s.run, 130);
    expect(s.hidden).toBe(true);
    s = nextBarHidden(s.hidden, -10, s.run, 120);
    expect(s.hidden).toBe(true);
    s = nextBarHidden(s.hidden, -20, s.run, 100);
    expect(s.hidden).toBe(false);
  });
  it('is shown at the top of the view whatever came before', () => {
    expect(nextBarHidden(true, -3, 0, 0).hidden).toBe(false);
  });
  it('a change of direction starts a new run', () => {
    const s = nextBarHidden(false, 30, 0, 200);
    expect(nextBarHidden(s.hidden, -5, s.run, 195).run).toBe(-5);
  });
});

describe('scroll sources', () => {
  it('only the main view scrollers count, not dialogs or the task tray', async () => {
    const { countsForBar } = await import('@/composables/useBarHide');
    document.body.innerHTML = '<main><div id="a"></div></main><aside data-testid="task-tray"><ul id="b"></ul></aside><div role="dialog"><div id="c"></div></div><div id="d"></div>';
    expect(countsForBar(document.getElementById('a'))).toBe(true);
    expect(countsForBar(document.getElementById('b'))).toBe(false);
    expect(countsForBar(document.getElementById('c'))).toBe(false);
    expect(countsForBar(document.getElementById('d'))).toBe(false);
  });
  it('a document scroll resolves to the page scroller', async () => {
    const { scrollerOf } = await import('@/composables/useBarHide');
    expect(scrollerOf(document)).toBe(document.scrollingElement);
    expect(scrollerOf(window as unknown as EventTarget)).toBeNull();
  });
  it('only scroll keys count as scrolling input', async () => {
    const { isScrollKey } = await import('@/composables/useBarHide');
    for (const k of ['PageUp', 'PageDown', 'ArrowDown', 'ArrowUp', 'Home', 'End', ' ']) expect(isScrollKey(k)).toBe(true);
    for (const k of ['a', 'Enter', 'Tab', 'Escape']) expect(isScrollKey(k)).toBe(false);
  });
});
