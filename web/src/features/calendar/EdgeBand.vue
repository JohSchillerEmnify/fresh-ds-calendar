<script setup lang="ts">
/**
 * The edge band while a dragged entry rests at the side of the day or week view (feature drag-to-reschedule, design A1-A3):
 * a tinted strip over the edge zone and a pill naming the day or week the view turns to.
 * Fixed to the viewport at the place `edgeBand` reports; it never takes a pointer.
 */
import { computed } from 'vue';
import { EDGE_ZONE_PX } from './edgeTurn';
import { edgeBand } from './dnd';

/** The pill sits this far above the pointer, so the finger never covers it. */
const PILL_LIFT = 56;
const style = computed(() => {
  const b = edgeBand.value;
  if (!b) return {};
  const left = b.side === 'right' ? b.right - EDGE_ZONE_PX : b.left;
  return { left: `${left}px`, top: `${b.top}px`, width: `${EDGE_ZONE_PX}px`, height: `${Math.max(0, b.bottom - b.top)}px` };
});
const pillTop = computed(() => {
  const b = edgeBand.value;
  return b ? `${Math.min(Math.max(b.y - b.top - PILL_LIFT, 8), Math.max(8, b.bottom - b.top - 40))}px` : '0px';
});
</script>

<template>
  <div v-if="edgeBand" class="band" :class="edgeBand.side" data-testid="drag-edge-band" :data-side="edgeBand.side" :style="style" aria-live="polite">
    <span class="pill" :style="{ top: pillTop }">{{ edgeBand.label }}</span>
  </div>
</template>

<style scoped>
.band {
  position: fixed; z-index: 55; pointer-events: none; box-sizing: border-box;
  background: color-mix(in srgb, var(--md-sys-color-primary) 14%, transparent);
}
.band.right { border-left: 2px solid var(--md-sys-color-primary); }
.band.left { border-right: 2px solid var(--md-sys-color-primary); }
.pill {
  position: absolute; height: 32px; padding: 0 14px; border-radius: 16px; display: flex; align-items: center; white-space: nowrap;
  background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); font: var(--md-sys-typescale-label-large); font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
}
.band.right .pill { right: calc(100% + 6px); }
.band.left .pill { left: calc(100% + 6px); }
</style>
