<script setup lang="ts">
import { useRouter } from 'vue-router';
import { routePath, VIEWS, type ViewKind } from '@/lib/dates';
import { useCalendarStore } from '@/stores/calendar';

const store = useCalendarStore();
const router = useRouter();
const labels: Record<ViewKind, string> = { month: 'Month', week: 'Week', day: 'Day' };
const icons: Record<ViewKind, string> = {
  month: 'M3 5h18v16H3zm2 4v10h14V9zm1 2h3v3H6zm5 0h3v3h-3zm5 0h2v3h-2zm-10 5h3v2H6zm5 0h3v2h-3z',
  week: 'M3 5h18v16H3zm2 4v10h2V9zm4 0v10h2V9zm4 0v10h2V9zm4 0v10h2V9z',
  day: 'M3 5h18v16H3zm2 4v10h14V9zm2 2h10v2H7zm0 4h7v2H7z',
};

function select(v: ViewKind) {
  router.push(routePath(v, store.anchor));
}
</script>

<template>
  <nav class="tabs" data-testid="bottom-tabs">
    <button
      v-for="v in VIEWS"
      :key="v"
      class="tab"
      :class="{ active: store.view === v }"
      :aria-current="store.view === v ? 'page' : undefined"
      :data-testid="`tab-${v}`"
      @click="select(v)"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="icons[v]" /></svg>
      <span>{{ labels[v] }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tabs {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
  display: flex;
  height: calc(var(--tabbar-h) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: var(--surface);
  border-top: 1px solid var(--border);
}
.tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  font-size: 12px; font-weight: 500; color: var(--text-2);
}
.tab svg { width: 24px; height: 24px; fill: currentColor; padding: 0 16px; box-sizing: content-box; border-radius: 12px; }
.tab.active { color: var(--accent); }
.tab.active svg { background: var(--accent-soft); }
</style>
