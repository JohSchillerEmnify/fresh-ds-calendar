<script setup lang="ts">
/**
 * The task list card grown in place over the calendar (ARCHITECTURE "Expanded task list card"): a fixed overlay teleported
 * to the body at exactly the collapsed `anchor` card's left, top and width, holding the same `TaskListCard` rendering in its
 * `grown` mode (full height, every item). It is placed by `placeExpanded` (down, up or scrolling inside, within the visible
 * scroll area), so the calendar underneath never moves. Read-only: a tap anywhere on it opens the normal list sheet. Closes on
 * Escape, the system back, a tap elsewhere or on its title, a change of view or date, or when a dialog opens (a fixed one also when a
 * scroll takes it out of sight, and so does a zoom that moves both the card and its time out of view; one inside the time grid scrolls natively with it). The focus moves in and returns to the card.
 * A time block of the week/day grid is placed in time units instead (see `timed`): teleported into its day column, its top and
 * the real layer's height come from the list's minutes and the shared `hourHeight` (as `TimeGrid` lays a block out), so it follows
 * the zoom preview and every zoom commit by construction; only grow direction and max height are measured.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ItemRendererProps } from '@/extensions/registry';
import { t } from '@/i18n';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { blockGeometry, displayTitle, neutralName } from '@/lib/items';
import { hourHeight } from '@/composables/useHourHeight';
import { useCalendarStore } from '@/stores/calendar';
import { useItemsStore } from '@/stores/items';
import { useUiStore } from '@/stores/ui';
import { anchorVisible, fitWidth, measureNatural, placeExpanded, type Box } from './expand';
import TaskListCard from './TaskListCard.vue';
import { useTaskList } from './useTaskList';

const props = defineProps<{ id: string; anchor: HTMLElement; segment: ItemRendererProps['segment']; variant: ItemRendererProps['variant'] }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
const ui = useUiStore();
const calendar = useCalendarStore();
// the system back closes the expansion first (ARCHITECTURE "Back closes overlays")
useOverlayHistory(() => true, () => emit('close'));
const panel = ref<HTMLElement | null>(null);
// A time block's card lives inside the scrolling time grid (absolute, in content coordinates), so the browser scrolls it with the
// calendar natively; anywhere else (month cells, all-day areas) it is a fixed overlay on the body.
// Week/day time grid: the block's day column (the card lives in it, positioned in time units); other time views keep the pixel placement in `.grid`.
const col = props.variant === 'block' ? props.anchor.closest<HTMLElement>('.grid > .col') : null;
const slot = props.anchor.parentElement;
const timed = !!col && !!slot?.classList.contains('blk');
const host = timed ? col : props.variant === 'block' ? props.anchor.closest<HTMLElement>('.grid') : null;
interface Pos { left: number; top: number; width: number; maxHeight: number; minHeight: number; radius: string; dir: 'down' | 'up'; upH: number }
const pos = ref<Pos | null>(null);
// the list's own time block at the current zoom (TimeGrid's geometry; the card is 1 px shorter than its `.blk`, which has a bottom gap)
const geo = computed(() => blockGeometry(props.segment.startMin, props.segment.endMin, hourHeight.value));
/** Style of a time-unit placed card: top and real height from minutes, horizontal from `fitWidth` (px inside the day column). */
const timedStyle = computed(() => {
  const p = pos.value;
  if (!p) return { visibility: 'hidden' } as const;
  // the card's measured height: the block may be drawn shorter than the minimum when the next block below clamps it (packColumns)
  const real = p.minHeight || geo.value.height - 1;
  return {
    left: p.left + 'px', width: p.width + 'px',
    top: (p.dir === 'up' ? geo.value.top + real - p.upH : geo.value.top) + 'px', maxHeight: p.maxHeight + 'px', '--min-h': real + 'px', borderRadius: p.radius, '--xr': p.radius,
  };
});
const tl = useTaskList(() => props.id, { onGone: () => emit('close') });

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
  // gone only when neither the collapsed card nor the grown one is on screen: a zoom around a point below the card moves its time up while the card stays in view
  if (!anchorVisible(a, b) && !anchorVisible(el.getBoundingClientRect(), b)) { emit('close'); return; }
  // a time block sits in a narrow side-by-side slot; grown it is only as wide as its content needs, up to its whole day column, over the neighbours (inside the column's border, with the block's 1 px inset)
  const colEl = props.variant === 'block' ? props.anchor.closest('.col') : null;
  const cr = colEl?.getBoundingClientRect();
  const box: Box = cr ? { left: cr.left + 2, right: cr.right - 1, top: a.top, bottom: a.bottom } : a;
  if (timed) {
    // only the screen dependent parts are measured: grow direction and room (the position itself is in time units, `timedStyle`)
    const fw = fitWidth({ left: a.left, width: a.width }, measureNatural(card, col!), { left: box.left, right: box.right });
    const q = placeExpanded(box, b, Math.max(card.offsetHeight, a.height));
    // style px are relative to the column's padding box
    const n: Pos = { left: Math.round(fw.left - cr!.left - col!.clientLeft), top: 0, width: fw.width, maxHeight: q.maxHeight, minHeight: a.height, radius: getComputedStyle(props.anchor).borderRadius, dir: q.dir, upH: Math.min(Math.max(card.offsetHeight, a.height), q.maxHeight) };
    const o = pos.value;
    if (!o || o.left !== n.left || o.width !== n.width || o.maxHeight !== n.maxHeight || o.minHeight !== n.minHeight || o.radius !== n.radius || o.dir !== n.dir || o.upH !== n.upH) pos.value = n;
    return;
  }
  // natural height of the grown card (the panel scrolls when it is cut to maxHeight), never less than the collapsed card
  const p = placeExpanded(box, b, props.variant === 'card' ? card.offsetHeight : Math.max(card.offsetHeight, a.height));
  const hr = host?.getBoundingClientRect();
  const n: Pos = { left: p.left - (hr?.left ?? 0), top: p.top - (hr?.top ?? 0), width: p.width, maxHeight: p.maxHeight, minHeight: props.variant === 'card' ? 0 : a.height, radius: getComputedStyle(props.anchor).borderRadius, dir: p.dir, upH: 0 };
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
    // fixed overlay only: one inside the scrolling content moves with it
    ...(host ? [] : [listen(window, 'scroll', place, { capture: true, passive: true })]),
    listen(window, 'resize', place),
  );
  if (typeof ResizeObserver !== 'undefined' && panel.value?.firstElementChild) { ro = new ResizeObserver(place); ro.observe(panel.value.firstElementChild); if (timed) ro.observe(props.anchor); }
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
// The card moved on screen (the calendar re-laid out): follow it.
watch(() => props.anchor, place);
// A zoom commit lays the blocks out again: the position follows by itself (time units), the direction and room are measured again once the new layout is in.
watch(hourHeight, () => { void nextTick(place); });

// A tap anywhere on the grown card opens the normal list sheet (ticking and editing happen there). The focus goes back to
// the card first, so the sheet remembers it as its opener.
function openList() {
  props.anchor.focus({ preventScroll: true });
  ui.revealTask(props.id);
  emit('close');
}
</script>

<template>
  <Teleport :to="host ?? 'body'">
    <div
      ref="panel" class="xc" :class="{ inGrid: !!host }" role="group" data-testid="tasklist-expanded" data-presentation="overlay" data-readonly="true"
      :data-tasklist-id="id" :data-title="tl ? displayTitle(tl) : ''" :aria-label="tl ? neutralName(tl) : t('tasks.list.fallbackLabel')"
      :style="timed ? timedStyle : pos ? { left: pos.left + 'px', top: pos.top + 'px', width: pos.width + 'px', maxHeight: pos.maxHeight + 'px', '--min-h': pos.minHeight + 'px', borderRadius: pos.radius, '--xr': pos.radius } : { visibility: 'hidden' }"
    >
      <TaskListCard :segment="segment" :variant="variant" grown :grow-dir="pos?.dir" @open-list="openList" @collapse="emit('close')" />
    </div>
  </Teleport>
</template>

<style scoped>
.xc {
  position: fixed; z-index: 40; box-sizing: border-box; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none;
  /* a filter, not a box-shadow: the card is two layers of different widths, the shadow follows their outline */
  filter: drop-shadow(0 3px 6px rgb(0 0 0 / 0.35));
}
/* inside the scrolling time grid: placed in its content coordinates */
.xc.inGrid { position: absolute; }
/* a taller list scrolls by touch or wheel, never with a visible bar */
.xc::-webkit-scrollbar { display: none; }
</style>
