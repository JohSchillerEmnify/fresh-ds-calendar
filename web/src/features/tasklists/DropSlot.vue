<script setup lang="ts">
/** Where a dragged item will land: a dashed outline the size of its row at the target level, with the kit checkbox drawn faintly where the real one will sit; the new parent's tree line runs down to it. */
import Checkbox from '@/components/m3/Checkbox.vue';
import type { DropAim } from './useItemDrag';

defineProps<{ aim: DropAim }>();
</script>

<template>
  <li
    class="slot" data-testid="tasklist-drop-slot" :data-level="aim.level" :data-title="aim.title" aria-hidden="true"
    :style="{ top: `${aim.top}px`, height: `${aim.height}px`, left: `${aim.left}px`, width: `${aim.width}px` }"
  >
    <!-- the slot's border is 2 px: the box is placed from the padding edge -->
    <Checkbox class="ghost" :model-value="false" disabled data-testid="tasklist-drop-checkbox" :style="{ left: `${aim.ghostX - 2}px` }" />
  </li>
  <li
    v-if="aim.tree" class="tree" data-testid="tasklist-drop-tree" aria-hidden="true"
    :style="{ top: `${aim.tree.top}px`, height: `${aim.tree.height}px`, left: `${aim.tree.left}px`, width: `${aim.tree.width}px` }"
  />
</template>

<style scoped>
.slot, .tree { position: absolute; pointer-events: none; list-style: none; box-sizing: border-box; }
.slot { border: 2px dashed var(--md-sys-color-outline); border-radius: var(--md-sys-shape-corner-medium); }
.ghost { position: absolute; top: 50%; margin-top: -24px; }
.tree { background: var(--md-sys-color-primary); border-radius: var(--md-sys-shape-corner-extra-small); }
</style>
