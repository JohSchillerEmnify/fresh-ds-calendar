<script setup lang="ts">
/** The line in the opened slot of a dragged item: it starts at the title column of the level the item will get. */
import type { DropAim } from './useItemDrag';

defineProps<{ aim: DropAim }>();
</script>

<template>
  <li class="drop" data-testid="tasklist-drop-slot" :style="{ top: `${aim.top}px`, height: `${aim.height}px` }" aria-hidden="true">
    <span class="line" data-testid="tasklist-drop-line" :data-level="aim.level" :style="{ marginLeft: `${aim.left}px` }" />
  </li>
</template>

<style scoped>
.drop { position: absolute; left: 0; right: 0; pointer-events: none; list-style: none; display: flex; align-items: center; }
/* it starts at the title column of the level (`aim.left`, measured from the rows) */
.line { flex: 1; margin-right: 16px; height: 4px; border-radius: 2px; background: var(--md-sys-color-primary); }
</style>
