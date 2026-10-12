<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Plant from './Plant.vue';
import PlantCard from './PlantCard.vue';
import StreakFlame from './StreakFlame.vue';
import StreakToast from './StreakToast.vue';
import { useMotivationStore } from './store';

/**
 * Shell mount for the `leading-widgets` slot: streak flame and/or plant button (+ plant card popover + toast).
 * Starts the store (first-open check-in by the APP clock via `today`) and stops it on unmount.
 */
const props = withDefaults(
  defineProps<{ streakFlame?: boolean; garden?: 'plant' | 'sunflowers' | 'off'; today: () => string }>(),
  { streakFlame: true, garden: 'plant' },
);
const store = useMotivationStore();
const cardOpen = ref(false);
const plantBtn = ref<HTMLElement | null>(null);
const plant = computed(() => store.motivation?.plant ?? null);
const streak = computed(() => store.motivation?.streak ?? null);

onMounted(() => void store.start({ today: props.today }));
onBeforeUnmount(() => store.stop());
</script>

<template>
  <div class="lw" data-testid="leading-widgets">
    <StreakFlame v-if="streakFlame && streak" :count="streak.current" :pulse="store.streakPulse" />
    <div v-if="garden === 'plant' && plant" class="lw-plant">
      <button
        type="button"
        class="lw-btn"
        ref="plantBtn"
        data-testid="plant-button"
        :data-stage="plant.stage"
        :data-mood="plant.mood"
        :aria-expanded="cardOpen"
        aria-label="Your plant"
        @click="cardOpen = !cardOpen"
      >
        <Plant :stage="plant.stageIndex" :mood="plant.mood" :size="30" :change="store.change" />
      </button>
      <PlantCard v-if="cardOpen" :anchor="plantBtn" :plant="plant" :change="store.change" @close="cardOpen = false" />
    </div>
    <StreakToast v-if="streakFlame" :message="store.message" @hide="store.dismissMessage()" />
  </div>
</template>

<style scoped>
.lw { display: inline-flex; align-items: center; gap: 8px; position: relative; }
.lw-plant { position: relative; }
.lw-btn { appearance: none; border: 0; background: transparent; padding: 4px; margin: 0; border-radius: 50%; cursor: pointer; display: grid; place-items: center; min-width: 40px; min-height: 40px; -webkit-tap-highlight-color: transparent; }
.lw-btn:active { transform: scale(0.92); }
</style>
