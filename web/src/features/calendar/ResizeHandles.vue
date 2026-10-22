<script setup lang="ts">
/**
 * Top and bottom resize handles of the entry that was released without moving (`ui.resizing`). Rendered inside the entry's
 * block. A handle drags at once (no long press) and previews live through `resizePreview`. While shown, a pointerdown
 * elsewhere (that tap is swallowed) or Escape hides them.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Segment } from '@/lib/items';
import { useUiStore } from '@/stores/ui';
import { finishResize, resizeEdges, resizePreview, type ResizeEdge } from './resize';

const props = defineProps<{ segment: Segment }>();
const ui = useUiStore();
const root = ref<HTMLElement | null>(null);
let active: { edge: ResizeEdge; pointerId: number; startY: number; ppm: number; delta: number } | null = null;

/** Ignores everything but the primary button / finger; the handle owns the gesture, so the card never starts a drag. */
function onDown(e: PointerEvent, edge: ResizeEdge) {
  if (active || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.stopPropagation();
  e.preventDefault();
  const el = e.currentTarget as HTMLElement;
  try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  const grid = el.closest<HTMLElement>('[data-testid="time-grid"]');
  active = { edge, pointerId: e.pointerId, startY: e.clientY, ppm: (Number(grid?.dataset.hourHeight) || 44) / 60, delta: 0 };
}

function onMove(e: PointerEvent) {
  if (!active || e.pointerId !== active.pointerId) return;
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();
  active.delta = (e.clientY - active.startY) / active.ppm;
  const s = props.segment;
  resizePreview.value = { id: s.item.id, date: s.date, ...resizeEdges(s, active.edge, active.delta) };
}

function onUp(e: PointerEvent) {
  if (!active || e.pointerId !== active.pointerId) return;
  e.stopPropagation();
  const { edge, delta } = active;
  active = null;
  void finishResize(props.segment, edge, delta);
}

function onCancel(e: PointerEvent) {
  if (!active || e.pointerId !== active.pointerId) return;
  active = null;
  resizePreview.value = null;
}

const swallowClick = (e: Event) => {
  e.stopPropagation();
  e.preventDefault();
};

/** A pointerdown outside the handles hides them; on empty grid or chrome the click that follows must not act (first tap only dismisses). */
function onDocDown(e: PointerEvent) {
  const t = e.target instanceof Element ? e.target : null;
  if (t?.closest('[data-resize-handle]')) return;
  ui.resizing = null;
  if (t?.closest('[data-testid="event-chip"],[data-testid="tasklist-card"]')) return;
  window.addEventListener('click', swallowClick, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', swallowClick, true), 500);
}
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') ui.resizing = null;
};

onMounted(() => {
  document.addEventListener('pointerdown', onDocDown, true);
  document.addEventListener('keydown', onKey, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocDown, true);
  document.removeEventListener('keydown', onKey, true);
  if (active) resizePreview.value = null;
});
</script>

<template>
  <span ref="root" class="rhs">
    <span
      v-if="segment.first" class="rh top" data-testid="resize-handle-top" data-resize-handle aria-hidden="true"
      @pointerdown="onDown($event, 'top')" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel" @click.stop.prevent
    />
    <span
      v-if="segment.last" class="rh bottom" data-testid="resize-handle-bottom" data-resize-handle aria-hidden="true"
      @pointerdown="onDown($event, 'bottom')" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel" @click.stop.prevent
    />
  </span>
</template>

<style scoped>
.rhs { display: contents; }
/* 44 px touch target, never wider than its own block (owner, 2026-10-23: a narrow side-by-side neighbour stays touchable);
   the pill is centred on the block edge, the target reaches mostly outside the block */
.rh { position: absolute; left: max(0px, calc(50% - 22px)); right: max(0px, calc(50% - 22px)); height: 44px; z-index: 6; touch-action: none; cursor: ns-resize; user-select: none; }
.rh.top { top: -33px; }
.rh.bottom { top: calc(100% - 11px); }
.rh::after {
  content: ''; position: absolute; left: 50%; width: min(28px, calc(100% - 4px)); transform: translateX(-50%); height: 8px; box-sizing: border-box; border-radius: 4px;
  background: var(--md-sys-color-primary); border: 2px solid var(--md-sys-color-surface); box-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
}
.rh.top::after { top: 29px; }
.rh.bottom::after { top: 7px; }
</style>
