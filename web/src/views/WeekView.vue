<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { format, isToday } from 'date-fns';
import { HOURS, hourLabel, routePath, toIsoDate, weekDays } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';

const store = useCalendarStore();
const router = useRouter();
const days = computed(() => weekDays(store.anchor));
</script>

<template>
  <section class="week" data-testid="week-view">
    <div class="head">
      <div class="gutter" />
      <button
        v-for="d in days"
        :key="toIsoDate(d)"
        class="dayhead"
        :class="{ today: isToday(d) }"
        :data-testid="`week-day-${toIsoDate(d)}`"
        @click="router.push(routePath('day', d))"
      >
        <span class="dow">{{ format(d, 'EEE') }}</span>
        <span class="num">{{ d.getDate() }}</span>
      </button>
    </div>
    <div class="body">
      <div v-for="h in HOURS" :key="h" class="row" :data-testid="`week-hour-${h}`">
        <div class="gutter hour">{{ h === 0 ? '' : hourLabel(h) }}</div>
        <div v-for="d in days" :key="toIsoDate(d)" class="slot" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.week { display: flex; flex-direction: column; }
.head, .row { display: grid; grid-template-columns: 40px repeat(7, 1fr); }
.head { position: sticky; top: calc(var(--topbar-h) + var(--safe-top)); background: var(--surface); z-index: 5; border-bottom: 1px solid var(--border); }
.dayhead { display: flex; flex-direction: column; align-items: center; padding: 6px 0; gap: 2px; }
.dow { font-size: 11px; font-weight: 500; color: var(--text-2); text-transform: uppercase; }
.num { width: 30px; height: 30px; line-height: 30px; border-radius: 50%; font-size: 18px; text-align: center; }
.today .dow { color: var(--accent); }
.today .num { background: var(--today-bg); color: var(--accent-contrast); }
.row { height: 48px; }
.hour { font-size: 10px; color: var(--text-2); text-align: right; padding-right: 4px; transform: translateY(-6px); }
.slot { border-left: 1px solid var(--border); border-bottom: 1px solid var(--border); }
</style>
