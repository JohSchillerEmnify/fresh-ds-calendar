<script setup lang="ts">
import { computed } from 'vue';
import TimeGrid from '@/components/calendar/TimeGrid.vue';
import { toIsoDate } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';

const cal = useCalendarStore();
const days = computed(() => [cal.anchor]);
</script>

<template>
  <section class="v" data-testid="day-view" :data-date="toIsoDate(cal.anchor)">
    <TimeGrid mode="day" :dates="days" />
  </section>
</template>

<style scoped>
.v { flex: 1; min-height: 0; display: flex; flex-direction: column; }
</style>
