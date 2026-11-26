import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { providePreview } from '@/composables/usePreview';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import EventItem from '@/features/calendar/EventItem.vue';
import TaskListCard from '@/features/tasklists/TaskListCard.vue';
import { registerItemRenderer } from '@/extensions/registry';
import ThemeLivePreview from '@/components/settings/ThemeLivePreview.vue';
import {
  COLLAPSED_KEY, SAMPLE_DAYS, previewScale, readCollapsed, sampleSegmentsOf, writeCollapsed,
} from '@/components/settings/themeLivePreviewSample';
import { setAnimationSetting } from '@/motion/level';
import { freshPinia } from './helpers';

beforeEach(() => { localStorage.clear(); setAnimationSetting('full'); registerItemRenderer('event', EventItem); registerItemRenderer('tasklist', TaskListCard); });
afterEach(() => { vi.unstubAllGlobals(); });

const mountPreview = () => mount(ThemeLivePreview, { global: { plugins: [createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })] } });

describe('live preview sample data', () => {
  it('has timed events in different colours and one task list with ticked and open items, all in the future', () => {
    const segs = SAMPLE_DAYS.flatMap((d) => sampleSegmentsOf(d, (k) => k));
    const events = segs.filter((s) => s.item.kind === 'event');
    expect(new Set(events.map((s) => (s.item as { color: string }).color)).size).toBe(events.length);
    const lists = segs.filter((s) => s.item.kind === 'tasklist');
    expect(lists).toHaveLength(1);
    const l = lists[0].item as { items: { done: boolean }[]; doneCount: number; totalCount: number };
    expect(l.items.some((i) => i.done) && l.items.some((i) => !i.done)).toBe(true);
    expect(`${l.doneCount}/${l.totalCount}`).toBe('2/3');
    for (const s of segs) expect(s.date > '2029-12-31').toBe(true);
  });
  it('builds a timed block segment through the real item rules', () => {
    const s = sampleSegmentsOf(SAMPLE_DAYS[0], (k) => k).find((x) => x.item.id === 'p1')!;
    expect(s).toMatchObject({ allDay: false, startMin: 450, endMin: 540, first: true, last: true });
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
  it('draws the real top bar, week grid and task list card with sample data and no network call', () => {
    freshPinia();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const w = mountPreview();
    expect(w.get('[data-testid=theme-live-preview]').attributes('data-collapsed')).toBe('false');
    expect(w.find('[data-testid=top-bar]').exists()).toBe(true);
    expect(w.find('[data-testid=time-axis]').exists()).toBe(true);
    expect(w.findAll('[data-testid=week-header]')).toHaveLength(SAMPLE_DAYS.length);
    expect(w.findAll('[data-testid=event-chip]')).toHaveLength(5);
    expect(w.get('[data-testid=tasklist-card-count]').text()).toBe('2/3');
    expect(w.get('.scaled').attributes('inert')).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('collapses to the top bar strip, remembers it and expands again', async () => {
    freshPinia();
    const w = mountPreview();
    const toggle = w.get('[data-testid=theme-live-preview-toggle]');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    await toggle.trigger('click');
    expect(w.get('[data-testid=theme-live-preview]').attributes('data-collapsed')).toBe('true');
    expect(w.find('[data-testid=time-grid]').exists()).toBe(false);
    expect(w.find('[data-testid=top-bar]').exists()).toBe(true);
    expect(localStorage.getItem(COLLAPSED_KEY)).toBe('1');
    // a new mount (another visit, same device) starts collapsed
    const again = mountPreview();
    expect(again.get('[data-testid=theme-live-preview]').attributes('data-collapsed')).toBe('true');
    await toggle.trigger('click');
    expect(localStorage.getItem(COLLAPSED_KEY)).toBeNull();
    expect(w.get('[data-testid=theme-live-preview-toggle]').attributes('aria-expanded')).toBe('true');
  });
  it('stills the preview below the Full animation level only', async () => {
    freshPinia();
    const w = mountPreview();
    expect(w.get('.frame').classes()).not.toContain('still');
    setAnimationSetting('reduced');
    await w.vm.$nextTick();
    expect(w.get('.frame').classes()).toContain('still');
  });
});

describe('a pill inside a preview', () => {
  it('opens nothing and lets the tap reach the surrounding tile', async () => {
    freshPinia();
    const seg = sampleSegmentsOf(SAMPLE_DAYS[0], (k) => k).find((x) => x.item.id === 'p1')!;
    const tile = vi.fn();
    const Host = defineComponent({ setup() { providePreview(true); return () => h('div', { onClick: tile }, [h(EventItem, { segment: seg, variant: 'chip' })]); } });
    const w = mount(Host);
    await w.get('[data-testid=event-chip]').trigger('click');
    expect(tile).toHaveBeenCalledTimes(1);
    expect(w.findComponent(EventItem).emitted('open')).toBeUndefined();
  });
});
