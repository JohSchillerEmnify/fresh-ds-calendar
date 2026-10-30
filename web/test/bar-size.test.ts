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
