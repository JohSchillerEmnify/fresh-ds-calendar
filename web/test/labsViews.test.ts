import { describe, expect, it } from 'vitest';
import { isLabsViewOn, LABS_VIEWS, visibleLabsViews } from '@/features/labs/labs';

const ids = (labsOn: boolean, chosen: Record<string, boolean>) => visibleLabsViews(labsOn, chosen).map((v) => v.id);

describe('Labs views offered in the view switcher', () => {
  it('offers none with Labs off', () => {
    expect(ids(false, { strip: true })).toEqual([]);
  });
  it('offers Clock and Timeline but not Strip by default', () => {
    expect(ids(true, {})).toEqual(['clock', 'timeline', 'zoom', 'horizontal']);
  });
  it('follows the person\'s choices over the defaults', () => {
    expect(ids(true, { strip: true, clock: false })).toEqual(['timeline', 'strip', 'zoom', 'horizontal']);
  });
  it('treats a view the person never chose and the registry does not know as on', () => {
    expect(isLabsViewOn('zoom-month', {})).toBe(true);
  });
  it('has one registry entry per id', () => {
    expect(new Set(LABS_VIEWS.map((v) => v.id)).size).toBe(LABS_VIEWS.length);
  });
});
