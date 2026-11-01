import { describe, expect, it } from 'vitest';
import { resolveBarSize } from '@/composables/useBarSize';

describe('resolveBarSize', () => {
  it('auto is Compact on phones and Expressive elsewhere', () => {
    expect(resolveBarSize('auto', true)).toBe('compact');
    expect(resolveBarSize('auto', false)).toBe('expressive');
  });
  it('an explicit choice wins on every screen', () => {
    expect(resolveBarSize('expressive', true)).toBe('expressive');
    expect(resolveBarSize('compact', false)).toBe('compact');
  });
});

describe('bottomBarSizeOf', () => {
  it('only a phone has a Compact bottom bar; wider screens always draw Expressive', async () => {
    const { bottomBarSizeOf } = await import('@/composables/useBarSize');
    expect(bottomBarSizeOf('compact', true)).toBe('compact');
    expect(bottomBarSizeOf('compact', false)).toBe('expressive');
    expect(bottomBarSizeOf('auto', false)).toBe('expressive');
  });
});
