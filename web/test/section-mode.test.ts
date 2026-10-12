import { describe, expect, it } from 'vitest';
import { cycleSection, nextMode, sectionMode } from '@/features/tasklists/section';

describe('task section mode', () => {
  it('cycles titles -> full -> count -> titles', () => {
    expect(nextMode('titles')).toBe('full');
    expect(nextMode('full')).toBe('count');
    expect(nextMode('count')).toBe('titles');
  });
  it('defaults to titles on phone, full otherwise, and persists the choice', () => {
    expect(sectionMode('week', true)).toBe('titles');
    expect(sectionMode('day', false)).toBe('full');
    expect(cycleSection('week', true)).toBe('full');
    expect(localStorage.getItem('tl-section-week')).toBe('full');
  });
});
