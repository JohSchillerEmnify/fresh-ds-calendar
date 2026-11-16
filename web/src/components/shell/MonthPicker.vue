<script setup lang="ts">
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Pressable from '@/components/m3/Pressable.vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { addMonths, isSameDay, isSameMonth } from 'date-fns';
import { IconChevronLeft as IconPrev, IconChevronRight as IconNext } from '@/components/icons';
import IconButton from '@/components/m3/IconButton.vue';
import { useNav } from '@/composables/useNav';
import { bindSwipe } from '@/composables/useSwipe';
import { formatDate, monthGrid, toIsoDate, weekdayLabels } from '@/lib/dates';
import { listen, type Disposer } from '@/lib/timers';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';

/** Expanding mini-month picker under the top app bar (month-picker.feature). */
const cal = useCalendarStore();
const clock = useClockStore();
const items = useItemsStore();
const sync = useSyncStore();
const ui = useUiStore();
const nav = useNav();

const shown = ref(startMonth());
function startMonth(): Date {
  const d = cal.view === 'month' ? cal.anchor : cal.focusDate;
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
const weeks = computed(() => monthGrid(shown.value));
const title = computed(() => formatDate(shown.value, 'monthYear'));
const grid = ref<HTMLElement | null>(null);
/** Expands right under the top app bar. */
const bar = document.querySelector('[data-testid="top-bar"]')?.getBoundingClientRect().bottom ?? 0;
const anchor = { left: 0, top: bar, maxH: window.innerHeight - bar - 8 };

function load() {
  const w = weeks.value;
  const from = toIsoDate(w[0][0]);
  const last = w[w.length - 1][6];
  const to = toIsoDate(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  items.loadSummary(from, to).catch((e) => sync.reportError(e));
}
const move = (n: 1 | -1) => { shown.value = addMonths(shown.value, n); };
const hasItems = (d: Date) => {
  const s = items.summary[toIsoDate(d)];
  return !!s && s.events + s.tasklists > 0;
};
const selected = (d: Date) => isSameDay(d, cal.focusDate);

let stops: Disposer[] = [];
watch(shown, load, { immediate: true });
onMounted(() => {
  if (grid.value) stops.push(bindSwipe(grid.value, { onLeft: () => move(1), onRight: () => move(-1) }));
  if (grid.value) {
    // Mouse drag counterpart of the touch swipe, for desktop: same distance and direction checks, but no time limit (a
    // slow, deliberate drag counts too; the 60 px minimum already keeps clicks out).
    const g = grid.value;
    let sx = 0, sy = 0, down = false;
    stops.push(
      listen(g, 'pointerdown', (e) => { const p = e as PointerEvent; down = p.pointerType === 'mouse'; sx = p.clientX; sy = p.clientY; }),
      listen(document, 'pointerup', (e) => {
        if (!down) return;
        down = false;
        const p = e as PointerEvent, dx = p.clientX - sx, dy = p.clientY - sy;
        if (Math.abs(dx) < 60 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
        move(dx < 0 ? 1 : -1);
      }),
    );
  }
});
onBeforeUnmount(() => stops.forEach((s) => s()));
</script>

<template>
  <Teleport to="body">
    <AdaptiveSheet open :label="t('calendar.picker.label')" :anchor="anchor" drop testid="month-picker" @close="ui.pickerOpen = false">
      <div class="head">
        <IconButton :label="t('calendar.picker.previousMonth')" data-testid="month-picker-prev" @click="move(-1)"><IconPrev /></IconButton>
        <h2 class="ttl" data-testid="month-picker-title" aria-live="polite">{{ title }}</h2>
        <IconButton :label="t('calendar.picker.nextMonth')" data-testid="month-picker-next" @click="move(1)"><IconNext /></IconButton>
      </div>
      <div ref="grid" class="grid">
        <span v-for="w in weekdayLabels()" :key="w" class="wd" aria-hidden="true">{{ w[0] }}</span>
        <template v-for="week in weeks" :key="toIsoDate(week[0])">
          <Pressable
            v-for="d in week" :key="toIsoDate(d)" type="button" class="day" data-testid="picker-day"
            :class="{ out: !isSameMonth(d, shown), sel: selected(d), today: toIsoDate(d) === clock.today }"
            :data-date="toIsoDate(d)" :aria-selected="selected(d)" :aria-label="formatDate(d, 'full')" :data-has-items="hasItems(d)"
            @click="nav.pickDay(d)"
          >
            <span class="n">{{ d.getDate() }}</span>
            <i v-if="hasItems(d)" class="dot" />
          </Pressable>
        </template>
      </div>
    </AdaptiveSheet>
  </Teleport>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; }
.ttl { margin: 0; font: var(--md-sys-typescale-title-medium); }
.grid { display: grid; grid-template-columns: repeat(7, 1fr); touch-action: pan-y; }
.wd { text-align: center; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); padding: 4px 0; }
.day { position: relative; height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: var(--md-sys-shape-corner-full); font: var(--md-sys-typescale-body-medium); }
.day.out { color: var(--md-sys-color-on-surface-variant); opacity: 0.6; }
.day.today .n { box-shadow: inset 0 0 0 1.5px var(--md-sys-color-primary); }
.n { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 150ms; }
.day.sel { color: var(--md-sys-color-on-primary); opacity: 1; }
.day.sel .n { background: var(--md-sys-color-primary); box-shadow: none; }
.dot { position: absolute; bottom: 1px; width: 5px; height: 5px; border-radius: 50%; background: var(--md-sys-color-primary); }
.sel .dot { background: var(--md-sys-color-on-primary); bottom: 4px; }
</style>
