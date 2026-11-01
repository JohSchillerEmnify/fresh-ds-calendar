<script setup lang="ts">
import Pressable from '@/components/m3/Pressable.vue';
import { elOf } from '@/lib/elOf';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '@/i18n';
import Plant from './Plant.vue';
import PlantCard from './PlantCard.vue';
import StreakFlame from './StreakFlame.vue';
import StreakToast from './StreakToast.vue';
import type { StreakChoice } from '@/api/types';
import { usePrefsStore } from '@/stores/prefs';
import { useMotivationStore } from './store';

/**
 * Shell mount for the `leading-widgets` slot: the person's streak choice, the flame or the plant button (+ plant card
 * popover), and the check-in toast, which shows whatever the choice is (Off included).
 * Starts the store (first-open check-in by the APP clock via `today`) and stops it on unmount.
 */
const props = withDefaults(
  defineProps<{ streak?: StreakChoice; today: () => string }>(),
  { streak: 'off' },
);
const store = useMotivationStore();
const cardOpen = ref(false);
const plantBtnRef = ref<unknown>(null);
/** The `Pressable`'s element (a template ref points at the component). */
const plantBtn = computed(() => elOf(plantBtnRef.value));
const plant = computed(() => store.motivation?.plant ?? null);
const streakState = computed(() => store.motivation?.streak ?? null);
const prefs = usePrefsStore();
/** The motivation and the person's streak choice have both arrived, so what shows is final. */
const ready = computed(() => !!store.motivation && prefs.loaded);

onMounted(() => void store.start({ today: props.today }));
onBeforeUnmount(() => store.stop());
</script>

<template>
  <div class="lw" data-testid="leading-widgets" :data-ready="ready ? 'true' : undefined">
    <StreakFlame v-if="props.streak === 'flame' && streakState" :count="streakState.current" :pulse="store.streakPulse" />
    <div v-if="props.streak === 'plant' && plant" class="lw-plant">
      <Pressable
        type="button"
        class="lw-btn"
        ref="plantBtnRef"
        data-testid="plant-button"
        :data-stage="plant.stage"
        :data-mood="plant.mood"
        :aria-expanded="cardOpen"
        :aria-label="t('tasks.plant.label')"
        @click="cardOpen = !cardOpen"
      >
        <Plant :stage="plant.stageIndex" :mood="plant.mood" :size="30" :change="store.change" />
      </Pressable>
      <PlantCard v-if="cardOpen" :anchor="plantBtn" :plant="plant" :change="store.change" @close="cardOpen = false" />
    </div>
    <StreakToast :message="store.message" @hide="store.dismissMessage()" />
  </div>
</template>

<style scoped>
.lw { display: inline-flex; align-items: center; gap: 8px; position: relative; }
.lw-plant { position: relative; }
.lw-btn { appearance: none; border: 0; background: transparent; padding: 4px; margin: 0; border-radius: 50%; cursor: pointer; display: grid; place-items: center; min-width: 40px; min-height: 40px; -webkit-tap-highlight-color: transparent; }
.lw-btn:active { transform: scale(0.92); }
</style>
