<script setup lang="ts">
import { computed } from 'vue';
import TimeGrid from '@/components/calendar/TimeGrid.vue';
import { toIsoDate, weekDays } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';

const cal = useCalendarStore();
const days = computed(() => weekDays(cal.anchor));
</script>

<template>
  <section class="v" data-testid="week-view" :data-week-start="toIsoDate(days[0])">
    <TimeGrid mode="week" :dates="days" />
  </section>
</template>

<style scoped>
.v { flex: 1; min-height: 0; display: flex; flex-direction: column; }
</style>
