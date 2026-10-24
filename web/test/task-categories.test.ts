import { describe, expect, it } from 'vitest';
import { copyOf } from '@/features/tasklists/archive';
import { effectiveFilter, effectiveGroupBy, effectiveSortBy, listCategoryId, listColor } from '@/features/tasklists/categories';

describe('task categories switch: fall-backs while off', () => {
  it('groups by time instead of category, keeps other groupings', () => {
    expect(effectiveGroupBy('category', false)).toBe('time');
    expect(effectiveGroupBy('none', false)).toBe('none');
    expect(effectiveGroupBy('category', true)).toBe('category');
  });
  it('sorts by date instead of category, keeps other sortings', () => {
    expect(effectiveSortBy('category', false)).toBe('date');
    expect(effectiveSortBy('progress', false)).toBe('progress');
    expect(effectiveSortBy('category', true)).toBe('category');
  });
  it('ignores category chips but keeps When, without touching the stored filter', () => {
    const stored = { categories: ['work'], when: 'today' as const };
    expect(effectiveFilter(stored, false)).toEqual({ categories: [], when: 'today' });
    expect(stored.categories).toEqual(['work']);
    expect(effectiveFilter(stored, true)).toBe(stored);
  });
  it('shows the calendar colour and no category', () => {
    const l = { color: '#0b8043', calendarColor: '#039be5', categoryId: 'shopping' };
    expect(listColor(l, true)).toBe('#0b8043');
    expect(listColor(l, false)).toBe('#039be5');
    expect(listColor({ color: '#111111' }, false)).toBe('#111111');
    expect(listCategoryId(l, true)).toBe('shopping');
    expect(listCategoryId(l, false)).toBeNull();
  });
  it('a template copy has no category while off', () => {
    const l = { title: 'T', categoryId: 'work', tags: [], items: [] };
    expect(copyOf(l, false).categoryId).toBeNull();
    expect(copyOf(l).categoryId).toBe('work');
  });
});
