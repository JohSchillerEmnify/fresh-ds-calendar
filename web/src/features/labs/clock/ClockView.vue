<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { addDays, formatDate, toIsoDate, minutesToTime } from '@/lib/dates';
import { displayTitle, neutralName, type Segment } from '@/lib/items';
import { openItem } from '@/extensions/registry';
import { openNew } from '@/extensions/create';
import { applyMove } from '@/features/calendar/dnd';
import { finishResize } from '@/features/calendar/resize';
import BedtimeDial from '@/features/bedtime/BedtimeDial.vue';
import { useCalendarStore } from '@/stores/calendar';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePrefsStore } from '@/stores/prefs';
import { clockFocus, clockMiddle, clockSegments, clockText, focusWedge, MIN_ARC_MIN, SNAP_MIN, tappedTime } from './clock';
import {
  alongArcLabel, alongHits, angleOf, arcPath, CENTER, clip, gapTrimmed, labelSizing, minuteAt, placeLabelsNear, pointAt, radiusAt, ringLayout, sectorPath, VIEW,
} from './geometry';
import { useDialGesture } from './useDialGesture';
import { useTaskCategories } from '@/features/tasklists/categories';
import { t } from '@/i18n';

/**
 * `classic`: names on the plate beside their arcs (labs-clock). `rings`: thick rings with each name written along its arc
 * (labs-clock-rings, a variant to compare).
 */
const props = withDefaults(defineProps<{ variant?: 'classic' | 'rings' }>(), { variant: 'classic' });
/** Prefix of the ids the along-ring names' paths get, so two clocks on one page never share an id. */
const uid = useId();

const cal = useCalendarStore();
const prefs = usePrefsStore();
const clock = useClockStore();
const items = useItemsStore();
const cals = useCalendarsStore();

const date = computed(() => toIsoDate(cal.anchor));
const dateLabel = computed(() => formatDate(cal.anchor, 'weekdayDayMonthLong'));

const visibleOn = (d: string) => (items.byDate.get(d) ?? []).filter((s) => !cals.isHidden(s.item.calendarId));
const segments = computed(() => visibleOn(date.value));
const tomorrow = computed(() => toIsoDate(addDays(cal.anchor, 1)));
const cats = useTaskCategories();
const split = computed(() => clockSegments(segments.value, prefs.minEventMinutes, props.variant === 'rings' ? nameRoom : undefined));

/**
 * The dial is a square as large as the space allows (owner, 2026-10-13). On a wide screen the chips stand beside it and
 * it takes the area between them; stacked (a phone), it takes what the chips above and below leave, and dial and chips
 * are centred together, so the chips sit right at the dial instead of at the screen's edges.
 */
const root = ref<HTMLElement | null>(null);
const layout = ref<HTMLElement | null>(null);
const area = ref<HTMLElement | null>(null);
const topChips = ref<HTMLElement | null>(null);
const bottomChips = ref<HTMLElement | null>(null);
const { width: rootW, height: rootH } = useElementSize(root);
const { width: layoutW, height: layoutH } = useElementSize(layout);
const { width: areaW, height: areaH } = useElementSize(area);
const { height: topH } = useElementSize(topChips, undefined, { box: 'border-box' });
const { height: bottomH } = useElementSize(bottomChips, undefined, { box: 'border-box' });
/** Mirrors the stylesheet's `@container (min-aspect-ratio: 5/4)`: chips beside the dial. */
const wide = computed(() => rootH.value > 0 && rootW.value / rootH.value >= 5 / 4);
/** The dial's size when the chips below it take `below` pixels (stacked layouts). */
const sizeWith = (below: number) => {
  if (wide.value) return Math.floor(Math.min(areaW.value, areaH.value > 0 ? areaH.value : areaW.value));
  const gaps = 6 * ((topChips.value ? 1 : 0) + (below > 0 ? 1 : 0));
  const h = layoutH.value - (topChips.value ? topH.value : 0) - below - gaps;
  return Math.max(0, Math.floor(Math.min(layoutW.value, h > 0 ? h : layoutW.value)));
};
const size = computed(() => sizeWith(bottomChips.value ? bottomH.value : 0));
/**
 * Name sizes follow the dial's size *without* the chips below it: those chips list the names that found no room, so
 * sizing names by the final size would let the list and the dial resize each other back and forth.
 */
const sizing = computed(() => labelSizing(sizeWith(0)));
const VIEW_BOX = `${CENTER - VIEW / 2} ${CENTER - VIEW / 2} ${VIEW} ${VIEW}`;

const face = ref<SVGSVGElement | null>(null);
const { preview, selected, arcDown, handleDown } = useDialGesture(() => face.value);

const R_OUTER = 172;
/** Gap between two rings and between two arcs that meet on one ring, in viewBox units. */
const GAP = 4;
/**
 * Ring sizes per variant: the classic clock keeps the plate free for names, the rings variant writes in the bands. The
 * narrowest band caps the number of rings; entries beyond them are only listed next to the dial.
 */
const RINGS = {
  classic: { outer: 158, inner: 96, step: 20, gap: GAP, minWidth: 8 },
  rings: { outer: 156, inner: 84, step: 28, gap: GAP, minWidth: 16 },
} as const;
/** Rings variant: an entry's name (up to 16 characters) needs this many minutes of the outer ring before the next entry. */
const nameRoom = (s: Segment) => (Math.min(16, clockText(s.item).length) * 0.56 * sizing.value.font + sizing.value.font) / (2 * Math.PI * RINGS.rings.outer) * 1440;
const ring = computed(() => ringLayout(Math.max(1, ...split.value.timed.map((s) => s.lane + 1)), RINGS[props.variant]));
/**
 * Timed events and task lists at rest, as arcs on their rings (overlapping ones further in), square-ended and trimmed
 * by the gap so neighbours on a ring stay apart; task lists thinner and dashed (a short one, where dashes would hide it,
 * solid). Names are placed from these, so a drag or a selection never moves them.
 */
const resting = computed(() =>
  split.value.timed.filter((s) => s.lane < ring.value.shown).map((s) => {
    const r = ring.value.r(s.lane), w = ring.value.width;
    const tasklist = s.item.kind === 'tasklist';
    const drawn = gapTrimmed(s.drawStart, s.drawEnd, r, GAP);
    return {
      key: `${s.item.id}-${s.date}`, seg: s as Segment, kind: s.item.kind, title: neutralName(s.item), text: clockText(s.item),
      start: s.startTime!, end: s.endTime!, startMin: s.startMin, endMin: s.endMin, color: cats.itemColor(s.item),
      r, w: tasklist && props.variant === 'classic' ? w / 2 : w, from: drawn.from, to: drawn.to, lane: s.lane, list: tasklist,
      done: s.item.kind === 'tasklist' && s.item.doneCount >= s.item.totalCount,
      aria: t('calendar.clock.arc', { title: clockText(s.item), start: s.startTime!, end: s.endTime! }),
    };
  }),
);
/** Entries on rings beyond the narrowest band: no arc, only listed next to the dial. */
const unringed = computed(() => split.value.timed.filter((s) => s.lane >= ring.value.shown));
/** The arcs as drawn: the dragged one where the preview puts it (lifted, by the same minimum-length rule), the selected one marked. */
const arcs = computed(() =>
  resting.value.map((a) => {
    const p = preview.value?.key === a.key ? preview.value : null;
    let { from, to } = a;
    if (p) {
      const len = Math.max(p.endMin - p.startMin, prefs.minEventMinutes, MIN_ARC_MIN);
      const end = Math.min(1440, p.startMin + len);
      ({ from, to } = gapTrimmed(Math.min(p.startMin, end - len), end, a.r, GAP));
    }
    return {
      ...a, from, to, d: arcPath(from, to, a.r),
      start: p ? minutesToTime(p.startMin) : a.start, end: p ? minutesToTime(p.endMin % 1440) : a.end,
      startMin: p ? p.startMin : a.startMin, endMin: p ? p.endMin : a.endMin,
      edge: props.variant === 'rings' ? arcPath(from, to, a.r + a.w / 2 - 1.5) : undefined,
      dash: a.list && props.variant === 'classic' && (p ? p.endMin - p.startMin : a.endMin - a.startMin) >= 30 ? '5 4' : undefined,
      lifted: !!p, selected: selected.value === a.key,
    };
  }),
);
/** Faint full circles under the rings in use (rings variant), so the rings read as lanes. */
const tracks = computed(() => (props.variant === 'rings' ? [...new Set(resting.value.map((a) => a.lane))].map((l) => ring.value.r(l)) : []));
/**
 * Handles at both drawn ends of the selected arc (drag to change the start or the end): on a short entry drawn longer
 * than it lasts they stay apart; a drag changes the real time by the distance moved.
 */
const handles = computed(() => {
  const a = arcs.value.find((x) => x.selected);
  if (!a) return [];
  return (['top', 'bottom'] as const).map((edge) => ({ key: `${a.key}-${edge}`, edge, arc: a, ...pointAt(edge === 'top' ? a.from : a.to, a.r) }));
});
const middleRect = (halfW: number, y0: number, y1: number) => ({ x0: CENTER - halfW - 4, y0, x1: CENTER + halfW + 4, y1 });
/** Where the dragged arc's times stand in the middle while it moves ("HH:MM–HH:MM", 22 units, ~0.6 em per character). */
const DRAG_BOX = middleRect((11 * 0.6 * 22) / 2, CENTER + 18, CENTER + 46);
/** What names keep clear of in the middle: the hub, and today the time and the lines under it. */
const middleBox = computed(() => {
  const { font } = sizing.value;
  const box = middleRect;
  const keep = [box(10, CENTER - 10, CENTER + 10)];
  if (!isToday.value) return keep;
  const m = middle.value;
  const lines = [m ? m.first : '', m?.when ?? ''].map((text, i) => box((text.length * 0.56 * font) / 2, lineY(i) - font * 0.7, lineY(i) + font * 0.7));
  return [...keep, box((5 * 0.6 * 22) / 2, CENTER + 14, CENTER + 40), ...lines];
});
/**
 * Classic: each arc's name on the plate beside its arc (`placeLabelsNear`), shorter arcs first, never over another name,
 * an arc or the middle. Rings: each name along its ring, never into the middle. A name with no room is listed next to
 * the dial. Placed from the resting arcs only.
 */
const named = computed(() => {
  const { font, maxChars } = sizing.value;
  const all = resting.value;
  if (props.variant === 'rings') {
    const f = Math.min(font, ring.value.width * 0.62);
    return all.map((a) => {
      // the name may run on along its ring up to the next arc there (half the dial at most)
      const next = all.filter((o) => o.lane === a.lane && o !== a).map((o) => (o.from > a.from ? o.from : o.from + 1440));
      const l = alongArcLabel(a.from, Math.min(a.from + 720, ...next), a.r, f, a.text);
      const shown = !!l.text && !alongHits(a.from, l.textTo, a.r, f, middleBox.value);
      return { a, shown, along: { ...l, font: f }, near: undefined };
    });
  }
  const bands = all.map((a) => ({ key: a.key, from: a.from, to: a.to, r: a.r, w: a.w }));
  // short arcs first: they have the fewest places beside them, long ones can move along themselves
  const order = [...all].sort((x, y) => (x.to - x.from) - (y.to - y.from) || x.from - y.from);
  const placed = new Map(placeLabelsNear(
    order.map((a) => ({ key: a.key, from: a.from, to: a.to, r: a.r, w: a.w, text: clip(a.text, maxChars) })),
    bands, { font, plate: 176, keepOut: middleBox.value },
  ).map((p) => [p.key, p]));
  return all.map((a) => ({ a, shown: placed.get(a.key)!.shown, near: placed.get(a.key)!, along: undefined }));
});
/**
 * Names on the plate (classic variant). While an arc moves its own name hides, and so does any name under the dragged
 * times in the middle; the others stay where they are.
 */
const underDrag = (b: { x0: number; y0: number; x1: number; y1: number }) => b.x0 < DRAG_BOX.x1 && DRAG_BOX.x0 < b.x1 && b.y0 < DRAG_BOX.y1 && DRAG_BOX.y0 < b.y1;
const labels = computed(() => named.value.flatMap(({ a, shown, near }) => (shown && near && preview.value?.key !== a.key && !(preview.value && underDrag(near.box))
  ? [{ key: a.key, title: a.title, text: near.text, color: a.color, anchor: near.anchor, x: near.x, y: near.y, fx: near.fx, fy: near.fy }]
  : [])));
/** Names along the rings (rings variant); while an arc moves, its own name and any under the dragged times hide. */
const alongLabels = computed(() => named.value.flatMap(({ a, shown, along }) => (shown && along && preview.value?.key !== a.key
  && !(preview.value && alongHits(a.from, along.textTo, a.r, along.font, [DRAG_BOX]))
  ? [{ key: a.key, title: a.title, text: along.text, d: along.d, font: along.font, offset: along.offset, anchor: along.anchor }]
  : [])));
/** Entries whose name found no room on the dial (or that have no ring): listed next to it with their time, in time order. */
const overflow = computed(() => [
  ...named.value.filter((n) => !n.shown).map(({ a }) => ({ key: a.key, title: a.title, start: a.start, startMin: a.startMin, text: a.text, color: a.color, item: a.seg.item })),
  ...unringed.value.map((s) => ({ key: `${s.item.id}-${s.date}`, title: neutralName(s.item), start: s.startTime!, startMin: s.startMin, text: clockText(s.item), color: cats.itemColor(s.item), item: s.item })),
].sort((x, y) => x.startMin - y.startMin).map((o) => ({ ...o, text: `${o.start} ${o.text}` })));
/** Untimed task lists and all-day events: chips next to the dial (below/above it upright, beside it on a wide screen). */
const untimed = computed(() => split.value.untimed.map((s) => ({ key: s.item.id, item: s.item, text: clockText(s.item), color: cats.itemColor(s.item) })));
const allDay = computed(() => split.value.allDay.map((s) => ({ key: `${s.item.id}-${s.date}`, item: s.item, title: neutralName(s.item), color: cats.itemColor(s.item) })));

const isToday = computed(() => date.value === clock.today);
/** Minutes of the day that have passed on the shown date. */
const elapsed = computed(() => (date.value < clock.today ? 1440 : isToday.value ? clock.minutesNow : 0));
const handTime = computed(() => minutesToTime(clock.minutesNow));
const progress = computed(() => (elapsed.value > 0 ? arcPath(0, elapsed.value, 205) : ''));
/** Some cached range holds tomorrow (the middle may name tomorrow's first entry). */
const tomorrowLoaded = computed(() => Object.values(items.ranges).some((r) => r.from <= tomorrow.value && tomorrow.value < r.to));
// Today tomorrow is loaded too, in the background, and again whenever the cache has dropped it.
watch([isToday, tomorrowLoaded, tomorrow], ([on, loaded, d]) => {
  if (on && !loaded) items.prefetch(d, toIsoDate(addDays(cal.anchor, 2)));
}, { immediate: true });
/** Baseline of the middle's n-th line under the time (0: the title, 1: when and how long until). */
const lineY = (n: number) => CENTER + 56 + n * sizing.value.font * 1.3;
/**
 * Today, under the time: the running or next entry's title (cut only when too long) over when and how long until, which
 * is never cut; or one line when nothing comes (owner, 2026-10-24).
 */
const middle = computed(() => {
  if (!isToday.value) return null;
  const m = clockMiddle(clockFocus(segments.value, visibleOn(tomorrow.value), clock.minutesNow), clock.nowTick, clock.timeZone);
  return 'line' in m ? { first: m.line, when: null } : { first: clip(m.title, sizing.value.maxChars + 6), when: m.when };
});
/** Today: the sector from the hand to the end of the running entry or the start of the next one (time made visible). */
const wedge = computed(() => {
  if (!isToday.value) return null;
  const w = focusWedge(segments.value, clock.minutesNow, (s) => cats.itemColor(s.item));
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
  <section ref="root" class="clock" :class="[variant, { stacked: !wide }]" data-testid="clock-view" :data-date="date" :data-variant="variant"
    :data-tomorrow-loaded="isToday ? String(tomorrowLoaded) : undefined"
  >
    <h2 class="date">{{ dateLabel }}</h2>
    <div ref="layout" class="layout">
    <ul v-if="allDay.length" ref="topChips" class="chips allday-chips" data-testid="clock-allday-list">
      <li v-for="a in allDay" :key="a.key">
        <button type="button" class="chip" :style="{ '--c': a.color }" data-testid="clock-allday" :data-title="a.title" @click="openItem(a.item)">
          <span class="dot" />{{ a.title }}
        </button>
      </li>
    </ul>
    <div ref="area" class="area" :style="!wide && size > 0 ? { height: `${size}px` } : undefined">
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
        <circle v-for="r in tracks" :key="`track-${r}`" :cx="CENTER" :cy="CENTER" :r="r" class="ring-track deco" :stroke-width="ring.width" />
        <path
          v-for="a in arcs" :key="a.key" :d="a.d" class="arc" :class="{ done: a.done, lifted: a.lifted, selected: a.selected, list: a.list }" :stroke="a.color"
          :stroke-width="a.lifted ? a.w + 6 : a.w" :stroke-dasharray="a.dash"
          data-testid="clock-arc" :data-r="a.r" :data-w="a.w" :data-draw-start="a.from.toFixed(2)" :data-draw-end="a.to.toFixed(2)"
          :data-kind="a.kind" :data-title="a.title" :data-start="a.start" :data-end="a.end"
          :data-selected="a.selected ? 'true' : undefined" :data-lifted="a.lifted ? 'true' : undefined"
        />
        <template v-if="variant === 'rings'">
          <path
            v-for="a in arcs" :key="`${a.key}-edge`" :d="a.edge" class="edge deco" :class="{ done: a.done }" :stroke="a.color" stroke-width="3"
            :stroke-dasharray="a.list ? '6 3' : undefined"
          />
          <g class="along deco">
            <path v-for="(l, i) in alongLabels" :id="`${uid}-name-${i}`" :key="`p-${l.key}`" :d="l.d" fill="none" />
            <text
              v-for="(l, i) in alongLabels" :key="l.key" :style="{ fontSize: `${l.font}px` }"
              dominant-baseline="central" data-testid="clock-label" :data-title="l.title"
            ><textPath :href="`#${uid}-name-${i}`" :startOffset="l.offset" :text-anchor="l.anchor">{{ l.text }}</textPath></text>
          </g>
        </template>
        <g v-if="isToday" class="hand deco" data-testid="clock-hand" :data-time="handTime" :transform="`rotate(${angleOf(clock.minutesNow)} ${CENTER} ${CENTER})`">
          <line :x1="CENTER" :y1="CENTER" :x2="CENTER" :y2="CENTER - (R_OUTER - 6)" />
          <circle :cx="CENTER" :cy="CENTER - (R_OUTER - 6)" r="5" />
        </g>
        <!-- wide invisible strokes take the pointer, so a thin arc is still easy to hit -->
        <path
          v-for="a in arcs" :key="`${a.key}-hit`" :d="a.d" class="hit" :stroke-width="Math.max(26, a.w + 4)" role="button" tabindex="0" :aria-label="a.aria"
          data-testid="clock-arc-hit" :data-title="a.title"
          @pointerdown="arcDown($event, a.seg, a.key)" @keydown="arcKey($event, a)"
        ><title>{{ a.text }} {{ a.start }}-{{ a.end }}</title></path>
        <g v-for="l in labels" :key="l.key" class="lbl" :style="{ fontSize: `${sizing.font}px` }">
          <line v-if="Math.hypot(l.fx - l.x, l.fy - l.y) > 6" :x1="l.fx" :y1="l.fy" :x2="l.x" :y2="l.y" :stroke="l.color" />
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
          <text :x="CENTER" :y="CENTER + 34" text-anchor="middle" class="now" data-testid="clock-time">{{ handTime }}</text>
          <text
            v-if="middle" :x="CENTER" :y="lineY(0)" text-anchor="middle" dominant-baseline="central" class="now-line"
            :style="{ fontSize: `${sizing.font}px` }" data-testid="clock-now-line"
          >{{ middle.first }}</text>
          <text
            v-if="middle?.when" :x="CENTER" :y="lineY(1)" text-anchor="middle" dominant-baseline="central" class="now-when"
            :style="{ fontSize: `${sizing.font}px` }" data-testid="clock-now-when"
          >{{ middle.when }}</text>
        </template>
      </svg>
    </div>
    <ul v-if="untimed.length || overflow.length" ref="bottomChips" class="chips untimed-chips" data-testid="clock-untimed-list">
      <li v-for="o in overflow" :key="o.key">
        <button type="button" class="chip" :style="{ '--c': o.color }" data-testid="clock-overflow" :data-title="o.title" @click="openItem(o.item)">
          <span class="dot" /><span class="txt">{{ o.text }}</span>
        </button>
      </li>
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
.layout { flex: 1; align-self: stretch; min-width: 0; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.area { flex: 1; min-width: 0; min-height: 0; display: grid; place-items: center; overflow: hidden; }
.stacked .area { flex: none; }
/* stacked (a phone): keep the chips clear of the create button in the corner */
.stacked .layout { padding-bottom: 64px; }
.chips { list-style: none; margin: 0; padding: 0 4px; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-height: 30%; overflow-y: auto; flex: none; }
.chip {
  display: inline-flex; align-items: center; gap: 6px; max-width: 16em; min-height: 32px; padding: 4px 12px; border-radius: 16px;
  border: 1px solid var(--md-sys-color-outline-variant); background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface); font: var(--md-sys-typescale-label-large); cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.chip:hover, .chip:focus-visible { background: var(--md-sys-color-surface-container-high); outline: none; }
.chip .txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
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
.wedge { opacity: 0.22; pointer-events: none; }
.arc { fill: none; opacity: 0.92; pointer-events: none; transition: stroke-width 120ms ease; }
.rings .arc { opacity: 0.3; }
.rings .arc.lifted, .rings .arc.selected { opacity: 0.5; }
.rings .arc.done { opacity: 0.18; }
.edge { fill: none; }
.edge.done { opacity: 0.4; }
.ring-track { fill: none; stroke: var(--md-sys-color-surface-container-highest); opacity: 0.6; }
.along text { font-family: var(--md-ref-typeface-plain, system-ui); font-weight: 600; fill: var(--md-sys-color-on-surface); }
.arc.done { opacity: 0.45; }
.arc.lifted { opacity: 1; filter: drop-shadow(0 2px 4px rgb(0 0 0 / 0.35)); }
.arc.selected { opacity: 1; }
.hit { fill: none; stroke: transparent; stroke-linecap: round; pointer-events: stroke; cursor: grab; outline: none; }
.hit:focus-visible { stroke: var(--md-sys-color-primary); stroke-opacity: 0.25; }
.handle { cursor: ew-resize; outline: none; touch-action: none; }
.handle-hit { fill: transparent; }
.handle-dot { fill: var(--md-sys-color-surface); stroke-width: 3; }
.handle:focus-visible .handle-dot { fill: var(--md-sys-color-primary-container); }
.now-line { font-family: var(--md-ref-typeface-plain, system-ui); font-weight: 600; fill: var(--md-sys-color-on-surface); pointer-events: none; }
.now-when { font-family: var(--md-ref-typeface-plain, system-ui); font-weight: 500; fill: var(--md-sys-color-on-surface-variant); pointer-events: none; font-variant-numeric: tabular-nums; }
.now.drag { fill: var(--md-sys-color-primary); }
.hand line { stroke: var(--md-sys-color-tertiary); stroke-width: 3; stroke-linecap: round; }
.hand circle { fill: var(--md-sys-color-tertiary); }
.hub { fill: var(--md-sys-color-tertiary); stroke: var(--md-sys-color-surface); stroke-width: 2; }
.lbl line { stroke-width: 1; opacity: 0.7; }
.now, .now-line, .now-when { paint-order: stroke; stroke: var(--md-sys-color-surface-container-low); stroke-width: 4px; stroke-linejoin: round; }
.lbl text { cursor: pointer; font-family: var(--md-ref-typeface-plain, system-ui); font-weight: 600; fill: var(--md-sys-color-on-surface); paint-order: stroke; stroke: var(--md-sys-color-surface-container-low); stroke-width: 3px; }
.now { font: 600 22px var(--md-ref-typeface-plain, system-ui); fill: var(--md-sys-color-on-surface); }
</style>
