<script setup lang="ts">
/**
 * Labs bedtime runway (feature labs-bedtime-runway): one bar from now (top) to tonight's bedtime (bottom) that always
 * fills the view, so it shrinks as the evening goes on; tonight's timed entries to scale inside it (a tap opens one, as
 * everywhere) and a line with the time until bed and the free time. It follows the app clock's minute tick; it has no
 * timer of its own. Without bedtime mode or during the night it shows one calm line instead.
 */
import Pressable from '@/components/m3/Pressable.vue';
import { computed, ref, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useRouter } from 'vue-router';
import ItemView from '@/components/calendar/ItemView.vue';
import { IconBedtime } from '@/components/icons';
import { absMinutes, pieceTime } from '@/features/bedtime/bedtime';
import { nextIsoDate, useBedtimeWindows } from '@/features/bedtime/useBedtime';
import { formatDuration } from '@/features/calendar/timeline';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';
import { usePrefsStore } from '@/stores/prefs';
import { useSyncStore } from '@/stores/sync';
import { t } from '@/i18n';
import { runwayModel } from './runway';

const router = useRouter();
const clock = useClockStore();
const items = useItemsStore();
const cals = useCalendarsStore();
const prefs = usePrefsStore();
const sync = useSyncStore();

const tomorrow = computed(() => nextIsoDate(clock.today));
// today's night and tonight's, also when bedtime lies after midnight
const windows = useBedtimeWindows(() => ({ from: clock.today, to: nextIsoDate(tomorrow.value) }));
const nowAbs = computed(() => absMinutes(clock.today, clock.minutesNow));
const model = computed(() => runwayModel(
  windows.value, nowAbs.value,
  { get: (date) => (items.byDate.get(date) ?? []).filter((s) => !cals.isHidden(s.item.calendarId)) },
  prefs.minEventMinutes,
));

const bar = ref<HTMLElement | null>(null);
const { height: barPx } = useElementSize(bar);
/** Pixels per minute: the whole runway always fills the bar. */
const scale = computed(() => (model.value.kind === 'runway' && model.value.total > 0 ? barPx.value / model.value.total : 0));

// load today and tomorrow (a bedtime after midnight reaches into tomorrow), again when the day changes while open
watch(() => clock.today, () => {
  items.setVisible(clock.today, nextIsoDate(tomorrow.value)).then(() => { if (sync.error) sync.clearError(); }, (e) => sync.reportError(e));
}, { immediate: true });
</script>

<template>
  <section class="runway-view" data-testid="runway-view" :data-state="model.kind">
    <template v-if="model.kind === 'runway'">
      <p class="header" data-testid="runway-header">{{ t('bedtime.runway.header', { left: formatDuration(model.total), free: formatDuration(model.free) }) }}</p>
      <div class="track">
        <span class="label top">{{ t('bedtime.runway.now', { time: pieceTime(clock.minutesNow) }) }}</span>
        <div ref="bar" class="bar" data-testid="runway-bar">
          <div
            v-for="e in model.entries" :key="e.seg.item.id" class="entry" data-testid="runway-entry" :data-title="e.seg.item.title"
            :style="{ top: e.top * scale + 'px', height: e.height * scale + 'px', left: `calc(100% * ${e.col / e.cols})`, width: `calc(100% / ${e.cols})` }"
          >
            <ItemView :segment="e.seg" variant="block" :height="e.height * scale" />
          </div>
        </div>
        <span class="label bottom"><IconBedtime class="moon" />{{ t('bedtime.runway.bed', { time: model.bedtime }) }}</span>
      </div>
    </template>
    <div v-else class="calm">
      <IconBedtime class="calm-icon" />
      <p class="message" data-testid="runway-message">{{ model.kind === 'off' ? t('bedtime.runway.off') : t('bedtime.runway.passed', { time: model.bedtime }) }}</p>
      <Pressable v-if="model.kind === 'off'" type="button" class="btn" data-testid="runway-settings" @click="router.push('/settings/focus/bedtime')">{{ t('bedtime.runway.openSettings') }}</Pressable>
    </div>
  </section>
</template>

<style scoped>
.runway-view { flex: 1; min-height: 0; display: flex; flex-direction: column; box-sizing: border-box; width: 100%; max-width: 560px; margin: 0 auto;
  padding: 12px 16px 16px; background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); }
.header { margin: 0 0 8px; font: var(--md-sys-typescale-title-medium); font-variant-numeric: tabular-nums; }
.track { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.label { display: flex; align-items: center; gap: 4px; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); font-variant-numeric: tabular-nums; }
.label.top { padding-bottom: 4px; }
.label.bottom { padding-top: 4px; }
.moon { width: 16px; height: 16px; }
/* the free evening is the bar's own colour; entries are drawn on it */
.bar { position: relative; flex: 1; min-height: 0; border-radius: var(--md-sys-shape-corner-medium); overflow: hidden;
  background: var(--md-sys-color-surface-container); border-top: 2px solid var(--md-sys-color-primary);
  border-bottom: 6px solid color-mix(in oklab, var(--md-sys-color-scrim, #000) 28%, var(--md-sys-color-surface-container)); }
.entry { position: absolute; box-sizing: border-box; padding: 0 2px 1px; display: flex; min-width: 0; }
.entry > * { flex: 1; min-width: 0; }
.calm { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; }
.calm-icon { width: 40px; height: 40px; color: var(--md-sys-color-on-surface-variant); }
.message { margin: 0; max-width: 32ch; font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface); }
.btn { border: 0; border-radius: var(--md-sys-shape-corner-full); padding: 8px 16px; cursor: pointer; font: var(--md-sys-typescale-label-large);
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
</style>
