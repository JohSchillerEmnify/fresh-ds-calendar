<script setup lang="ts">
/**
 * Sticky live preview at the top of the theme menu (feature theme-menu): a mini calendar made of the
 * app's own components with static sample data (top bar with the current scene, a three-day week slice, a task list with
 * checkboxes, the + button and icons), laid out at a fixed design width and scaled down with `transform: scale`. It sits
 * under the `<html>` theme attributes, so every theme change (including a slider before release) shows at once. The
 * content is inert; only the handle below it is interactive and folds the preview to a thin top bar strip, remembered
 * per device.
 */
import Pressable from '@/components/m3/Pressable.vue';
import { useBarSize } from '@/composables/useBarSize';
import { computed, ref, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { onColor } from '@/api/colors';
import { IconAdd, IconChevronLeft as IconPrev, IconChevronRight as IconNext, IconExpandMore as IconExpand, IconFilterList as IconFilter, IconSettingsOutline as IconSettings } from '@/components/icons';
import ItemView from '@/components/calendar/ItemView.vue';
import Button from '@/components/m3/Button.vue';
import Fab from '@/components/m3/Fab.vue';
import IconButton from '@/components/m3/IconButton.vue';
import TopAppBar from '@/components/m3/TopAppBar.vue';
import { providePreview } from '@/composables/usePreview';
import { TopBarScene } from '@/features/motivation';
import { t } from '@/i18n';
import { RewardCheckbox, useAnimationLevel } from '@/motion';
import { useSettingsStore } from '@/stores/settings';
import { GRID_HEIGHT_PX, SAMPLE_DAYS, SAMPLE_EVENTS, SAMPLE_TASKS, previewScale, readCollapsed, sampleBox, sampleSegment, writeCollapsed } from './themeLivePreviewSample';

/** Width the mini calendar is laid out at before it is scaled to the available width. */
const barSize = useBarSize().top;
const DESIGN_WIDTH = 420;
const LIST_COLOR = '#0b8043';

const settings = useSettingsStore();
const level = useAnimationLevel();
// the sample events are drawn by the real renderer, which then skips its drag handlers
providePreview(true);

const collapsed = ref(readCollapsed());
watch(collapsed, writeCollapsed);

const frame = ref<HTMLElement | null>(null);
const inner = ref<HTMLElement | null>(null);
const { width: frameWidth } = useElementSize(frame);
const { height: naturalHeight } = useElementSize(inner);
const scale = computed(() => previewScale(frameWidth.value, DESIGN_WIDTH));
/** The frame is as tall as the scaled content (a transform does not change the layout box). */
const frameStyle = computed(() => (naturalHeight.value > 0 ? { height: `${naturalHeight.value * scale.value}px` } : undefined));
/** Scaled animations run only at the Full animation level; below it the preview is a still picture. */
const still = computed(() => level.value !== 'full');

const days = computed(() => {
  const fmt = new Intl.DateTimeFormat(document.documentElement.lang || undefined, { weekday: 'short' });
  return SAMPLE_DAYS.map((d) => ({ date: d, name: fmt.format(new Date(`${d}T12:00:00`)), num: Number(d.slice(8)) }));
});
const events = computed(() => SAMPLE_EVENTS.map((e, i) => ({ e, i, seg: sampleSegment(e, t(e.title)), box: sampleBox(e) })));
const ticked = computed(() => SAMPLE_TASKS.map((x) => x.done));
</script>

<template>
  <section class="live" :class="{ collapsed, still }" :data-bar="barSize" data-testid="theme-live-preview" :data-collapsed="collapsed" :aria-label="t('themePreview.label')">
    <div ref="frame" class="frame" :style="frameStyle">
      <div ref="inner" class="scaled" :style="{ width: `${DESIGN_WIDTH}px`, transform: `scale(${scale})` }" inert aria-hidden="true">
        <TopAppBar>
          <template #background><TopBarScene :scene="settings.effectiveScene" field-mode="full" /></template>
          <div class="bar">
            <span class="title">{{ t('themePreview.month') }}</span>
            <IconButton label=""><IconPrev /></IconButton>
            <Button variant="tonal">{{ t('themePreview.today') }}</Button>
            <IconButton label=""><IconNext /></IconButton>
            <span class="gap" />
            <IconButton label=""><IconFilter /></IconButton>
            <IconButton label=""><IconSettings /></IconButton>
          </div>
        </TopAppBar>
        <div v-if="!collapsed" class="body">
          <div class="week">
            <div v-for="(d, n) in days" :key="d.date" class="day">
              <span class="dh"><b>{{ d.num }}</b> {{ d.name }}</span>
              <div class="col" :style="{ height: `${GRID_HEIGHT_PX}px` }">
                <div v-for="x in events.filter((v) => v.e.day === n)" :key="x.e.id" class="ev" :style="{ top: `${x.box.top}px`, height: `${x.box.height}px` }">
                  <ItemView :segment="x.seg" variant="block" :height="x.box.height" :data-testid="x.i === 0 ? 'theme-preview-event' : 'theme-live-preview-event'" />
                </div>
              </div>
            </div>
          </div>
          <div class="side">
            <div class="skin list" :style="{ '--c': LIST_COLOR, '--on-solid': onColor(LIST_COLOR) }">
              <span class="lt">{{ t('themePreview.sample.groceries') }}</span>
              <RewardCheckbox v-for="(x, n) in SAMPLE_TASKS" :key="x.title" :model-value="ticked[n]" :label="t(x.title)" />
            </div>
            <Fab label=""><IconAdd /></Fab>
          </div>
        </div>
      </div>
    </div>
    <Pressable class="handle" type="button" data-testid="theme-live-preview-toggle" :aria-expanded="!collapsed" :aria-label="collapsed ? t('themePreview.expand') : t('themePreview.collapse')" @click="collapsed = !collapsed">
      <IconExpand class="chev" :class="{ up: !collapsed }" aria-hidden="true" />
    </Pressable>
  </section>
</template>

<style scoped>
/* pinned under the menu header (safe area + 8 + 44 + 8 px); on the desktop the same offset in the right column */
.live { position: sticky; top: calc(var(--safe-top) + 64px); z-index: 1; display: flex; flex-direction: column; border-radius: var(--md-sys-shape-corner-large); overflow: hidden; background: var(--md-sys-color-surface); box-shadow: 0 0 0 1px var(--md-sys-color-outline-variant), var(--md-sys-elevation-2); }
.frame { position: relative; overflow: hidden; max-height: 34vh; pointer-events: none; }
.live[data-bar='compact'] { top: calc(var(--safe-top) + 56px); }
.scaled { --safe-top: 0px; transform-origin: top left; }
.bar { display: flex; align-items: center; gap: 2px; padding: 2px 4px 2px 12px; min-height: 52px; }
.title { font: var(--md-sys-typescale-title-large); margin-right: 8px; white-space: nowrap; }
.gap { flex: 1; }
.body { display: grid; grid-template-columns: minmax(0, 1fr) 124px; gap: 10px; padding: 8px 10px 10px; background: var(--md-sys-color-surface); }
.week { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
.day { min-width: 0; }
.dh { display: block; padding: 0 2px 3px; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.col { position: relative; border-radius: var(--md-sys-shape-corner-small); background: var(--md-sys-color-surface-container-low); }
.ev { position: absolute; left: 2px; right: 2px; }
.side { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.list { align-self: stretch; box-sizing: border-box; padding: 6px 8px; border-radius: var(--r-block); display: flex; flex-direction: column; font: var(--md-sys-typescale-label-medium); }
.lt { font: var(--md-sys-typescale-label-large); padding-bottom: 2px; }
.list :deep(.rcb) { min-height: 28px; gap: 4px; }
.list :deep(.rcb-box) { width: 26px; height: 26px; }
.side :deep(.fab) { width: 48px; height: 48px; }
.collapsed .bar { visibility: hidden; min-height: 36px; }
.handle { display: flex; align-items: center; justify-content: center; height: 24px; border: 0; background: var(--md-sys-color-surface-container); color: var(--md-sys-color-on-surface-variant); cursor: pointer; }
.chev { width: 20px; height: 20px; transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring); }
.chev.up { transform: rotate(180deg); }
/* below the Full animation level the preview is a still picture */
.still :deep(*), .still :deep(*::before), .still :deep(*::after) { animation: none !important; transition: none !important; }
</style>
