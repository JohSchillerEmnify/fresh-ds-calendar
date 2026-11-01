<script setup lang="ts">
/** The month list that scrolls up and down: `MonthView` blocks under a pinned weekday row; the month most in view is the period (URL by `replace`). */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { isPhone } from '@/composables/useViewport';
import { fetchRange, routePath, weekdayLabels } from '@/lib/dates';
import { listLayout, MONTH_COUNT, MONTH_HEADER_H, monthDate, monthIndex, mostInView, WEEKDAY_ROW_H, weekHeight } from '@/lib/monthList';
import { getMotionLevel } from '@/motion';
import { useCalendarStore } from '@/stores/calendar';
import { useItemsStore } from '@/stores/items';
import MonthView from '@/views/MonthView.vue';

defineProps<{ mode: 'vertical' | 'vertical-snap' }>();
const cal = useCalendarStore();
const items = useItemsStore();
const route = useRoute();
const router = useRouter();

const el = ref<HTMLElement | null>(null);
const layout = computed(() => listLayout({ weekH: weekHeight(isPhone.value), headerH: MONTH_HEADER_H }));
/** The month most in view; the built months follow it. */
const main = ref(monthIndex(cal.anchor));
const built = computed(() => {
  const from = Math.max(0, main.value - 1);
  return Array.from({ length: Math.min(MONTH_COUNT - 1, main.value + 1) - from + 1 }, (_, n) => from + n);
});
const topPad = computed(() => layout.value.tops[built.value[0]]);
const bottomPad = computed(() => layout.value.tops[MONTH_COUNT] - layout.value.tops[built.value[built.value.length - 1] + 1]);

/** The month a programmatic scroll is on its way to: the title does not follow the months passed on the way. */
let target: number | null = null;
let frame = 0;

/** The scroll offset that puts the header of month `i` right under the pinned weekday row. */
const offsetOf = (i: number) => layout.value.tops[i];

/** Scrolls to month `i`: smoothly to the next or previous month, in one jump from further away (built first, so no blank frame). */
async function scrollToMonth(i: number): Promise<void> {
  const box = el.value;
  if (!box) return;
  const near = Math.abs(i - main.value) <= 1 && getMotionLevel() === 'full';
  target = i;
  if (!near) {
    main.value = i;
    await nextTick();
  }
  box.scrollTo({ top: offsetOf(i), behavior: near ? 'smooth' : 'instant' });
}

/** Follows the scroll: the month most in view is built around, and becomes the period unless a scroll to a month is under way or has arrived. */
function follow(): void {
  frame = 0;
  const box = el.value;
  if (!box) return;
  // a month scrolled to stays the period until the person scrolls on, even if the next month shows more of itself
  const arrived = target !== null && Math.abs(box.scrollTop - offsetOf(target)) < 1;
  const m = arrived ? target! : mostInView(layout.value, box.scrollTop, box.clientHeight - WEEKDAY_ROW_H);
  main.value = m;
  if (target === null && m !== monthIndex(cal.anchor)) void router.replace({ path: routePath('month', monthDate(m)), query: route.query });
}
const onScroll = () => { if (!frame) frame = requestAnimationFrame(follow); };
/** The person takes over (finger, wheel, scrollbar, key): from here the month most in view is the period again. */
const takeOver = () => { target = null; };

// the period changed by something else than this scroll (arrows, Today, the month picker, a link): scroll there
watch(() => cal.anchor, (a) => { const i = monthIndex(a); if (i !== main.value || target !== null) void scrollToMonth(i); });
// the built months' items load in the background (the route loads only the month in view)
watch(built, (b) => items.prefetch(fetchRange('month', monthDate(b[0]))[0], fetchRange('month', monthDate(b[b.length - 1]))[1]), { immediate: true });

/** What the list was scrolled to is kept in the history entry, so coming back (also after a reload) is pixel-exact. */
const STASH = 'monthTop';
onBeforeRouteLeave(() => {
  if (el.value) history.replaceState({ ...history.state, [STASH]: el.value.scrollTop }, '');
});
onMounted(() => {
  const saved: unknown = history.state?.[STASH];
  el.value!.scrollTop = typeof saved === 'number' ? saved : offsetOf(main.value);
});
</script>

<template>
  <section
    ref="el" class="list" data-testid="month-view" data-scroll-area :data-scroll="mode" @scroll.passive="onScroll" @wheel.passive="takeOver"
    @touchstart.passive="takeOver" @pointerdown.passive="takeOver" @keydown="takeOver"
  >
    <div class="weekdays" role="row">
      <div v-for="w in weekdayLabels()" :key="w" class="wd" data-testid="month-weekday-header" role="columnheader">{{ w }}</div>
    </div>
    <div :style="{ height: topPad + 'px' }" aria-hidden="true" />
    <MonthView v-for="i in built" :key="i" :anchor="monthDate(i)" :block="mode" />
    <div :style="{ height: bottomPad + 'px' }" aria-hidden="true" />
  </section>
</template>

<style scoped>
.list { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior-y: contain; scroll-padding-top: 28px; }
.list[data-scroll='vertical-snap'] { scroll-snap-type: y mandatory; }
.weekdays {
  position: sticky; top: 0; z-index: 4; height: 28px; box-sizing: border-box; padding: 4px 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
  background: var(--md-sys-color-surface); border-bottom: 1px solid var(--md-sys-color-outline-variant);
}
.wd { text-align: center; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
