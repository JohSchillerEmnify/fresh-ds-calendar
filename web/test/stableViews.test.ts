import { describe, expect, it } from 'vitest';
import { LABS_VIEWS, visibleLabsViews } from '@/features/labs/labs';
import { firstStableView, isStableViewOn, stableViewPath, STABLE_VIEWS, visibleStableViews } from '@/features/views/stableViews';

const ids = (chosen: Record<string, boolean>) => visibleStableViews(chosen).map((v) => v.id);

describe('main views offered in the view switcher', () => {
  it('lists Year, Month, Week, Day, Tasks and Clock, all on to begin with', () => {
    expect(ids({})).toEqual(['year', 'month', 'week', 'day', 'tasks', 'clock-rings']);
  });
  it('leaves out the views the person switched off', () => {
    expect(ids({ year: false, tasks: false })).toEqual(['month', 'week', 'day', 'clock-rings']);
    expect(isStableViewOn('year', { year: false })).toBe(false);
  });
  it('never offers an empty switcher: with every view off they are all offered again', () => {
    expect(ids(Object.fromEntries(STABLE_VIEWS.map((v) => [v.id, false])))).toHaveLength(STABLE_VIEWS.length);
  });
  it('picks the first view that is on to open', () => {
    expect(firstStableView({ year: false })).toBe('month');
    expect(firstStableView({})).toBe('year');
  });
  it('gives each view its path', () => {
    const d = new Date(2026, 9, 12);
    expect(stableViewPath('year', d)).toBe('/year/2026');
    expect(stableViewPath('week', d)).toBe('/week/2026-10-12');
    expect(stableViewPath('tasks', d)).toBe('/tasks');
    expect(stableViewPath('clock-rings', d)).toBe('/clock-rings/2026-10-12');
  });
  it('keeps the Clock out of the Labs views, whatever the Labs choices say', () => {
    expect(visibleLabsViews(true, { 'clock-rings': true }).map((v) => v.id)).not.toContain('clock-rings');
    expect(LABS_VIEWS.some((v) => v.id === 'clock-rings')).toBe(true);
  });
});
