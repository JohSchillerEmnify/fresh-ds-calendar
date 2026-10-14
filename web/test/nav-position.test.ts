import { describe, expect, it } from 'vitest';
import { NAV_POSITIONS, railSide, resolveNavPosition } from '@/lib/navPosition';

describe('resolveNavPosition', () => {
  const prefs = { navPhone: 'top', navDesktop: 'bottom' } as const;
  it('uses the phone pref on a phone and the desktop pref everywhere else', () => {
    expect(resolveNavPosition(true, prefs)).toBe('top');
    expect(resolveNavPosition(false, prefs)).toBe('bottom');
  });
  it('keeps the defaults: bottom bar on phones, rail on desktop', () => {
    const d = { navPhone: 'bottom', navDesktop: 'rail' } as const;
    expect(resolveNavPosition(true, d)).toBe('bottom');
    expect(resolveNavPosition(false, d)).toBe('rail');
  });
  it('offers the three positions', () => {
    expect(NAV_POSITIONS).toEqual(['bottom', 'top', 'rail']);
  });
});

describe('railSide', () => {
  it('puts a phone rail on the thumb side', () => {
    expect(railSide(true, false)).toBe('right');
    expect(railSide(true, true)).toBe('left');
  });
  it('keeps a desktop or tablet rail at the left, also in left-handed mode', () => {
    expect(railSide(false, false)).toBe('left');
    expect(railSide(false, true)).toBe('left');
  });
});
