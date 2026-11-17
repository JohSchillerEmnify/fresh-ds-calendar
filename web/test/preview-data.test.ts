/** Without sample data (`PreviewData`) the top bar, the week grid and the day segments are the real calendar's, as before. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent, h } from 'vue';
import AppTopBar from '@/components/shell/AppTopBar.vue';
import TimeGrid from '@/components/calendar/TimeGrid.vue';
import EventItem from '@/features/calendar/EventItem.vue';
import { registerItemRenderer } from '@/extensions/registry';
import { BUTTERFLY_RHYTHM } from '@/features/motivation/butterflyVisits';
import { useSceneVisits } from '@/features/motivation/useSceneVisits';
import { useDaySegments } from '@/composables/useDaySegments';
import { providePreview } from '@/composables/usePreview';
import { itemSegments } from '@/lib/items';
import { sampleSegmentsOf } from '@/components/settings/themeLivePreviewSample';
import { useItemsStore } from '@/stores/items';
import { useCalendarStore } from '@/stores/calendar';
import { DEFAULT_PREF, resolveTheme } from '@/theme/presets';
import { freshPinia } from './helpers';
import type { CalendarEvent } from '@/api/types';

const real: CalendarEvent = {
  kind: 'event', id: 'real', calendarId: 'primary', title: 'Dentist', description: '', location: '', allDay: false,
  start: '2026-10-12T09:00:00+02:00', end: '2026-10-12T10:00:00+02:00', colorId: null, color: '#1a73e8', etag: 'e', updated: 'x', reminders: { useDefault: true, minutes: [] },
};
const router = () => createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] });
const sample = { segments: (d: string) => sampleSegmentsOf(d, (k) => k), theme: resolveTheme(DEFAULT_PREF, '2026-10-12', {}), dark: false, still: true, gridStart: 420 };
/** Mounts `comp` under a parent that provides (or not) the sample data. */
const under = (comp: unknown, withSample: boolean, props: object = {}) => mount(defineComponent({
  setup() { if (withSample) providePreview(true, sample); return () => h(comp as never, props); },
}), { global: { plugins: [router()] } });

beforeEach(() => { freshPinia(); registerItemRenderer('event', EventItem); });

describe('without PreviewData', () => {
  it('the day segments are the person\'s items', () => {
    useItemsStore().upsert(real);
    let of: ReturnType<typeof useDaySegments> = () => [];
    mount(defineComponent({ setup() { of = useDaySegments(); return () => null; } }), { global: { plugins: [router()] } });
    expect(of('2026-10-12').map((s) => s.item.id)).toEqual(['real']);
    expect(of('2030-01-07')).toEqual([]);
  });
  it('the week grid draws the person\'s events, not the sample', () => {
    useItemsStore().upsert(real);
    const w = under(TimeGrid, false, { mode: 'week', dates: [new Date('2026-10-12T12:00:00')] });
    expect(w.findAll('[data-testid=event-chip]').map((e) => e.attributes('data-title'))).toEqual(['Dentist']);
    const s = under(TimeGrid, true, { mode: 'week', dates: [new Date('2030-01-07T12:00:00')] });
    expect(s.find('[data-title=Dentist]').exists()).toBe(false);
    expect(s.findAll('[data-testid=event-chip]').length).toBeGreaterThan(0);
  });
  it('the top bar shows the status widgets; a sample has none', () => {
    const cal = useCalendarStore();
    const w = under(AppTopBar, false);
    expect(w.get('[data-testid=period-title]').text()).toBe(cal.shortTitle || cal.title);
    expect(w.find('.widgets').exists()).toBe(true);
    const s = under(AppTopBar, true);
    expect(s.find('.widgets').exists()).toBe(false);
  });
  it('itemSegments of the sample are the real segments', () => {
    expect(itemSegments(real)[0].date).toBe('2026-10-12');
  });
});

describe('scene visitors', () => {
  afterEach(() => { vi.useRealTimers(); });
  const visits = (withSample: boolean, still: boolean) => {
    vi.useFakeTimers();
    let starts = 0;
    const child = defineComponent({ setup() { useSceneVisits(BUTTERFLY_RHYTHM, () => { starts++; return {}; }); return () => null; } });
    mount(defineComponent({ setup() { if (withSample) providePreview(true, { ...sample, still }); return () => h(child); } }));
    vi.advanceTimersByTime(10 * 60_000);
    return starts;
  };
  it('come in the real bar and in a moving sample, never in a still one', () => {
    expect(visits(false, false)).toBeGreaterThan(0);
    expect(visits(true, false)).toBeGreaterThan(0);
    expect(visits(true, true)).toBe(0);
  });
});
