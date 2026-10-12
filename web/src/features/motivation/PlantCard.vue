<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import Plant from './Plant.vue';
import type { ChangeKind, Motivation } from './types';

const props = defineProps<{ plant: Motivation['plant']; change?: { id: number; kinds: ChangeKind[] } | null }>();
const emit = defineEmits<{ close: [] }>();

const toNext = computed(() => (props.plant.nextStageAt === null ? null : Math.max(0, props.plant.nextStageAt - props.plant.growth)));
const pct = computed(() => {
  const p = props.plant;
  if (p.nextStageAt === null) return 100;
  const base = [0, 20, 60, 140, 280][p.stageIndex];
  return Math.round(((p.growth - base) / (p.nextStageAt - base)) * 100);
});
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="pc-scrim" data-testid="plant-card-scrim" @click="emit('close')" />
  <section class="pc" data-testid="plant-card" role="dialog" aria-label="Your plant" :data-mood="plant.mood">
    <Plant :stage="plant.stageIndex" :mood="plant.mood" :size="112" :change="change" />
    <h3 class="pc-stage" data-testid="plant-card-stage">{{ plant.stage }}</h3>
    <p class="pc-line" data-testid="plant-card-line">{{ plant.message }}</p>
    <div class="pc-bar" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100" :aria-label="toNext === null ? 'Fully grown' : `${toNext} points to the next stage`">
      <span :style="{ width: pct + '%' }" />
    </div>
    <p class="pc-sub">{{ toNext === null ? 'Fully grown' : `${toNext} points to the next stage` }} · {{ plant.todayPoints }}/30 today</p>
  </section>
</template>

<style scoped>
.pc-scrim { position: fixed; inset: 0; z-index: 70; }
.pc { position: absolute; top: calc(100% + 6px); left: 0; z-index: 71; width: min(260px, calc(100vw - 24px)); text-align: center; padding: 16px 16px 14px;
  border-radius: 24px; background: var(--md-sys-color-surface-container-high, #ece6f0); color: var(--md-sys-color-on-surface, #1d1b20);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22); display: flex; flex-direction: column; align-items: center; gap: 4px; animation: pc-in 260ms cubic-bezier(0.34, 1.4, 0.64, 1); transform-origin: top left; }
.pc-stage { margin: 6px 0 0; font: 600 1.1rem/1.2 system-ui, sans-serif; }
.pc-line { margin: 0; font-size: 0.9rem; color: var(--md-sys-color-on-surface-variant, #49454f); }
.pc-bar { width: 100%; height: 8px; border-radius: 4px; background: var(--md-sys-color-surface-container-highest, #e6e0e9); overflow: hidden; margin-top: 8px; }
.pc-bar span { display: block; height: 100%; background: var(--md-sys-color-primary, #386a20); border-radius: 4px; transition: width 500ms; }
.pc-sub { margin: 0; font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant, #49454f); }
@keyframes pc-in { from { opacity: 0; transform: scale(0.85); } }
:global(html[data-motion='off']) .pc, :global(html[data-motion='reduced']) .pc { animation: none; }
</style>
