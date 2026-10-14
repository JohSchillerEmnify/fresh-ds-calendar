<script setup lang="ts">
/**
 * One sticky note on the Canvas (ARCHITECTURE "Canvas"): a card in the category colour with a grip strip (the date, when
 * the list has one) above the tray's own `TaskListView` in its compact form, so ticking, the celebration and the support
 * cat are the existing code. The note only draws where it is told to (`transform`); picking it up and saving its place
 * belong to the canvas.
 */
import { computed } from 'vue';
import type { TaskList } from '@/api/types';
import { displayTitle } from '@/lib/items';
import { NOTE_W, noteDateLabel } from './canvas';
import { useTaskCategories } from './categories';
import TaskListView from './TaskListView.vue';

const props = defineProps<{
  list: TaskList;
  x: number;
  y: number;
  /** Stacking order among the notes. */
  z: number;
  /** Whether the list has a place of its own (false = in the Unsorted stack). */
  placed: boolean;
  /** Name of the area the note lies in, empty for none. */
  area: string;
  dragging: boolean;
  /** The Tasks filter does not match: drawn faint and out of reach (A-140). */
  dimmed: boolean;
}>();
const emit = defineEmits<{ completed: [catMs: number] }>();

const cats = useTaskCategories();
const style = computed(() => ({ transform: `translate3d(${props.x}px, ${props.y}px, 0)`, zIndex: props.z, width: `${NOTE_W}px`, '--c': cats.color(props.list) }));
</script>

<template>
  <article
    class="note" data-testid="canvas-note" data-canvas-drag="note" :data-canvas-id="list.id" :data-tasklist-id="list.id" :data-title="displayTitle(list)"
    :data-date="list.date ?? ''" :data-x="Math.round(x)" :data-y="Math.round(y)" :data-placed="placed" :data-area="area" :data-dimmed="dimmed" :data-dragging="dragging || undefined" :style="style"
  >
    <div class="grip" data-testid="canvas-note-grip">
      <span class="dots" aria-hidden="true" />
      <span v-if="list.date" class="date" data-testid="canvas-note-date" :data-date="list.date">{{ noteDateLabel(list.date) }}</span>
    </div>
    <TaskListView :id="list.id" :list="list" title-opens-dialog compact class="view" @completed="emit('completed', $event)" />
  </article>
</template>

<style scoped>
.note {
  position: absolute; left: 0; top: 0; box-sizing: border-box; border-radius: 14px; border-top: 6px solid var(--c);
  border-inline: 1px solid var(--md-sys-color-outline-variant); border-bottom: 1px solid var(--md-sys-color-outline-variant);
  background: color-mix(in srgb, var(--c) 14%, var(--md-sys-color-surface-container-highest)); box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
  cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
}
/* the lift of a picked-up note and the way back after a failed save: transitions only with motion on */
html:not([data-motion='off']) .note { transition: transform 200ms var(--md-sys-motion-spring, ease-out), box-shadow 150ms, opacity 150ms; }
.note[data-dimmed='true'] { opacity: 0.25; pointer-events: none; }
.note[data-dragging] { cursor: grabbing; box-shadow: 0 8px 20px rgb(0 0 0 / 0.4); transition: none !important; }
.grip { display: flex; align-items: center; justify-content: space-between; min-height: 24px; padding: 0 10px; }
.dots { width: 28px; height: 6px; border-radius: 3px; background: color-mix(in srgb, currentColor 30%, transparent); }
.date { font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.view { padding: 0 10px 8px; }
/* the global `button { touch-action: manipulation }` lets the browser pan the page from a button, which cancels the long press that picks the note up */
.note :deep(*) { touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
/* the compact list view is smaller than the tray's */
.view :deep(.name) { font: var(--md-sys-typescale-title-medium); min-height: 36px; }
.view :deep(.head) { padding-top: 0; gap: 8px; }
.view :deep(.row) { min-height: 40px; }
</style>
