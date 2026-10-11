<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { periodLabel, routePath, shiftPeriod } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';

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
        <svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z" /></svg>
      </button>
      <button class="icon-btn" aria-label="Next" data-testid="nav-next" @click="go(1)">
        <svg viewBox="0 0 24 24"><path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z" /></svg>
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
