import { beforeEach, describe, expect, it } from 'vitest';
import { RESUME_MS, rememberPeriod, resumePath } from '@/lib/lastPeriod';

describe('lastPeriod', () => {
  beforeEach(() => localStorage.clear());

  it('offers the last calendar period within the resume window', () => {
    rememberPeriod('/month/2026-12?tags=a', 1000);
    expect(resumePath(1000 + RESUME_MS - 1)).toBe('/month/2026-12?tags=a');
  });

  it('offers nothing after the window, so a fresh opening shows today', () => {
    rememberPeriod('/week/2026-12-07', 1000);
    expect(resumePath(1000 + RESUME_MS + 1)).toBeNull();
  });

  it('offers nothing when nothing was stored', () => {
    expect(resumePath(5)).toBeNull();
  });

  it('ignores a stored value that is not a calendar period of this app', () => {
    localStorage.setItem('cal.lastPeriod', JSON.stringify({ path: '//evil.test/x', at: 1000 }));
    expect(resumePath(1001)).toBeNull();
    localStorage.setItem('cal.lastPeriod', JSON.stringify({ path: '/settings', at: 1000 }));
    expect(resumePath(1001)).toBeNull();
    localStorage.setItem('cal.lastPeriod', 'garbage');
    expect(resumePath(1001)).toBeNull();
  });
});
