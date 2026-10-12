import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SupportCat from '@/features/motivation/SupportCat.vue';
import { CAT_CHANCE, CAT_DURATION_MS, catComes, catDuration, takeForcedCat } from '@/features/motivation/supportCat';

describe('support cat roll', () => {
  it('comes by on about one in ten finished lists', () => {
    expect(CAT_CHANCE).toBe(0.1);
    expect(catComes({ level: 'full', setting: 'on', forced: false, random: 0.05 })).toBe(true);
    expect(catComes({ level: 'full', setting: 'on', forced: false, random: 0.1 })).toBe(false);
    expect(catComes({ level: 'reduced', setting: 'on', forced: false, random: 0.099 })).toBe(true);
    expect(catComes({ level: 'full', setting: 'on', forced: false, random: 0.9 })).toBe(false);
  });

  it('the test hook forces the roll', () => {
    expect(catComes({ level: 'full', setting: 'on', forced: true, random: 0.99 })).toBe(true);
  });

  it('never comes at animation level Off or when switched off, even when forced', () => {
    expect(catComes({ level: 'off', setting: 'on', forced: true, random: 0 })).toBe(false);
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
