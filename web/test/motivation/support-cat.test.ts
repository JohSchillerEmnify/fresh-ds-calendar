import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SupportCat from '@/features/motivation/SupportCat.vue';
import { CAT_CHANCE, CAT_DURATION_MS, CAT_SWIPE, catComes, catDuration, catSwipe, takeForcedCat } from '@/features/motivation/supportCat';

describe('support cat roll', () => {
  it('comes by on about one in ten finished lists', () => {
    expect(CAT_CHANCE).toBe(0.1);
    expect(catComes({ level: 'full', setting: 'sometimes', forced: false, random: 0.05 })).toBe(true);
    expect(catComes({ level: 'full', setting: 'sometimes', forced: false, random: 0.1 })).toBe(false);
    expect(catComes({ level: 'reduced', setting: 'sometimes', forced: false, random: 0.099 })).toBe(true);
    expect(catComes({ level: 'full', setting: 'sometimes', forced: false, random: 0.9 })).toBe(false);
  });

  it('the test hook forces the roll', () => {
    expect(catComes({ level: 'full', setting: 'sometimes', forced: true, random: 0.99 })).toBe(true);
  });

  it('"Every time" skips the roll', () => {
    expect(catComes({ level: 'full', setting: 'always', forced: false, random: 0.99 })).toBe(true);
    expect(catComes({ level: 'reduced', setting: 'always', forced: false, random: 0.5 })).toBe(true);
  });

  it('never comes at animation level Off or when set to Off, even when forced', () => {
    expect(catComes({ level: 'off', setting: 'sometimes', forced: true, random: 0 })).toBe(false);
    expect(catComes({ level: 'off', setting: 'always', forced: false, random: 0 })).toBe(false);
    expect(catComes({ level: 'full', setting: 'off', forced: true, random: 0 })).toBe(false);
  });

  it('honours window.__catNext only in test mode and consumes it', () => {
    const w: { __catNext?: boolean } = { __catNext: true };
    expect(takeForcedCat(false, w)).toBe(false);
    expect(w.__catNext).toBe(true);
    expect(takeForcedCat(true, w)).toBe(true);
    expect(w.__catNext).toBe(false);
    expect(takeForcedCat(true, w)).toBe(false);
    expect(takeForcedCat(true, {})).toBe(false);
  });

  it('is about 3 s at Full, shorter at Reduced, nothing at Off', () => {
    expect(catDuration('full')).toBe(CAT_DURATION_MS.full);
    expect(CAT_DURATION_MS.full).toBeGreaterThanOrEqual(2500);
    expect(CAT_DURATION_MS.full).toBeLessThanOrEqual(3500);
    expect(catDuration('reduced')).toBeLessThan(catDuration('full'));
    expect(catDuration('off')).toBe(0);
  });
});

describe('paw swipe timing', () => {
  it('falls inside the visit, after the cat has arrived and before it fades out', () => {
    for (const level of ['full', 'reduced'] as const) {
      const sw = catSwipe(level)!;
      expect(sw.delay).toBe(Math.round(CAT_DURATION_MS[level] * CAT_SWIPE[level].at));
      expect(sw.duration).toBeGreaterThan(200);
      expect(sw.delay + sw.duration).toBeLessThan(CAT_DURATION_MS[level] * 0.8);
    }
    expect(catSwipe('full')!.delay).toBeGreaterThanOrEqual(CAT_DURATION_MS.full * 0.3); // after the walk-in
  });

  it('has no swipe at Off', () => {
    expect(catSwipe('off')).toBeNull();
  });
});

describe('SupportCat', () => {
  afterEach(() => vi.useRealTimers());
  const card = { left: 0, top: 100, right: 375, bottom: 400 };

  it('renders the cat next to the card and is done after the sequence', () => {
    vi.useFakeTimers();
    const w = mount(SupportCat, { props: { card, level: 'full' } });
    const el = w.get('[data-testid="support-cat"]');
    expect(el.attributes('aria-hidden')).toBe('true');
    expect(el.attributes('style')).toContain('left: 297px');
    expect(el.attributes('style')).toContain('top: 106px');
    vi.advanceTimersByTime(CAT_DURATION_MS.full - 1);
    expect(w.emitted('done')).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(w.emitted('done')).toHaveLength(1);
    w.unmount();
  });

  it('stands at the end of the title when it is known, but never past the card', () => {
    vi.useFakeTimers();
    const w = mount(SupportCat, { props: { card, title: { left: 60, top: 120, right: 180, bottom: 148 }, level: 'full' } });
    const style = w.get('[data-testid="support-cat"]').attributes('style');
    expect(style).toContain('left: 160px');
    expect(style).toContain('top: 80px');
    w.unmount();
    const far = mount(SupportCat, { props: { card, title: { left: 60, top: 120, right: 900, bottom: 148 }, level: 'full' } });
    expect(far.get('[data-testid="support-cat"]').attributes('style')).toContain('left: 297px');
    far.unmount();
  });

  it('is shorter at Reduced', () => {
    vi.useFakeTimers();
    const w = mount(SupportCat, { props: { card, level: 'reduced' } });
    expect(w.get('[data-testid="support-cat"]').attributes('data-level')).toBe('reduced');
    vi.advanceTimersByTime(CAT_DURATION_MS.reduced);
    expect(w.emitted('done')).toHaveLength(1);
    w.unmount();
  });

  it('stops its timer when removed early', () => {
    vi.useFakeTimers();
    const w = mount(SupportCat, { props: { card, level: 'full' } });
    w.unmount();
    vi.advanceTimersByTime(CAT_DURATION_MS.full);
    expect(w.emitted('done')).toBeUndefined();
  });
});
