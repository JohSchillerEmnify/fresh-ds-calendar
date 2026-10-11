<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { periodLabel, routePath, shiftPeriod } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';
import IconPrev from '~icons/material-symbols/chevron-left-rounded';
import IconNext from '~icons/material-symbols/chevron-right-rounded';

const store = useCalendarStore();
const router = useRouter();
const label = computed(() => periodLabel(store.view, store.anchor));

function go(dir: 1 | -1) {
  router.push(routePath(store.view, shiftPeriod(store.view, store.anchor, dir)));
}
function today() {
  router.push(routePath(store.view, new Date()));
}
</script>

<template>
  <header class="topbar" data-testid="top-bar">
    <div class="brand" data-testid="app-title">Calendar</div>
    <h1 class="period" data-testid="period-label">{{ label }}</h1>
    <div class="actions">
      <button class="today" data-testid="nav-today" @click="today">Today</button>
      <button class="icon-btn" aria-label="Previous" data-testid="nav-prev" @click="go(-1)">
        <IconPrev aria-hidden="true" />
      </button>
      <button class="icon-btn" aria-label="Next" data-testid="nav-next" @click="go(1)">
        <IconNext aria-hidden="true" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 8px;
  height: calc(var(--topbar-h) + var(--safe-top));
  padding: var(--safe-top) 8px 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.brand { display: none; font-size: 22px; color: var(--text-2); margin-right: 16px; }
.period {
  flex: 1; min-width: 0; margin: 0;
  font-size: 20px; font-weight: 400;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.actions { display: flex; align-items: center; gap: 2px; }
.today {
  height: 36px; padding: 0 12px; margin-right: 4px;
  border: 1px solid var(--border); border-radius: 18px;
  font-size: 14px; font-weight: 500;
}
.today:hover { background: var(--surface-2); }
@media (min-width: 720px) { .brand { display: block; } }
</style>
