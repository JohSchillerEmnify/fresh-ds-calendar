<script setup lang="ts">
/** Where a dragged item will land: a dashed outline the size of its row at the target level, with the checkbox drawn where the real one will sit; the new parent's tree line runs down to its top. */
import type { DropAim } from './useItemDrag';

defineProps<{ aim: DropAim }>();
</script>

<template>
  <li
    class="slot" data-testid="tasklist-drop-slot" :data-level="aim.level" aria-hidden="true"
    :style="{ top: `${aim.top}px`, height: `${aim.height}px`, left: `${aim.left}px`, width: `${aim.width}px` }"
  >
    <span class="ghost" data-testid="tasklist-drop-checkbox"><span class="box" /></span>
  </li>
  <li
    v-if="aim.tree" class="tree" data-testid="tasklist-drop-tree" aria-hidden="true"
    :style="{ top: `${aim.tree.top}px`, height: `${aim.tree.height}px`, left: `${aim.tree.left}px`, width: `${aim.tree.width}px` }"
  />
</template>

<style scoped>
.slot, .tree { position: absolute; pointer-events: none; list-style: none; box-sizing: border-box; }
.slot { border: 2px dashed var(--md-sys-color-outline); border-radius: var(--md-sys-shape-corner-medium); }
/* the kit checkbox's 48 px target, so the drawn box sits exactly where the real one will (the border is 2 px) */
.ghost { position: absolute; left: -9px; top: 50%; width: 48px; height: 48px; margin-top: -24px; display: flex; align-items: center; justify-content: center; }
.box { width: 18px; height: 18px; box-sizing: border-box; border: 2px solid var(--md-sys-color-outline); border-radius: var(--md-sys-shape-corner-extra-small); }
.tree { background: var(--md-sys-color-primary); border-radius: 1px; }
</style>
