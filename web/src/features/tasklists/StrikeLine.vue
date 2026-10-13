<script setup lang="ts">
/**
 * The hand-drawn line that strikes a complete task list's title through (ARCHITECTURE "Season scenes and the support
 * cat": the done state of a list). Place it inside a `position: relative` box around the title text; it spans that
 * box, a slightly wavy, slightly rising stroke in `currentColor` (`--strike-w` sets its width). With `draw` it draws
 * itself from right to left (the support cat's paw comes from the right) after `delay` ms over `duration` ms;
 * without it the line is simply there.
 */
defineProps<{ draw?: { delay: number; duration: number } | null }>();
</script>

<template>
  <svg
    class="strike-line" :class="{ draw: !!draw }" data-testid="strike-line" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false"
    :style="draw ? { '--strike-delay': `${draw.delay}ms`, '--strike-dur': `${draw.duration}ms` } : undefined"
  >
    <path d="M99.200 3.900 C86 4.600 74 5.300 60 5.100 C44 4.900 30 5.900 16 6.300 C9 6.500 4 6.600 0.800 7.200" />
  </svg>
</template>

<style scoped>
.strike-line { position: absolute; left: -2px; right: -2px; top: 8%; height: 84%; width: calc(100% + 4px); overflow: visible; pointer-events: none; }
.strike-line path {
  fill: none; stroke: currentColor; stroke-width: var(--strike-w, 1.500px); stroke-linecap: round; vector-effect: non-scaling-stroke;
}
/* drawing = revealing the line from its right end leftwards (a clip, so the stroke keeps its width while it grows) */
.strike-line.draw { animation: strike-draw var(--strike-dur) cubic-bezier(0.4, 0, 0.3, 1) var(--strike-delay) both; }
html[data-motion='off'] .strike-line.draw { animation: none; }
@keyframes strike-draw { from { clip-path: inset(-50% -4px -50% 100%); } to { clip-path: inset(-50% -4px -50% -4px); } }
</style>
