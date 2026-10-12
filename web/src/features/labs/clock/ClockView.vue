<script setup lang="ts">
import { computed } from 'vue';
import { toIsoDate, minutesToTime } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { angleOf, arcPath, assignLanes, CENTER, pointAt } from './geometry';

const cal = useCalendarStore();
const clock = useClockStore();
const items = useItemsStore();
const cals = useCalendarsStore();

const date = computed(() => toIsoDate(cal.anchor));
const dateLabel = computed(() => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(cal.anchor));

const segments = computed(() => (items.byDate.get(date.value) ?? []).filter((s) => !cals.isHidden(s.item.calendarId)));

const R_OUTER = 168;
const LANE_GAP = 17;
const ARC_W = 14;
/** Timed events as arcs, overlapping ones on inner lanes. */
const arcs = computed(() =>
  assignLanes(segments.value.filter((s) => s.item.kind === 'event' && !s.allDay && s.startTime && s.endTime)).map((s) => ({
    key: `${s.item.id}-${s.date}`, title: s.item.title, start: s.startTime!, end: s.endTime!, color: s.item.color,
    d: arcPath(s.startMin, s.endMin, R_OUTER - 14 - s.lane * LANE_GAP),
  })),
);
/** Timed task lists as dots on the hour ring. */
const dots = computed(() =>
  segments.value.filter((s) => s.item.kind === 'tasklist' && s.startTime).map((s) => ({
    key: s.item.id, title: s.item.title, time: s.startTime!, color: s.item.color, done: s.item.kind === 'tasklist' && s.item.doneCount >= s.item.totalCount,
    ...pointAt(s.startMin, R_OUTER + 2),
  })),
);

const isToday = computed(() => date.value === clock.today);
/** Minutes of the day that have passed on the shown date. */
const elapsed = computed(() => (date.value < clock.today ? 1440 : isToday.value ? clock.minutesNow : 0));
const handTime = computed(() => minutesToTime(clock.minutesNow));
const progress = computed(() => (elapsed.value > 0 ? arcPath(0, elapsed.value, 190) : ''));
const ticks = Array.from({ length: 24 }, (_, h) => ({ h, a: pointAt(h * 60, 178), b: pointAt(h * 60, h % 6 === 0 ? 170 : 174), label: h % 3 === 0 ? pointAt(h * 60, 154) : null }));
</script>

<template>
  <section class="clock" data-testid="clock-view" :data-date="date">
    <h2 class="date">{{ dateLabel }}</h2>
    <svg class="face" viewBox="0 0 400 400" role="img" :aria-label="`24-hour clock for ${dateLabel}`">
      <circle :cx="CENTER" :cy="CENTER" r="190" class="track" />
      <path v-if="progress" :d="progress" class="progress" data-testid="clock-progress" />
      <circle :cx="CENTER" :cy="CENTER" r="178" class="plate" />
      <g class="ticks">
        <line v-for="t in ticks" :key="t.h" :x1="t.a.x" :y1="t.a.y" :x2="t.b.x" :y2="t.b.y" :class="{ major: t.h % 6 === 0 }" />
      </g>
      <g class="labels">
        <template v-for="t in ticks" :key="t.h">
          <text v-if="t.label" :x="t.label.x" :y="t.label.y" text-anchor="middle" dominant-baseline="central">{{ String(t.h).padStart(2, '0') }}</text>
        </template>
      </g>
      <path
        v-for="a in arcs" :key="a.key" :d="a.d" class="arc" :stroke="a.color" :stroke-width="ARC_W" stroke-linecap="round"
        data-testid="clock-arc" :data-title="a.title" :data-start="a.start" :data-end="a.end"
      ><title>{{ a.title }} {{ a.start }}-{{ a.end }}</title></path>
      <circle
        v-for="d in dots" :key="d.key" :cx="d.x" :cy="d.y" r="7" class="dot" :class="{ done: d.done }" :fill="d.color"
        data-testid="clock-dot" :data-title="d.title" :data-time="d.time"
      ><title>{{ d.title }} {{ d.time }}</title></circle>
      <g v-if="isToday" class="hand" data-testid="clock-hand" :data-time="handTime" :transform="`rotate(${angleOf(clock.minutesNow)} ${CENTER} ${CENTER})`">
        <line :x1="CENTER" :y1="CENTER" :x2="CENTER" :y2="CENTER - (R_OUTER - 6)" />
        <circle :cx="CENTER" :cy="CENTER - (R_OUTER - 6)" r="5" />
      </g>
      <circle :cx="CENTER" :cy="CENTER" r="7" class="hub" />
      <text v-if="isToday" :x="CENTER" :y="CENTER + 40" text-anchor="middle" class="now">{{ handTime }}</text>
    </svg>
  </section>
</template>

<style scoped>
.clock { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; padding: 8px 16px 16px; gap: 4px; overflow: auto; }
.date { margin: 0; font: var(--md-sys-typescale-title-medium); color: var(--md-sys-color-on-surface-variant); }
.face { width: min(100%, 520px, 100dvh); max-height: 100%; flex: 0 1 auto; aspect-ratio: 1; }
.track { fill: none; stroke: var(--md-sys-color-surface-container-highest); stroke-width: 8; }
.progress { fill: none; stroke: var(--md-sys-color-primary); stroke-width: 8; stroke-linecap: round; }
.plate { fill: var(--md-sys-color-surface-container-low); stroke: var(--md-sys-color-outline-variant); stroke-width: 1; }
.ticks line { stroke: var(--md-sys-color-outline); stroke-width: 1; }
.ticks line.major { stroke: var(--md-sys-color-on-surface-variant); stroke-width: 2; }
.labels text { font: 500 11px var(--md-ref-typeface-plain, system-ui); fill: var(--md-sys-color-on-surface-variant); }
.arc { fill: none; opacity: 0.92; }
.dot { stroke: var(--md-sys-color-surface); stroke-width: 2; }
.dot.done { opacity: 0.45; }
.hand line { stroke: var(--md-sys-color-tertiary); stroke-width: 3; stroke-linecap: round; }
.hand circle { fill: var(--md-sys-color-tertiary); }
.hub { fill: var(--md-sys-color-tertiary); stroke: var(--md-sys-color-surface); stroke-width: 2; }
.now { font: 600 22px var(--md-ref-typeface-plain, system-ui); fill: var(--md-sys-color-on-surface); }
</style>
