<script setup lang="ts">
/** The gap a dragged item fills when it will be a subtask: indented to its level, with the line of that level. */
import type { SubtaskLines } from '@/api/types';
import { gapLines } from './subtaskLines';
import type { DropAim } from './useItemDrag';

defineProps<{ aim: DropAim; lines: SubtaskLines }>();
</script>

<template>
  <li class="gap" data-testid="tasklist-drop-gap" :data-level="aim.level" :style="{ top: `${aim.top}px`, height: `${aim.height}px`, '--lvl': aim.level }" aria-hidden="true">
    <i v-for="ln in gapLines(aim.level, lines)" :key="`${ln.kind}${ln.col}`" class="ln" :class="`ln-${ln.kind}`" :data-end="ln.end" :style="{ '--col': ln.col }" />
    <span class="gap-box" />
  </li>
</template>

<style scoped>
.gap { position: absolute; left: 0; right: 0; pointer-events: none; list-style: none; }
.gap-box { position: absolute; inset: 3px 4px 3px calc(4px + var(--lvl) * 28px); border-radius: 12px; border: 2px dashed color-mix(in srgb, var(--md-sys-color-primary) 55%, transparent); }
</style>
