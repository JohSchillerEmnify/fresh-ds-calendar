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
