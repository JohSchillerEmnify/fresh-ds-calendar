<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import { t, type MessageKey } from '@/i18n';
import { clampLeft } from '@/lib/clamp';
import Plant from './Plant.vue';
import type { ChangeKind, Motivation } from './types';

const props = defineProps<{ plant: Motivation['plant']; change?: { id: number; kinds: ChangeKind[] } | null; anchor?: HTMLElement | null }>();
const pos = ref({ top: 56, left: 12, maxH: 400 });
function place() {
  const w = Math.min(260, window.innerWidth - 24);
  const r = props.anchor?.getBoundingClientRect();
  const top = r ? r.bottom + 6 : 56;
  pos.value = { top, left: clampLeft(r ? r.left : 12, w, window.innerWidth), maxH: window.innerHeight - top - 8 };
}
const emit = defineEmits<{ close: [] }>();

/** Catalogue keys of the stage names and mood messages: the server's English text is not shown. */
const STAGE_KEYS: MessageKey[] = ['tasks.plant.stage.seed', 'tasks.plant.stage.sprout', 'tasks.plant.stage.small', 'tasks.plant.stage.leafy', 'tasks.plant.stage.flowering'];
const progressText = computed(() => (toNext.value === null ? t('tasks.plant.fullyGrown') : t('tasks.plant.toNext', { count: toNext.value })));

const toNext = computed(() => (props.plant.nextStageAt === null ? null : Math.max(0, props.plant.nextStageAt - props.plant.growth)));
const pct = computed(() => {
  const p = props.plant;
  if (p.nextStageAt === null) return 100;
  const base = [0, 20, 60, 140, 280][p.stageIndex];
  return Math.round(((p.growth - base) / (p.nextStageAt - base)) * 100);
});
onMounted(() => { place(); window.addEventListener('resize', place); });
onBeforeUnmount(() => window.removeEventListener('resize', place));
</script>

<template>
  <AdaptiveSheet
    open :label="t('tasks.plant.label')" :anchor="pos" anchored-on-phone testid="plant-card" :panel-attrs="{ 'data-mood': plant.mood }"
    :panel-style="{ width: 'min(260px, calc(100vw - 24px))' }" @close="emit('close')"
  >
    <div class="pc">
      <Plant :stage="plant.stageIndex" :mood="plant.mood" :size="112" :change="change" />
      <h3 class="pc-stage" data-testid="plant-card-stage">{{ t(STAGE_KEYS[plant.stageIndex]) }}</h3>
      <p class="pc-line" data-testid="plant-card-line">{{ t(`tasks.plant.mood.${plant.mood}`) }}</p>
      <div class="pc-bar" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100" :aria-label="progressText">
        <span :style="{ width: pct + '%' }" />
      </div>
      <p class="pc-sub">{{ progressText }} · {{ t('tasks.plant.today', { points: plant.todayPoints }) }}</p>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.pc { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.pc-stage { margin: 6px 0 0; font: var(--md-sys-typescale-title-medium); }
.pc-line { margin: 0; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.pc-bar { width: 100%; height: 8px; border-radius: 4px; background: var(--md-sys-color-surface-container-highest); overflow: hidden; margin-top: 8px; }
.pc-bar span { display: block; height: 100%; background: var(--md-sys-color-primary); border-radius: 4px; transition: width 500ms; }
.pc-sub { margin: 0; font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
</style>
