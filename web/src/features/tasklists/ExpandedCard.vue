<script setup lang="ts">
/**
 * The task list card grown in place over the calendar (ARCHITECTURE "Expanded task list card"): a fixed overlay teleported
 * to the body at exactly the collapsed `anchor` card's left, top and width, holding the same `TaskListCard` rendering in its
 * `grown` mode (full height, every item). It is placed by `placeExpanded` (down, up or scrolling inside, within the visible
 * scroll area), so the calendar underneath never moves. Read-only: a tap anywhere on it opens the normal list sheet. Closes on
 * Escape, the system back, a tap elsewhere, a change of view or date, a scroll that takes the card out of sight, or when a
 * dialog opens. The focus moves in and returns to the card.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ItemRendererProps } from '@/extensions/registry';
import { t } from '@/i18n';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { displayTitle } from '@/lib/items';
import { useCalendarStore } from '@/stores/calendar';
import { useItemsStore } from '@/stores/items';
import { useUiStore } from '@/stores/ui';
import { anchorVisible, placeExpanded, type Box } from './expand';
import TaskListCard from './TaskListCard.vue';

const props = defineProps<{ id: string; anchor: HTMLElement; segment: ItemRendererProps['segment']; variant: ItemRendererProps['variant'] }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
const ui = useUiStore();
const calendar = useCalendarStore();
// the system back closes the expansion first (ARCHITECTURE "Back closes overlays")
useOverlayHistory(() => true, () => emit('close'));
const panel = ref<HTMLElement | null>(null);
const pos = ref<{ left: number; top: number; width: number; maxHeight: number; minHeight: number; radius: string; dir: 'down' | 'up' } | null>(null);
const tl = computed(() => {
  const i = items.get(props.id);
  return i?.kind === 'tasklist' ? i : null;
});

// The nearest scrolling ancestor of the card, cut to the viewport: the area the expansion must stay in.
function bounds(): Box {
  const vp: Box = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  for (let n = props.anchor.parentElement; n && n !== document.body; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) {
      const r = n.getBoundingClientRect();
      return { left: Math.max(vp.left, r.left), top: Math.max(vp.top, r.top), right: Math.min(vp.right, r.right), bottom: Math.min(vp.bottom, r.bottom) };
    }
  }
  return vp;
}
function place() {
  const el = panel.value;
  const card = el?.firstElementChild as HTMLElement | null;
  if (!el || !card || !props.anchor.isConnected) return;
  const a = props.anchor.getBoundingClientRect();
  const b = bounds();
  if (!anchorVisible(a, b)) { emit('close'); return; }
  // natural height of the grown card (the panel scrolls when it is cut to maxHeight), never less than the collapsed card
  const p = placeExpanded(a, b, Math.max(card.offsetHeight, a.height));
  const n = { left: p.left, top: p.top, width: p.width, maxHeight: p.maxHeight, minHeight: a.height, radius: getComputedStyle(props.anchor).borderRadius, dir: p.dir };
  const o = pos.value;
  if (!o || o.left !== n.left || o.top !== n.top || o.width !== n.width || o.maxHeight !== n.maxHeight || o.minHeight !== n.minHeight || o.radius !== n.radius || o.dir !== n.dir) pos.value = n;
}

let stops: Disposer[] = [];
let ro: ResizeObserver | null = null;
onMounted(() => {
  ui.setPanel('expanded-task-card', true);
  place();
  void nextTick(() => (panel.value?.querySelector('button') as HTMLElement | null)?.focus({ preventScroll: true }));
  stops.push(
    listen(document, 'keydown', (e) => { if (e.key === 'Escape') emit('close'); }),
    // capture: a tap elsewhere closes, while the tapped control still does its own thing; the close waits until that control's
    // own handler ran, so a navigation it starts lands before the overlay's history entry is given back
    listen(document, 'click', (e) => {
      const target = e.target as Node | null;
      if (target && !panel.value?.contains(target) && !props.anchor.contains(target)) stops.push(appTimeout(() => emit('close'), 0));
    }, { capture: true }),
    listen(window, 'scroll', place, { capture: true, passive: true }),
    listen(window, 'resize', place),
  );
  if (typeof ResizeObserver !== 'undefined' && panel.value?.firstElementChild) { ro = new ResizeObserver(place); ro.observe(panel.value.firstElementChild); }
});
onBeforeUnmount(() => {
  stops.forEach((s) => s());
  stops = [];
  ro?.disconnect();
  ui.setPanel('expanded-task-card', false);
  // give the focus back to the card, unless the person already moved on to something else
  const active = document.activeElement;
  if ((!active || active === document.body || panel.value?.contains(active)) && props.anchor.isConnected) props.anchor.focus({ preventScroll: true });
});

// Another period or view, or a dialog opening over it, ends the expansion.
watch(() => [calendar.view, calendar.anchor.getTime()], () => emit('close'));
watch(() => ui.dialog, (d) => { if (d) emit('close'); });
// The list vanished (deleted here or elsewhere).
watch(tl, (now, before) => { if (before && !now) emit('close'); });
// The card moved on screen (the calendar re-laid out): follow it.
watch(() => props.anchor, place);

// A tap anywhere on the grown card opens the normal list sheet (ticking and editing happen there). The focus goes back to
// the card first, so the sheet remembers it as its opener.
function openList() {
  props.anchor.focus({ preventScroll: true });
  ui.openDialog('tasklist-expanded', { id: props.id });
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="panel" class="xc" role="group" data-testid="tasklist-expanded" data-presentation="overlay" data-readonly="true"
      :data-tasklist-id="id" :data-title="tl ? displayTitle(tl) : ''" :aria-label="tl ? displayTitle(tl) : t('tasks.list.fallbackLabel')"
      :style="pos ? { left: pos.left + 'px', top: pos.top + 'px', width: pos.width + 'px', maxHeight: pos.maxHeight + 'px', '--min-h': pos.minHeight + 'px', borderRadius: pos.radius, '--xr': pos.radius } : { visibility: 'hidden' }"
    >
      <TaskListCard :segment="segment" :variant="variant" grown :grow-dir="pos?.dir" @open-list="openList" />
    </div>
  </Teleport>
</template>

<style scoped>
.xc {
  position: fixed; z-index: 40; box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain;
  /* a filter, not a box-shadow: the card is two layers of different widths, the shadow follows their outline */
  filter: drop-shadow(0 3px 6px rgb(0 0 0 / 0.35));
}
</style>
