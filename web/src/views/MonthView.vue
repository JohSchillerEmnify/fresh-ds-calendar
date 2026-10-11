<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { isSameMonth, isToday } from 'date-fns';
import { monthGrid, routePath, toIsoDate, WEEKDAY_LABELS } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';

const store = useCalendarStore();
const router = useRouter();
const weeks = computed(() => monthGrid(store.anchor));
</script>

<template>
  <section class="month" data-testid="month-view">
    <div class="weekdays">
      <div v-for="w in WEEKDAY_LABELS" :key="w" class="wd" data-testid="weekday-header">{{ w }}</div>
    </div>
    <div class="grid" :style="{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }">
      <template v-for="(week, wi) in weeks" :key="wi">
        <button
          v-for="day in week"
          :key="toIsoDate(day)"
          class="cell"
          :class="{ outside: !isSameMonth(day, store.anchor), today: isToday(day) }"
          :data-testid="`month-cell-${toIsoDate(day)}`"
          :data-date="toIsoDate(day)"
          @click="router.push(routePath('day', day))"
        >
          <span class="num">{{ day.getDate() }}</span>
        </button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.month { flex: 1; display: flex; flex-direction: column; min-height: calc(100dvh - var(--topbar-h) - var(--tabbar-h) - var(--safe-top) - var(--safe-bottom)); }
.weekdays { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--border); }
.wd { text-align: center; font-size: 11px; font-weight: 500; color: var(--text-2); padding: 6px 0; text-transform: uppercase; }
.grid { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); }
.cell {
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  padding-top: 4px; min-height: 64px;
  border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);
}
.cell:nth-child(7n) { border-right: 0; }
.cell:hover { background: var(--surface-2); }
.num { width: 24px; height: 24px; line-height: 24px; border-radius: 50%; font-size: 12px; font-weight: 500; text-align: center; }
.outside .num { color: var(--text-2); opacity: 0.7; }
.today .num { background: var(--today-bg); color: var(--accent-contrast); }
</style>
