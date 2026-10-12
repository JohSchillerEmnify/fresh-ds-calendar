<script setup lang="ts">
import { computed } from 'vue';
import type { CalendarEvent } from '@/api/types';
import { useClockStore } from '@/stores/clock';
import { useItemsStore } from '@/stores/items';

const WINDOW_MIN = 180;
const clock = useClockStore();
const items = useItemsStore();

/** The next timed event starting within the window, with whole minutes until it starts. */
const next = computed(() => {
  const now = clock.nowTick;
  let best: { ev: CalendarEvent; minutes: number } | null = null;
  for (const it of items.all) {
    if (it.kind !== 'event' || it.allDay) continue;
    const minutes = Math.floor((Date.parse(it.start) - now) / 60000);
    if (minutes < 0 || minutes > WINDOW_MIN) continue;
    if (!best || minutes < best.minutes) best = { ev: it, minutes };
  }
  return best;
});
</script>

<template>
  <div class="approach" data-testid="approach-bar" role="group" aria-label="Next three hours">
    <span class="now" data-testid="approach-now" />
    <span class="line" />
    <span
      v-if="next"
      class="item"
      data-testid="approach-item"
      :data-title="next.ev.title"
      :data-minutes="next.minutes"
      :style="{ left: `${(next.minutes / WINDOW_MIN) * 100}%`, '--c': next.ev.color }"
    >
      <span class="dot" />
      <span class="label">{{ next.ev.title }}</span>
    </span>
  </div>
</template>

<style scoped>
.approach { position: relative; height: 28px; margin: 0 16px; flex: none; }
.line { position: absolute; left: 0; right: 0; top: 50%; height: 2px; border-radius: 1px; background: var(--md-sys-color-outline-variant); }
.now { position: absolute; left: 0; top: 50%; width: 10px; height: 10px; transform: translateY(-50%); border-radius: 50%; background: var(--md-sys-color-primary); z-index: 1; }
.item { position: absolute; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 6px; max-width: calc(100% - 20px); transition: left 300ms ease; }
.dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--c, var(--md-sys-color-secondary)); }
.label { font: var(--md-sys-typescale-label-small, 500 11px/16px sans-serif); color: var(--md-sys-color-on-surface-variant); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
