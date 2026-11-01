<script setup lang="ts">
/**
 * The Christmas part of the living scene layer (feature theme-scenes): a snowy ground,
 * and a timeline across the bar: four big Advent candles in equal spacing (left to right) and the Christmas tree at
 * the right end. What burns depends on the app's date (`christmasState`): during Advent the candles are lit one per
 * Advent Sunday and the tree is dark, from 24 December (and when the scene is picked by hand on another date) all
 * four candles burn and the tree lights are on. Everything sits low and soft so the bar's title and buttons stay legible.
 */
import { computed } from 'vue';
import { useClockStore } from '@/stores/clock';
import { christmasState } from '@/theme/holidays';
import AdventCandle from './AdventCandle.vue';
import XmasTree from './XmasTree.vue';

const clock = useClockStore();
/** Where the candles stand (percent from the left, centre of the candle); the tree follows at the end. */
const CANDLES = [5, 15, 25, 35];
const state = computed(() => christmasState(clock.today));
</script>

<template>
  <div class="xmas" aria-hidden="true">
    <svg class="snow" data-part="snow" viewBox="0 0 400 16" preserveAspectRatio="none" focusable="false">
      <path d="M0 16 L0 10 C50 5 90 8 140 9.500 C200 11 250 5 310 7 C350 8.500 380 6 400 7 L400 16 Z" />
    </svg>
    <AdventCandle v-for="(x, i) in CANDLES" :key="i" :lit="i < state.candles" :delay="i * 0.45" :style="{ left: `calc(${x}% - min(12cqh, 8px))` }" />
    <XmasTree class="at tree" :lights="state.lights" />
  </div>
</template>

<style scoped>
.xmas { position: absolute; inset: 0; pointer-events: none; }
.snow { position: absolute; left: 0; bottom: 0; width: 100%; height: min(18cqh, 12px); }
.snow path { fill: color-mix(in oklab, #fff 88%, var(--md-sys-color-primary-container, #dfe)); }
.at { position: absolute; bottom: 1px; width: auto; }
.tree { left: calc(87% - min(26cqh, 18px)); height: min(80cqh, 56px); opacity: 0.85; }
</style>
