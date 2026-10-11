<script setup lang="ts">
import { computed } from 'vue';
import { format, isToday } from 'date-fns';
import { HOURS, hourLabel } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';

const store = useCalendarStore();
const d = computed(() => store.anchor);
</script>

<template>
  <section class="day" data-testid="day-view">
    <div class="head" :class="{ today: isToday(d) }">
      <span class="dow">{{ format(d, 'EEE') }}</span>
      <span class="num" data-testid="day-number">{{ d.getDate() }}</span>
    </div>
    <div class="body">
      <div v-for="h in HOURS" :key="h" class="row" :data-testid="`day-hour-${h}`">
        <div class="hour">{{ h === 0 ? '' : hourLabel(h) }}</div>
        <div class="slot" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.head { display: flex; flex-direction: column; align-items: flex-start; padding: 8px 0 8px 52px; border-bottom: 1px solid var(--border); }
.dow { font-size: 11px; font-weight: 500; color: var(--text-2); text-transform: uppercase; }
.num { width: 40px; height: 40px; line-height: 40px; border-radius: 50%; font-size: 24px; text-align: center; margin-left: -8px; }
.today .dow { color: var(--accent); }
.today .num { background: var(--today-bg); color: var(--accent-contrast); }
.row { display: grid; grid-template-columns: 48px 1fr; height: 48px; }
.hour { font-size: 10px; color: var(--text-2); text-align: right; padding-right: 8px; transform: translateY(-6px); }
.slot { border-left: 1px solid var(--border); border-bottom: 1px solid var(--border); }
</style>
