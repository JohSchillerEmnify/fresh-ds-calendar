<script setup lang="ts">
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { formatDate, toIsoDate, minutesToTime } from '@/lib/dates';
import { displayTitle, type Segment } from '@/lib/items';
import { openItem } from '@/extensions/registry';
import { openNew } from '@/extensions/create';
import { applyMove } from '@/features/calendar/dnd';
import { finishResize } from '@/features/calendar/resize';
import { nowCardModel } from '@/features/calendar/timeline';
import BedtimeDial from '@/features/bedtime/BedtimeDial.vue';
import { useCalendarStore } from '@/stores/calendar';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { clockSegments, clockText, focusWedge, SNAP_MIN, tappedTime } from './clock';
import { angleOf, arcPath, CENTER, clip, labelSizing, minuteAt, placeLabels, pointAt, radiusAt, sectorPath, VIEW } from './geometry';
import { useDialGesture } from './useDialGesture';
import { useTaskCategories } from '@/features/tasklists/categories';
import { t } from '@/i18n';

const cal = useCalendarStore();
const clock = useClockStore();
const items = useItemsStore();
const cals = useCalendarsStore();

const date = computed(() => toIsoDate(cal.anchor));
const dateLabel = computed(() => formatDate(cal.anchor, 'weekdayDayMonthLong'));

const segments = computed(() => (items.byDate.get(date.value) ?? []).filter((s) => !cals.isHidden(s.item.calendarId)));
const cats = useTaskCategories();
const split = computed(() => clockSegments(segments.value));

/** The dial is a square as large as the area below the date allows (owner, 2026-10-13). */
const area = ref<HTMLElement | null>(null);
const { width: areaW, height: areaH } = useElementSize(area);
const size = computed(() => Math.floor(Math.min(areaW.value, areaH.value > 0 ? areaH.value : areaW.value)));
const sizing = computed(() => labelSizing(size.value));
const VIEW_BOX = `${CENTER - VIEW / 2} ${CENTER - VIEW / 2} ${VIEW} ${VIEW}`;

const face = ref<SVGSVGElement | null>(null);
const { preview, selected, arcDown, handleDown } = useDialGesture(() => face.value);

const R_OUTER = 172;
const LANE_GAP = 17;
const ARC_W = 14;
/**
 * Timed events and task lists as arcs, overlapping ones on inner lanes; task lists thinner and dashed. The arc being
 * dragged is drawn where the preview puts it (lifted).
 */
const arcs = computed(() =>
  split.value.timed.map((s) => {
    const r = R_OUTER - 14 - s.lane * LANE_GAP;
    const tasklist = s.item.kind === 'tasklist';
    const key = `${s.item.id}-${s.date}`;
    const p = preview.value?.key === key ? preview.value : null;
    const startMin = p ? p.startMin : s.startMin, endMin = p ? p.endMin : s.endMin;
    const start = p ? minutesToTime(startMin) : s.startTime!, end = p ? minutesToTime(endMin % 1440) : s.endTime!;
    return {
      key, seg: s as Segment, kind: s.item.kind, title: displayTitle(s.item), text: clockText(s.item),
      start, end, startMin, endMin, color: cats.itemColor(s.item), mid: (startMin + endMin) / 2, r, d: arcPath(startMin, endMin, r),
      width: tasklist ? ARC_W / 2 : ARC_W, dash: tasklist ? '5 4' : undefined,
      done: s.item.kind === 'tasklist' && s.item.doneCount >= s.item.totalCount,
      lifted: !!p, selected: selected.value === key,
      aria: t('calendar.clock.arc', { title: clockText(s.item), start: s.startTime!, end: s.endTime! }),
    };
  }),
);
/** Handles at both ends of the selected arc (drag to change the start or the end). */
const handles = computed(() => {
  const a = arcs.value.find((x) => x.selected);
  if (!a) return [];
  return (['top', 'bottom'] as const).map((edge) => {
    const m = edge === 'top' ? a.startMin : a.endMin;
    return { key: `${a.key}-${edge}`, edge, arc: a, ...pointAt(m, a.r) };
  });
});
/** Radius the labels start from: inside the innermost lane. */
const rLabels = computed(() => (arcs.value.length ? Math.min(...arcs.value.map((a) => a.r)) : R_OUTER - 14) - 16);
/**
 * One label per arc, placed without overlaps (`placeLabels`): on the arc's angle, moved inwards until free, never over
 * the time in the middle; a label that fits nowhere is left out (its arc still opens on a tap and names itself).
 */
const labels = computed(() => {
  const { font, maxChars } = sizing.value;
  const inputs = [...arcs.value].sort((x, y) => (y.endMin - y.startMin) - (x.endMin - x.startMin))
    .map((a) => ({ key: a.key, mid: a.mid, text: clip(a.text, maxChars) }));
  const middle = isToday.value || dragTime.value ? [{ x0: CENTER - 95, y0: CENTER - 12, x1: CENTER + 95, y1: CENTER + 70 }] : [];
  const placed = new Map(placeLabels(inputs, font, rLabels.value, 40, middle).map((p) => [p.key, p]));
  return arcs.value.flatMap((a) => {
    const p = placed.get(a.key)!;
    if (!p.shown) return [];
    const from = pointAt(a.mid, a.r - 8);
    return [{ key: a.key, title: a.title, text: clip(a.text, maxChars), color: a.color, anchor: p.anchor, x: p.x, y: p.y, fx: from.x, fy: from.y }];
  });
});
/** Untimed task lists and all-day events: chips next to the dial (below/above it upright, beside it on a wide screen). */
const untimed = computed(() => split.value.untimed.map((s) => ({ key: s.item.id, item: s.item, text: clockText(s.item), color: cats.itemColor(s.item) })));
const allDay = computed(() => split.value.allDay.map((s) => ({ key: `${s.item.id}-${s.date}`, item: s.item, title: displayTitle(s.item), color: cats.itemColor(s.item) })));

const isToday = computed(() => date.value === clock.today);
/** Minutes of the day that have passed on the shown date. */
const elapsed = computed(() => (date.value < clock.today ? 1440 : isToday.value ? clock.minutesNow : 0));
const handTime = computed(() => minutesToTime(clock.minutesNow));
const progress = computed(() => (elapsed.value > 0 ? arcPath(0, elapsed.value, 205) : ''));
/** Today: what is running (and how long it has left) or what comes next, under the time; the Approaching card's text. */
const nowLine = computed(() => {
  if (!isToday.value) return null;
  const m = nowCardModel(segments.value, clock.minutesNow);
  return m.current ? { text: m.current.line, color: m.current.color } : { text: m.nextLine, color: null };
});
/** Today: the sector from the hand to the end of the running event or the start of the next one (time made visible). */
const wedge = computed(() => {
  if (!isToday.value) return null;
  const w = focusWedge(segments.value, clock.minutesNow);
  return w ? { ...w, d: sectorPath(w.from, w.to, R_OUTER - 6), end: minutesToTime(w.to % 1440) } : null;
});
/** While an arc is dragged, the middle shows where it would land. */
const dragTime = computed(() => (preview.value ? `${minutesToTime(preview.value.startMin)}–${minutesToTime(preview.value.endMin % 1440)}` : null));

/** A tap on the empty dial plate creates an entry at that time; with an arc selected it only clears the selection. */
function plateClick(e: MouseEvent) {
  if (selected.value) { selected.value = null; return; }
  const el = face.value, m = el?.getScreenCTM();
  if (!el || !m) return;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  if (radiusAt(p.x, p.y) < 56) return; // the middle holds the time and the lists
  openNew(date.value, tappedTime(minuteAt(p.x, p.y)));
}

/** Keyboard on a focused arc: Enter/Space open it, Alt+Arrow moves it, Alt+Shift+Arrow changes its end, by 15 minutes. */
function arcKey(e: KeyboardEvent, a: { seg: Segment }) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(a.seg.item); return; }
  const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
  if (!dir || !e.altKey) return;
  e.preventDefault();
  const step = dir * SNAP_MIN;
  if (e.shiftKey) { void finishResize(a.seg, 'bottom', step); return; }
  const start = a.seg.startMin + step;
  if (start < 0 || a.seg.endMin + step > 1440) return;
  void applyMove(a.seg, { date: a.seg.date, minutes: start }).catch(() => undefined);
}

const ticks = Array.from({ length: 24 }, (_, h) => ({ h, a: pointAt(h * 60, 178), b: pointAt(h * 60, h % 6 === 0 ? 170 : 174), label: h % 3 === 0 ? pointAt(h * 60, 190) : null }));
</script>

<template>
  <section class="clock" data-testid="clock-view" :data-date="date">
    <h2 class="date">{{ dateLabel }}</h2>
    <div class="layout">
    <ul v-if="allDay.length" class="chips allday-chips" data-testid="clock-allday-list">
      <li v-for="a in allDay" :key="a.key">
        <button type="button" class="chip" :style="{ '--c': a.color }" data-testid="clock-allday" :data-title="a.title" @click="openItem(a.item)">
          <span class="dot" />{{ a.title }}
        </button>
      </li>
    </ul>
    <div ref="area" class="area">
      <svg
        ref="face" class="face" :class="{ dragging: !!preview }" :viewBox="VIEW_BOX" role="img" :aria-label="t('calendar.clock.face', { date: dateLabel })"
        :style="size > 0 ? { width: `${size}px`, height: `${size}px` } : undefined"
      >
        <circle :cx="CENTER" :cy="CENTER" r="205" class="track" data-testid="clock-dial" />
        <path v-if="progress" :d="progress" class="progress deco" data-testid="clock-progress" />
        <circle :cx="CENTER" :cy="CENTER" r="178" class="plate" data-testid="clock-plate" @click="plateClick" />
        <BedtimeDial :date="date" class="deco" />
        <path
          v-if="wedge" :d="wedge.d" class="wedge" :fill="wedge.color" data-testid="clock-wedge" :data-to="wedge.end"
          :data-running="wedge.running ? 'true' : 'false'"
        />
        <g class="ticks deco">
          <line v-for="t in ticks" :key="t.h" :x1="t.a.x" :y1="t.a.y" :x2="t.b.x" :y2="t.b.y" :class="{ major: t.h % 6 === 0 }" />
        </g>
        <g class="labels deco">
          <template v-for="t in ticks" :key="t.h">
            <text v-if="t.label" :x="t.label.x" :y="t.label.y" text-anchor="middle" dominant-baseline="central">{{ String(t.h).padStart(2, '0') }}</text>
          </template>
        </g>
        <path
          v-for="a in arcs" :key="a.key" :d="a.d" class="arc" :class="{ done: a.done, lifted: a.lifted, selected: a.selected }" :stroke="a.color"
          :stroke-width="a.lifted ? a.width + 6 : a.width" :stroke-dasharray="a.dash" :stroke-linecap="a.dash ? 'butt' : 'round'"
          data-testid="clock-arc" :data-r="a.r" :data-kind="a.kind" :data-title="a.title" :data-start="a.start" :data-end="a.end"
          :data-selected="a.selected ? 'true' : undefined" :data-lifted="a.lifted ? 'true' : undefined"
        />
        <g v-if="isToday" class="hand deco" data-testid="clock-hand" :data-time="handTime" :transform="`rotate(${angleOf(clock.minutesNow)} ${CENTER} ${CENTER})`">
          <line :x1="CENTER" :y1="CENTER" :x2="CENTER" :y2="CENTER - (R_OUTER - 6)" />
          <circle :cx="CENTER" :cy="CENTER - (R_OUTER - 6)" r="5" />
        </g>
        <!-- wide invisible strokes take the pointer, so a thin arc is still easy to hit -->
        <path
          v-for="a in arcs" :key="`${a.key}-hit`" :d="a.d" class="hit" stroke-width="26" role="button" tabindex="0" :aria-label="a.aria"
          data-testid="clock-arc-hit" :data-title="a.title"
          @pointerdown="arcDown($event, a.seg, a.key)" @keydown="arcKey($event, a)"
        ><title>{{ a.text }} {{ a.start }}-{{ a.end }}</title></path>
        <g v-for="l in labels" :key="l.key" class="lbl" :style="{ fontSize: `${sizing.font}px` }">
          <line :x1="l.fx" :y1="l.fy" :x2="l.x" :y2="l.y" :stroke="l.color" />
          <text
            :x="l.x" :y="l.y" :text-anchor="l.anchor" dominant-baseline="central" data-testid="clock-label" :data-title="l.title"
            @click="openItem(arcs.find((a) => a.key === l.key)!.seg.item)"
          >{{ l.text }}</text>
        </g>
        <g
          v-for="h in handles" :key="h.key" class="handle" role="slider" tabindex="0"
          :aria-label="t(h.edge === 'top' ? 'calendar.clock.handleStart' : 'calendar.clock.handleEnd')"
          :aria-valuetext="h.edge === 'top' ? h.arc.start : h.arc.end"
          data-testid="clock-handle" :data-edge="h.edge === 'top' ? 'start' : 'end'" :data-title="h.arc.title"
          @pointerdown="handleDown($event, h.arc.seg, h.arc.key, h.edge)"
          @keydown.alt.right.prevent="finishResize(h.arc.seg, h.edge, SNAP_MIN)" @keydown.alt.left.prevent="finishResize(h.arc.seg, h.edge, -SNAP_MIN)"
        >
          <circle :cx="h.x" :cy="h.y" r="16" class="handle-hit" />
          <circle :cx="h.x" :cy="h.y" r="8" class="handle-dot" :stroke="h.arc.color" />
        </g>
        <circle :cx="CENTER" :cy="CENTER" r="7" class="hub deco" />
        <text v-if="dragTime" :x="CENTER" :y="CENTER + 40" text-anchor="middle" class="now drag" data-testid="clock-drag-time">{{ dragTime }}</text>
        <template v-else-if="isToday">
          <text :x="CENTER" :y="CENTER + 34" text-anchor="middle" class="now">{{ handTime }}</text>
          <text
            v-if="nowLine" :x="CENTER" :y="CENTER + 56" text-anchor="middle" dominant-baseline="central" class="now-line"
            :style="{ fontSize: `${sizing.font}px` }" data-testid="clock-now-line"
          >{{ clip(nowLine.text, sizing.maxChars + 6) }}</text>
        </template>
      </svg>
    </div>
    <ul v-if="untimed.length" class="chips untimed-chips" data-testid="clock-untimed-list">
      <li v-for="u in untimed" :key="u.key">
        <button type="button" class="chip list" :style="{ '--c': u.color }" data-testid="clock-untimed" @click="openItem(u.item)">
          <span class="dot" />{{ u.text }}
        </button>
      </li>
    </ul>
    </div>
  </section>
</template>

<style scoped>
.clock { container-type: size; flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; padding: 4px 8px 8px; gap: 2px; overflow: hidden; }
.date { margin: 0; font: var(--md-sys-typescale-title-small); color: var(--md-sys-color-on-surface-variant); }
.layout { flex: 1; align-self: stretch; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 6px; }
.area { flex: 1; min-width: 0; min-height: 0; display: grid; place-items: center; overflow: hidden; }
.chips { list-style: none; margin: 0; padding: 0 4px; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-height: 30%; overflow-y: auto; flex: none; }
.chip {
  display: inline-flex; align-items: center; gap: 6px; max-width: 16em; min-height: 32px; padding: 4px 12px; border-radius: 16px;
  border: 1px solid var(--md-sys-color-outline-variant); background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface); font: var(--md-sys-typescale-label-large); cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.chip:hover, .chip:focus-visible { background: var(--md-sys-color-surface-container-high); outline: none; }
.chip .dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
.chip.list .dot { border-radius: 3px; }
/* wide screens: the chips go beside the dial */
@container (min-aspect-ratio: 5/4) {
  .layout { flex-direction: row; align-items: stretch; }
  .chips { flex-direction: column; flex-wrap: nowrap; align-items: flex-start; max-height: 100%; width: 12rem; justify-content: center; }
  .untimed-chips { order: 3; align-items: flex-end; }
}
.face { width: 100%; max-height: 100%; aspect-ratio: 1; }
.track { fill: none; stroke: var(--md-sys-color-surface-container-highest); stroke-width: 8; }
.progress { fill: none; stroke: var(--md-sys-color-primary); stroke-width: 8; stroke-linecap: round; }
.plate { fill: var(--md-sys-color-surface-container-low); stroke: var(--md-sys-color-outline-variant); stroke-width: 1; }
.ticks line { stroke: var(--md-sys-color-outline); stroke-width: 1; }
.ticks line.major { stroke: var(--md-sys-color-on-surface-variant); stroke-width: 2; }
.labels text { font: 500 11px var(--md-ref-typeface-plain, system-ui); fill: var(--md-sys-color-on-surface-variant); }
.face { touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.face.dragging { cursor: grabbing; }
.deco { pointer-events: none; }
.plate { cursor: copy; }
.wedge { opacity: 0.16; pointer-events: none; }
.arc { fill: none; opacity: 0.92; pointer-events: none; transition: stroke-width 120ms ease; }
.arc.done { opacity: 0.45; }
.arc.lifted { opacity: 1; filter: drop-shadow(0 2px 4px rgb(0 0 0 / 0.35)); }
.arc.selected { opacity: 1; }
.hit { fill: none; stroke: transparent; pointer-events: stroke; cursor: grab; outline: none; }
.hit:focus-visible { stroke: var(--md-sys-color-primary); stroke-opacity: 0.25; }
.handle { cursor: ew-resize; outline: none; touch-action: none; }
.handle-hit { fill: transparent; }
.handle-dot { fill: var(--md-sys-color-surface); stroke-width: 3; }
.handle:focus-visible .handle-dot { fill: var(--md-sys-color-primary-container); }
.now-line { font-family: var(--md-ref-typeface-plain, system-ui); font-weight: 600; fill: var(--md-sys-color-on-surface-variant); pointer-events: none; }
.now.drag { fill: var(--md-sys-color-primary); }
.hand line { stroke: var(--md-sys-color-tertiary); stroke-width: 3; stroke-linecap: round; }
.hand circle { fill: var(--md-sys-color-tertiary); }
.hub { fill: var(--md-sys-color-tertiary); stroke: var(--md-sys-color-surface); stroke-width: 2; }
.lbl line { stroke-width: 1; opacity: 0.7; }
.now, .now-line { paint-order: stroke; stroke: var(--md-sys-color-surface-container-low); stroke-width: 4px; stroke-linejoin: round; }
.lbl text { cursor: pointer; font-family: var(--md-ref-typeface-plain, system-ui); font-weight: 600; fill: var(--md-sys-color-on-surface); paint-order: stroke; stroke: var(--md-sys-color-surface-container-low); stroke-width: 3px; }
.now { font: 600 22px var(--md-ref-typeface-plain, system-ui); fill: var(--md-sys-color-on-surface); }
</style>
