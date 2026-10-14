<script setup lang="ts">
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { formatDate, toIsoDate, minutesToTime } from '@/lib/dates';
import { displayTitle } from '@/lib/items';
import { openItem } from '@/extensions/registry';
import BedtimeDial from '@/features/bedtime/BedtimeDial.vue';
import { useCalendarStore } from '@/stores/calendar';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { clockSegments, clockText } from './clock';
import { angleOf, arcPath, CENTER, clip, fadingRows, labelSizing, pointAt, VIEW } from './geometry';
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

const R_OUTER = 172;
const LANE_GAP = 17;
const ARC_W = 14;
/** Timed events and task lists as arcs, overlapping ones on inner lanes; task lists thinner and dashed. */
const arcs = computed(() =>
  split.value.timed.map((s) => {
    const r = R_OUTER - 14 - s.lane * LANE_GAP;
    const tasklist = s.item.kind === 'tasklist';
    return {
      key: `${s.item.id}-${s.date}`, kind: s.item.kind, title: displayTitle(s.item), text: clockText(s.item),
      start: s.startTime!, end: s.endTime!, color: cats.itemColor(s.item), mid: (s.startMin + s.endMin) / 2, r, d: arcPath(s.startMin, s.endMin, r),
      width: tasklist ? ARC_W / 2 : ARC_W, dash: tasklist ? '5 4' : undefined,
      done: s.item.kind === 'tasklist' && s.item.doneCount >= s.item.totalCount,
    };
  }),
);
/** Radius the labels sit on: inside the innermost lane. */
const rLabels = computed(() => (arcs.value.length ? Math.min(...arcs.value.map((a) => a.r)) : R_OUTER - 14) - 16);
/** One readable label per arc, inside the innermost lane; pushed apart per side so they do not overlap. */
const labels = computed(() => {
  const { font, maxChars } = sizing.value;
  const all = arcs.value.map((a) => {
    const p = pointAt(a.mid, rLabels.value), from = pointAt(a.mid, a.r - 8);
    const right = p.x >= CENTER;
    return { key: a.key, title: a.title, text: clip(a.text, maxChars), color: a.color, right, x: p.x, y: p.y, fx: from.x, fy: from.y };
  });
  for (const side of [true, false]) {
    const group = all.filter((l) => l.right === side).sort((a, b) => a.y - b.y);
    group.forEach((l, i) => { if (i > 0) l.y = Math.max(l.y, group[i - 1].y + font * 1.2); });
  }
  return all;
});
/** Untimed task lists under the time in the middle: as many as fit above the labels, the last ones fading. */
const UNTIMED_TOP = CENTER + 66;
const untimed = computed(() => {
  const row = sizing.value.font * 1.35;
  const capacity = Math.max(0, Math.floor((CENTER + rLabels.value - sizing.value.font - UNTIMED_TOP) / row) + 1);
  const list = split.value.untimed;
  return fadingRows(list.length, capacity).map((opacity, i) => ({
    key: list[i].item.id, item: list[i].item, text: clip(clockText(list[i].item), sizing.value.maxChars), opacity, y: UNTIMED_TOP + i * row,
  }));
});

const isToday = computed(() => date.value === clock.today);
/** Minutes of the day that have passed on the shown date. */
const elapsed = computed(() => (date.value < clock.today ? 1440 : isToday.value ? clock.minutesNow : 0));
const handTime = computed(() => minutesToTime(clock.minutesNow));
const progress = computed(() => (elapsed.value > 0 ? arcPath(0, elapsed.value, 205) : ''));
const ticks = Array.from({ length: 24 }, (_, h) => ({ h, a: pointAt(h * 60, 178), b: pointAt(h * 60, h % 6 === 0 ? 170 : 174), label: h % 3 === 0 ? pointAt(h * 60, 190) : null }));
</script>

<template>
  <section class="clock" data-testid="clock-view" :data-date="date">
    <h2 class="date">{{ dateLabel }}</h2>
    <div ref="area" class="area">
      <svg
        class="face" :viewBox="VIEW_BOX" role="img" :aria-label="t('calendar.clock.face', { date: dateLabel })"
        :style="size > 0 ? { width: `${size}px`, height: `${size}px` } : undefined"
      >
        <circle :cx="CENTER" :cy="CENTER" r="205" class="track" data-testid="clock-dial" />
        <path v-if="progress" :d="progress" class="progress" data-testid="clock-progress" />
        <circle :cx="CENTER" :cy="CENTER" r="178" class="plate" />
        <BedtimeDial :date="date" />
        <g class="ticks">
          <line v-for="t in ticks" :key="t.h" :x1="t.a.x" :y1="t.a.y" :x2="t.b.x" :y2="t.b.y" :class="{ major: t.h % 6 === 0 }" />
        </g>
        <g class="labels">
          <template v-for="t in ticks" :key="t.h">
            <text v-if="t.label" :x="t.label.x" :y="t.label.y" text-anchor="middle" dominant-baseline="central">{{ String(t.h).padStart(2, '0') }}</text>
          </template>
        </g>
        <path
          v-for="a in arcs" :key="a.key" :d="a.d" class="arc" :class="{ done: a.done }" :stroke="a.color" :stroke-width="a.width"
          :stroke-dasharray="a.dash" :stroke-linecap="a.dash ? 'butt' : 'round'"
          data-testid="clock-arc" :data-kind="a.kind" :data-title="a.title" :data-start="a.start" :data-end="a.end"
        ><title>{{ a.text }} {{ a.start }}-{{ a.end }}</title></path>
        <g v-for="l in labels" :key="l.key" class="lbl" :style="{ fontSize: `${sizing.font}px` }">
          <line :x1="l.fx" :y1="l.fy" :x2="l.x" :y2="l.y" :stroke="l.color" />
          <text :x="l.x" :y="l.y" :text-anchor="l.right ? 'end' : 'start'" dominant-baseline="central" data-testid="clock-label" :data-title="l.title">{{ l.text }}</text>
        </g>
        <g v-if="isToday" class="hand" data-testid="clock-hand" :data-time="handTime" :transform="`rotate(${angleOf(clock.minutesNow)} ${CENTER} ${CENTER})`">
          <line :x1="CENTER" :y1="CENTER" :x2="CENTER" :y2="CENTER - (R_OUTER - 6)" />
          <circle :cx="CENTER" :cy="CENTER - (R_OUTER - 6)" r="5" />
        </g>
        <circle :cx="CENTER" :cy="CENTER" r="7" class="hub" />
        <text v-if="isToday" :x="CENTER" :y="CENTER + 40" text-anchor="middle" class="now">{{ handTime }}</text>
        <text
          v-for="u in untimed" :key="u.key" :x="CENTER" :y="u.y" text-anchor="middle" dominant-baseline="central" class="untimed"
          :style="{ fontSize: `${sizing.font}px`, opacity: u.opacity }" role="button" tabindex="0" data-testid="clock-untimed"
          @click="openItem(u.item)" @keydown.enter.prevent="openItem(u.item)" @keydown.space.prevent="openItem(u.item)"
        >{{ u.text }}</text>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.clock { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; padding: 4px 8px 8px; gap: 2px; overflow: hidden; }
.date { margin: 0; font: var(--md-sys-typescale-title-small); color: var(--md-sys-color-on-surface-variant); }
.area { flex: 1; align-self: stretch; min-width: 0; min-height: 0; display: grid; place-items: center; overflow: hidden; }
.face { width: 100%; max-height: 100%; aspect-ratio: 1; }
.track { fill: none; stroke: var(--md-sys-color-surface-container-highest); stroke-width: 8; }
.progress { fill: none; stroke: var(--md-sys-color-primary); stroke-width: 8; stroke-linecap: round; }
.plate { fill: var(--md-sys-color-surface-container-low); stroke: var(--md-sys-color-outline-variant); stroke-width: 1; }
.ticks line { stroke: var(--md-sys-color-outline); stroke-width: 1; }
.ticks line.major { stroke: var(--md-sys-color-on-surface-variant); stroke-width: 2; }
.labels text { font: 500 11px var(--md-ref-typeface-plain, system-ui); fill: var(--md-sys-color-on-surface-variant); }
.arc { fill: none; opacity: 0.92; }
.arc.done { opacity: 0.45; }
.hand line { stroke: var(--md-sys-color-tertiary); stroke-width: 3; stroke-linecap: round; }
.hand circle { fill: var(--md-sys-color-tertiary); }
.hub { fill: var(--md-sys-color-tertiary); stroke: var(--md-sys-color-surface); stroke-width: 2; }
.lbl line { stroke-width: 1; opacity: 0.7; }
.lbl text { font-family: var(--md-ref-typeface-plain, system-ui); font-weight: 600; fill: var(--md-sys-color-on-surface); paint-order: stroke; stroke: var(--md-sys-color-surface-container-low); stroke-width: 3px; }
.now { font: 600 22px var(--md-ref-typeface-plain, system-ui); fill: var(--md-sys-color-on-surface); }
.untimed { font-family: var(--md-ref-typeface-plain, system-ui); font-weight: 500; fill: var(--md-sys-color-on-surface-variant); cursor: pointer; }
.untimed:hover, .untimed:focus-visible { fill: var(--md-sys-color-primary); outline: none; text-decoration: underline; }
</style>
