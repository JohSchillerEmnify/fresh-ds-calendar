import { describe, expect, it } from 'vitest';
import { datelessLab, isLabsViewOn, labPath, LABS_VIEWS, visibleLabsViews } from '@/features/labs/labs';

const ids = (labsOn: boolean, chosen: Record<string, boolean>) => visibleLabsViews(labsOn, chosen).map((v) => v.id);

describe('Labs views offered in the view switcher', () => {
  it('offers none with Labs off', () => {
    expect(ids(false, { strip: true })).toEqual([]);
  });
  it('offers Clock and Timeline but not Strip by default', () => {
    expect(ids(true, {})).toEqual(['clock', 'timeline', 'zoom', 'horizontal']);
  });
  it('offers Now only once switched on', () => {
    expect(ids(true, {})).not.toContain('now');
    expect(ids(true, { now: true })).toContain('now');
  });
  it('follows the person\'s choices over the defaults', () => {
    expect(ids(true, { strip: true, clock: false })).toEqual(['timeline', 'strip', 'zoom', 'horizontal']);
  });
  it('offers the bedtime runway only once the person switches it on', () => {
    expect(ids(true, {})).not.toContain('runway');
    expect(ids(true, { runway: true })).toContain('runway');
  });
  it('treats a view the person never chose and the registry does not know as on', () => {
    expect(isLabsViewOn('zoom-month', {})).toBe(true);
  });
  it('has one registry entry per id', () => {
    expect(new Set(LABS_VIEWS.map((v) => v.id)).size).toBe(LABS_VIEWS.length);
  });
  it('only Now and Timeline are date-less: no date in the path, the view name in the top bar', () => {
    for (const id of ['timeline', 'now']) expect(datelessLab(id)?.id).toBe(id);
    for (const id of ['clock', 'strip', 'zoom', 'horizontal']) expect(datelessLab(id)).toBeUndefined();
    expect(datelessLab(undefined)).toBeUndefined();
    const d = new Date(2026, 9, 14);
    expect(labPath('now', d)).toBe('/now');
    expect(labPath('timeline', d)).toBe('/timeline');
    expect(labPath('clock', d)).toBe('/clock/2026-10-14');
  });
});
