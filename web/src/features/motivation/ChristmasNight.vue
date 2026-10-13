<script setup lang="ts">
/**
 * The Christmas part of the living scene layer (ARCHITECTURE "Holiday themes and Automatic follows"): a snowy ground,
 * the Christmas tree on the LEFT and the Advent wreath. What burns depends on the app's date (`christmasState`):
 * during Advent the candles are lit one per Advent Sunday and the tree is dark, from 24 December (and when the scene
 * is picked by hand on another date) the tree lights are on and all four candles burn.
 */
import { computed } from 'vue';
import { useClockStore } from '@/stores/clock';
import { christmasState } from '@/theme/holidays';
import AdventWreath from './AdventWreath.vue';
import XmasTree from './XmasTree.vue';

const clock = useClockStore();
const state = computed(() => christmasState(clock.today));
</script>

<template>
  <div class="xmas" aria-hidden="true">
    <svg class="snow" viewBox="0 0 400 16" preserveAspectRatio="none" focusable="false">
      <path d="M0 16 L0 10 C50 5 90 8 140 9.500 C200 11 250 5 310 7 C350 8.500 380 6 400 7 L400 16 Z" />
    </svg>
    <XmasTree class="at tree" :lights="state.lights" />
    <AdventWreath class="at wreath" :candles="state.candles" />
  </div>
</template>

<style scoped>
.xmas { position: absolute; inset: 0; pointer-events: none; }
.snow { position: absolute; left: 0; bottom: 0; width: 100%; height: min(18cqh, 12px); }
.snow path { fill: color-mix(in oklab, #fff 88%, var(--md-sys-color-primary-container, #dfe)); }
.at { position: absolute; bottom: 1px; width: auto; }
.tree { left: 2%; height: min(88cqh, 62px); }
.wreath { left: 72%; height: min(58cqh, 40px); }
</style>
