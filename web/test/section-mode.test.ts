import { describe, expect, it, vi } from 'vitest';
import { cycleSection, nextMode, SECTION_MODES, sectionMode } from '@/features/tasklists/section';

describe('task section mode', () => {
  it('has two levels only and cycles titles -> full -> titles: no count level (owner, 2026-10-20)', () => {
    expect(SECTION_MODES).toEqual(['titles', 'full']);
    expect(nextMode('titles')).toBe('full');
    expect(nextMode('full')).toBe('titles');
  });
  it('a stored count level from before falls back to the default', async () => {
    // a fresh module copy: the mode is cached per view once read
    localStorage.setItem('tl-section-day', 'count');
    vi.resetModules();
    const fresh = await import('@/features/tasklists/section');
    expect(fresh.sectionMode('day', true)).toBe('titles');
    localStorage.removeItem('tl-section-day');
  });
  it('defaults to titles on phone, full otherwise, and persists the choice', () => {
    expect(sectionMode('week', true)).toBe('titles');
    expect(sectionMode('day', false)).toBe('full');
    expect(cycleSection('week', true)).toBe('full');
    expect(localStorage.getItem('tl-section-week')).toBe('full');
  });
});
