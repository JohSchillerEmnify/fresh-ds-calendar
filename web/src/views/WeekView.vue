<script setup lang="ts">
import { computed } from 'vue';
import TimeGrid from '@/components/calendar/TimeGrid.vue';
import { toIsoDate, weekDays } from '@/lib/dates';
import { providePreview } from '@/composables/usePreview';
import { useCalendarStore } from '@/stores/calendar';

/** `anchor`/`preview`: a light copy for another period (swipe neighbour), see `usePreview`. */
const props = defineProps<{ anchor?: Date; preview?: boolean }>();
providePreview(props.preview);
const cal = useCalendarStore();
const days = computed(() => weekDays(props.anchor ?? cal.anchor));
</script>

<template>
  <section class="v" data-testid="week-view" :data-week-start="toIsoDate(days[0])">
    <TimeGrid mode="week" :dates="days" />
  </section>
</template>

<style scoped>
.v { flex: 1; min-height: 0; display: flex; flex-direction: column; }
</style>
