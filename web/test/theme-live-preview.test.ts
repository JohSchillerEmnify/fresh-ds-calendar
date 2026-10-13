import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import EventItem from '@/features/calendar/EventItem.vue';
import { registerItemRenderer } from '@/extensions/registry';
import ThemeLivePreview from '@/components/settings/ThemeLivePreview.vue';
import {
  COLLAPSED_KEY, GRID_HEIGHT_PX, SAMPLE_EVENTS, SAMPLE_TASKS, previewScale, readCollapsed, sampleBox, sampleSegment, writeCollapsed,
} from '@/components/settings/themeLivePreviewSample';
import { setAnimationSetting } from '@/motion/level';
import { freshPinia } from './helpers';

beforeEach(() => { localStorage.clear(); setAnimationSetting('full'); registerItemRenderer('event', EventItem); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('live preview sample data', () => {
  it('has events in different colours, all inside the sample grid and never today', () => {
    expect(new Set(SAMPLE_EVENTS.map((e) => e.color)).size).toBe(SAMPLE_EVENTS.length);
    for (const e of SAMPLE_EVENTS) {
      const b = sampleBox(e);
      expect(b.top).toBeGreaterThanOrEqual(0);
      expect(b.top + b.height).toBeLessThanOrEqual(GRID_HEIGHT_PX);
      expect(sampleSegment(e, 'x').date > '2029-12-31').toBe(true);
    }
  });
  it('has a task list with ticked and open items', () => {
    expect(SAMPLE_TASKS.some((x) => x.done)).toBe(true);
    expect(SAMPLE_TASKS.some((x) => !x.done)).toBe(true);
  });
  it('builds a timed block segment', () => {
    const s = sampleSegment(SAMPLE_EVENTS[0], 'Team sync');
    expect(s).toMatchObject({ allDay: false, startMin: 540, endMin: 630, first: true, last: true });
  });
});

describe('collapsed state storage and scale', () => {
  it('is remembered per device and expanded by default', () => {
    expect(readCollapsed()).toBe(false);
    writeCollapsed(true);
    expect(localStorage.getItem(COLLAPSED_KEY)).toBe('1');
    expect(readCollapsed()).toBe(true);
    writeCollapsed(false);
    expect(readCollapsed()).toBe(false);
  });
  it('survives unavailable storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } });
    expect(readCollapsed()).toBe(false);
    expect(() => writeCollapsed(true)).not.toThrow();
  });
  it('scales down to fit, never up, and is 1 while unmeasured', () => {
    expect(previewScale(210, 420)).toBe(0.5);
    expect(previewScale(800, 420)).toBe(1);
    expect(previewScale(0, 420)).toBe(1);
  });
});

describe('ThemeLivePreview', () => {
  it('draws real components with sample data and no network call', () => {
    freshPinia();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const w = mount(ThemeLivePreview);
    expect(w.get('[data-testid=theme-live-preview]').attributes('data-collapsed')).toBe('false');
    expect(w.find('[data-testid=top-bar]').exists()).toBe(true);
    expect(w.findAll('.ev .skin')).toHaveLength(SAMPLE_EVENTS.length);
    expect(w.findAll('[data-testid=reward-checkbox]')).toHaveLength(SAMPLE_TASKS.length);
    expect(w.findAll('input[type=checkbox]').filter((i) => (i.element as HTMLInputElement).checked)).toHaveLength(SAMPLE_TASKS.filter((x) => x.done).length);
    // only the first sample event carries the scenarios' testid, and none the calendar's `event-chip`
    expect(w.findAll('[data-testid=theme-preview-event]')).toHaveLength(1);
    expect(w.find('[data-testid=event-chip]').exists()).toBe(false);
    expect(w.get('.scaled').attributes('inert')).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('collapses to the top bar strip, remembers it and expands again', async () => {
    freshPinia();
    const w = mount(ThemeLivePreview);
    const toggle = w.get('[data-testid=theme-live-preview-toggle]');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    await toggle.trigger('click');
    expect(w.get('[data-testid=theme-live-preview]').attributes('data-collapsed')).toBe('true');
    expect(w.find('.body').exists()).toBe(false);
    expect(w.find('[data-testid=top-bar]').exists()).toBe(true);
    expect(localStorage.getItem(COLLAPSED_KEY)).toBe('1');
    // a new mount (another visit, same device) starts collapsed
    const again = mount(ThemeLivePreview);
    expect(again.get('[data-testid=theme-live-preview]').attributes('data-collapsed')).toBe('true');
    await toggle.trigger('click');
    expect(localStorage.getItem(COLLAPSED_KEY)).toBeNull();
    expect(w.get('[data-testid=theme-live-preview-toggle]').attributes('aria-expanded')).toBe('true');
  });
  it('stills the preview below the Full animation level only', async () => {
    freshPinia();
    const w = mount(ThemeLivePreview);
    expect(w.get('section').classes()).not.toContain('still');
    setAnimationSetting('reduced');
    await w.vm.$nextTick();
    expect(w.get('section').classes()).toContain('still');
  });
});
