<script setup lang="ts">
/**
 * Labs horizontal view: time runs left to right. The week has one row per day with the hours as columns and lanes for
 * overlapping entries (feature horizontal-time); zooming the days shows a few of them. The route opts out of the
 * shell's swipe navigation (`meta.noSwipe`), so a sideways drag only pans the time. Time (pixels per hour) and the day height zoom
 * independently; the surface pans sideways and down. It is the zoom month's world: laid out once per committed zoom, moved by
 * a CSS transform while a gesture runs (`zoomGestures.ts`), with the sticky hour axis and day labels following the same
 * transform on their own axis. Entries are the calendar's own components (`ItemView`: events, `TaskListCard`).
 */
import Pressable from '@/components/m3/Pressable.vue';
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, ref, shallowRef, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useRoute, useRouter } from 'vue-router';
import { addDays } from 'date-fns';
import ItemView from '@/components/calendar/ItemView.vue';
import { useDaySegments } from '@/composables/useDaySegments';
import { useLoadDays } from '../useLoadDays';
import { parseIsoDate, periodTitle, routePath, toIsoDate, weekdayLabels, weekDays } from '@/lib/dates';
import type { Segment } from '@/lib/items';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { usePrefsStore } from '@/stores/prefs';
import { t } from '@/i18n';
import { createZoomController } from '../zoom/zoomGestures';
import {
  DEFAULT_ZOOM, hourStep, horizontalModel, layoutRows, MAX_ZX, MAX_ZY, MIN_ZX, MIN_ZY, panToHour, pxPerHour, readStoredHZoom, START_HOUR, stepAxis,
  writeStoredHZoom,
} from './htime';

const route = useRoute();
const router = useRouter();
const cal = useCalendarStore();
const clock = useClockStore();
const prefs = usePrefsStore();

const anchorDate = computed(() => parseIsoDate(route.params.param as string) ?? clock.todayDate);
const days = computed(() => weekDays(anchorDate.value));
// The removed day mode: an old `?mode=day` link shows the week.
watch(() => route.query.mode, (m) => { if (m !== undefined) void router.replace({ path: route.path, query: { ...route.query, mode: undefined } }); }, { immediate: true });

const port = ref<HTMLElement | null>(null);
const world = ref<HTMLElement | null>(null);
const axis = ref<HTMLElement | null>(null);
const labels = ref<HTMLElement | null>(null);
// Border box of a viewport that fills the space the shell gives it: independent of the content, so no measuring loop.
const { width: vw, height: vh } = useElementSize(port, undefined, { box: 'border-box' });

const zoom = shallowRef(readStoredHZoom() ?? DEFAULT_ZOOM);

/** Segments of one day without hidden calendars, filters applied; multi-day events show on each of their days. */
const segsOf = useDaySegments({ withSpans: true });
const dayList = computed(() => days.value.map((d) => ({ date: toIsoDate(d), segs: segsOf(toIsoDate(d)) })));
const layoutAt = (z: { x: number; y: number }) => layoutRows(dayList.value, vw.value, vh.value, z, prefs.minEventMinutes);
const layout = computed(() => layoutAt(zoom.value));
const pph = computed(() => pxPerHour(vw.value, zoom.value.x));
const hours = computed(() => { const s = hourStep(pph.value); return Array.from({ length: Math.ceil(24 / s) }, (_, i) => i * s); });

/** Selector of the card parts that stay readable at the viewport's left edge (the card variants' titles and heads). */
const STICKY = '.ev > .title, .tl > .row, .item > .title, .item > .head';
/** The sticky parts per card with the margin written last (the inline style is the cache: a write only when it changes). */
type Sticky = { card: HTMLElement; parts: { el: HTMLElement; ml: number }[] };
let sticky: Sticky[] | null = null;
let stick = 0;
/**
 * Pins the titles to the viewport's left edge: margin-left = clamp(0, stick - card left, room), written per element only when it
 * changes. A CSS variable on the world would restyle every element below it on each frame (it inherits); this touches a few titles.
 */
function pinTitles(): void {
  if (!world.value) return;
  sticky ??= Array.from(world.value.querySelectorAll<HTMLElement>('.card'), (card) => ({
    card, parts: Array.from(card.querySelectorAll<HTMLElement>(STICKY), (el) => ({ el, ml: 0 })),
  }));
  for (const { card, parts } of sticky) {
    const cl = parseFloat(card.style.left) || 0;
    const room = Math.max(0, (parseFloat(card.style.width) || 0) - 56);
    const ml = Math.min(room, Math.max(0, stick - cl));
    for (const p of parts) if (p.ml !== ml) { p.ml = ml; p.el.style.marginLeft = `${ml}px`; }
  }
}
// Cards and their parts come and go with renders (also of the child components): the list is rebuilt and the titles re-pinned.
let mo: MutationObserver | null = null;
const repin = (): void => { sticky = null; pinTitles(); };
onMounted(() => { if (world.value) { mo = new MutationObserver(repin); mo.observe(world.value, { childList: true, subtree: true }); } });
onBeforeUnmount(() => mo?.disconnect());
onUpdated(repin);

/** Applies pan and live scale to the world, the hour axis (x only) and the day labels (y only); no layout. */
function applyTransform(x: number, y: number, kx: number, ky: number): void {
  if (world.value) {
    world.value.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${kx}, ${ky})`;
  }
  // the viewport's left edge in world pixels: card titles are pinned to it (no Vue render per frame)
  stick = -x / kx;
  pinTitles();
  if (axis.value) axis.value.style.transform = `translateX(${x}px) scaleX(${kx})`;
  if (labels.value) labels.value.style.transform = `translateY(${y}px) scaleY(${ky})`;
}
const ctl = createZoomController({ z: zoom.value, x: 0, y: 0 }, {
  size: () => ({ w: vw.value, h: vh.value }),
  origin: () => { const r = port.value?.getBoundingClientRect(); return { x: r?.left ?? 0, y: r?.top ?? 0 }; },
  live: (x, y, kx, ky) => { applyTransform(x, y, kx, ky); },
  commit: (nz, x, y) => {
    zoom.value = nz;
    applyTransform(x, y, 1, 1);
    // a grown task list card follows its card to the new place (it listens to resize)
    window.dispatchEvent(new Event('resize'));
    writeStoredHZoom(nz);
  },
}, horizontalModel((z) => layoutAt(z).height));

/** Starts at 06:00 (or the stored pan) once the viewport is measured. */
let placed = false;
function place(): void {
  const z = ctl.state().z;
  const p = panToHour(START_HOUR, vw.value, vh.value, z, layoutAt(z).height);
  ctl.set(z, p.x, p.y);
}
watch([vw, vh], ([w, h]) => {
  if (!(w > 0 && h > 0)) return;
  if (!placed) { placed = true; place(); return; }
  const s = ctl.state();
  ctl.set(s.z, s.x, s.y);
});
// Another week lays out new rows; the pan is kept inside the new world.
watch(() => toIsoDate(anchorDate.value), async () => {
  await nextTick();
  const s = ctl.state();
  ctl.set(s.z, s.x, s.y);
});

useLoadDays(days);
let unbind: (() => void) | null = null;
onMounted(() => { if (port.value) unbind = ctl.bind(port.value); });
onBeforeUnmount(() => { unbind?.(); });

const nowX = computed(() => (clock.minutesNow / 60) * pph.value);
const today = computed(() => clock.today);
const dayLabel = (iso: string): { wd: string; num: string } => {
  const d = parseIsoDate(iso)!;
  return { wd: weekdayLabels()[(d.getDay() + 6) % 7], num: String(d.getDate()) };
};
const variantOf = (s: Segment) => (s.allDay || s.startTime === null ? (s.allDay ? 'allday' : s.item.kind === 'tasklist' ? 'card' : 'chip') : 'block');

/** Opens the real day view (the Labs navigation helper would stay on this Labs view). */
function openDay(iso: string): void {
  const d = parseIsoDate(iso)!;
  cal.setFocus(d);
  void router.push({ path: routePath('day', d), query: {} });
}

const zoomAxis = (axisName: 'x' | 'y', dir: 1 | -1) => ctl.zoomTo(stepAxis(zoom.value, axisName, dir), vw.value / 2, vh.value / 2);
const shift = (dir: 1 | -1) => router.replace({ path: `/horizontal/${toIsoDate(addDays(anchorDate.value, dir * 7))}`, query: route.query });
const title = computed(() => periodTitle('week', anchorDate.value));
const atMin = (a: 'x' | 'y') => (a === 'x' ? zoom.value.x <= MIN_ZX : zoom.value.y <= MIN_ZY);
const atMax = (a: 'x' | 'y') => (a === 'x' ? zoom.value.x >= MAX_ZX : zoom.value.y >= MAX_ZY);
</script>

<template>
  <section class="ht-view" data-testid="htime-view" :data-zoom-x="zoom.x.toFixed(2)" :data-zoom-y="zoom.y.toFixed(2)">
    <header class="bar">
      <Pressable type="button" class="btn icon" data-testid="htime-prev" :aria-label="t('calendar.topBar.previous')" @click="shift(-1)">‹</Pressable>
      <span class="title" data-testid="htime-title">{{ title }}</span>
      <Pressable type="button" class="btn icon" data-testid="htime-next" :aria-label="t('calendar.topBar.next')" @click="shift(1)">›</Pressable>
      <span class="grp">
        <Pressable type="button" class="btn icon" data-testid="htime-time-out" :aria-label="t('horizontal.timeOut')" :disabled="atMin('x')" @click="zoomAxis('x', -1)">↔−</Pressable>
        <Pressable type="button" class="btn icon" data-testid="htime-time-in" :aria-label="t('horizontal.timeIn')" :disabled="atMax('x')" @click="zoomAxis('x', 1)">↔+</Pressable>
      </span>
      <span class="grp">
        <Pressable type="button" class="btn icon" data-testid="htime-day-out" :aria-label="t('horizontal.dayOut')" :disabled="atMin('y')" @click="zoomAxis('y', -1)">↕−</Pressable>
        <Pressable type="button" class="btn icon" data-testid="htime-day-in" :aria-label="t('horizontal.dayIn')" :disabled="atMax('y')" @click="zoomAxis('y', 1)">↕+</Pressable>
      </span>
    </header>
    <div class="frame">
      <div class="corner" />
      <div class="axis"><div ref="axis" class="axisin" :style="{ width: layout.width + 'px' }">
        <span v-for="h in hours" :key="h" class="hour" data-testid="htime-hour" :data-hour="h" :style="{ left: h * pph + 'px' }">{{ String(h).padStart(2, '0') }}:00</span>
      </div></div>
      <div class="labels"><div ref="labels" class="labelsin" :style="{ height: layout.height + 'px' }">
        <Pressable
          v-for="r in layout.rows" :key="r.date" type="button" class="dlabel" :class="{ today: r.date === today }" data-testid="htime-day-label" :data-date="r.date"
          :style="{ top: r.top + 'px', height: r.height + 'px' }" :aria-label="t('calendar.month.openDay', { date: r.date })" @click="openDay(r.date)"
        ><span class="wd">{{ dayLabel(r.date).wd }}</span><span class="dn">{{ dayLabel(r.date).num }}</span></Pressable>
      </div></div>
      <!-- the viewport: nothing scrolls natively, the controller moves the world with a transform (pinch needs touch-action: none) -->
      <div ref="port" class="port" data-testid="htime-port">
        <div ref="world" class="world" :style="{ width: layout.width + 'px', height: layout.height + 'px' }">
          <span v-for="h in 25" :key="h" class="vline" :style="{ left: (h - 1) * pph + 'px' }" />
          <div
            v-for="r in layout.rows" :key="r.date" class="row" :class="{ today: r.date === today }" data-testid="htime-row" :data-date="r.date" :data-count="r.cards.length"
            :style="{ top: r.top + 'px', height: r.height + 'px' }"
          >
            <div
              v-for="c in r.cards" :key="c.seg.item.id + c.seg.date" class="card" data-zoom-nopan
              :style="{ left: c.left + 'px', top: c.top + 'px', width: c.width + 'px', height: c.height + 'px' }"
            ><ItemView :segment="c.seg" :variant="variantOf(c.seg)" :height="c.height" /></div>
          </div>
          <div v-if="days.some((d) => toIsoDate(d) === today)" class="now" data-testid="htime-now" :style="{ left: nowX + 'px' }" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ht-view { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--md-sys-color-surface); }
.bar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 6px 12px; }
.title { flex: 1; min-width: 8ch; text-align: center; font: var(--md-sys-typescale-title-medium); color: var(--md-sys-color-on-surface); }
.grp { display: inline-flex; gap: 4px; }
.btn { border: 0; border-radius: var(--md-sys-shape-corner-full); padding: 6px 14px; cursor: pointer; font: var(--md-sys-typescale-label-large);
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.btn.on { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
.btn.icon { min-width: 36px; padding: 6px 8px; font-size: 14px; line-height: 1; }
.btn:disabled { opacity: 0.4; cursor: default; }
.frame { flex: 1; min-height: 0; display: grid; grid-template-columns: 44px minmax(0, 1fr); grid-template-rows: 22px minmax(0, 1fr); }
.axis, .labels { overflow: hidden; position: relative; }
.axisin, .labelsin { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.axisin { height: 22px; }
.labelsin { width: 44px; }
.hour { position: absolute; top: 0; padding-left: 3px; font: var(--md-sys-typescale-label-small); font-variant-numeric: tabular-nums; line-height: 22px; white-space: nowrap; color: var(--md-sys-color-on-surface-variant); }
.dlabel { position: absolute; left: 0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; padding: 0; border: 0;
  border-bottom: 1px solid var(--md-sys-color-outline-variant); background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); cursor: pointer; overflow: hidden; }
.wd { font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-on-surface-variant); }
.dn { font: var(--md-sys-typescale-label-large); }
.dlabel.today .dn { color: var(--md-sys-color-primary); font-weight: 700; }
.port { position: relative; min-height: 0; overflow: hidden; touch-action: none; overscroll-behavior: contain; border-top: 1px solid var(--md-sys-color-outline-variant); border-left: 1px solid var(--md-sys-color-outline-variant); }
.world { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.vline { position: absolute; top: 0; bottom: 0; width: 0; border-left: 1px solid var(--md-sys-color-outline-variant); opacity: 0.5; pointer-events: none; }
.row { position: absolute; left: 0; right: 0; box-sizing: border-box; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.row.today { background: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent); }
.card { position: absolute; box-sizing: border-box; padding: 0 1px 1px 0; display: flex; min-width: 0; }
.card > :deep(*) { flex: 1; min-width: 0; }
.now { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--md-sys-color-error); pointer-events: none; z-index: 3; }
</style>
