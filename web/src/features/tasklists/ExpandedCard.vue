<script setup lang="ts">
/**
 * The task list card grown in place over the calendar (feature tasklists-expand-card): a fixed overlay teleported
 * to the body at exactly the collapsed `anchor` card's left, top and width, holding the same `TaskListCard` rendering in its
 * `grown` mode (full height, every item). It is placed by `placeExpanded` (down, up or scrolling inside, within the visible
 * scroll area), so the calendar underneath never moves. Read-only: a tap anywhere on it opens the normal list sheet (it stays grown
 * behind it). Only its title collapses it; Escape, taps elsewhere, a sheet opening, a scroll or a zoom leave it grown (a fixed one is
 * only hidden while its card is out of sight; one inside the time grid scrolls natively with it). It is remembered on the device
 * (`ui.expandedCards`, several at once), so a change of view or date, the system back or a reload only unmount it with its card.
 * Grown cards that overlap are drawn later-in-time on top; a tap on one that another covers brings it to the front instead of opening
 * the sheet. The focus moves in and returns to the card.
 * A time block of the week/day grid is placed in time units instead (see `timed`): teleported into its day column, its top and
 * the real layer's height come from the list's minutes and the shared `hourHeight` (as `TimeGrid` lays a block out), so it follows
 * the zoom preview and every zoom commit by construction; only grow direction and max height are measured.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ItemRendererProps } from '@/extensions/registry';
import { t } from '@/i18n';
import { listen, type Disposer } from '@/lib/timers';
import { blockGeometry, displayTitle, neutralName, TITLE_ROW_PX } from '@/lib/items';
import { useEffectiveHourHeight } from '@/composables/useHourHeight';
import { useItemsStore } from '@/stores/items';
import { useUiStore } from '@/stores/ui';
import { anchorVisible, clipAboveBar, fitWidth, grownStarts, layerOf, measureNatural, placeExpanded, type Box } from './expand';
import TaskListCard from './TaskListCard.vue';
import { useTaskList } from './useTaskList';

const props = defineProps<{ id: string; anchor: HTMLElement; segment: ItemRendererProps['segment']; variant: ItemRendererProps['variant'] }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
const ui = useUiStore();
const panel = ref<HTMLElement | null>(null);
// follows the host grid's hour height: the shared zoom height normally, a fit grid's own height in the two-row overview
const hourHeight = useEffectiveHourHeight();
// A time block's card lives inside the scrolling time grid (absolute, in content coordinates), so the browser scrolls it with the
// calendar natively; anywhere else (month cells, all-day areas) it is a fixed overlay on the body.
// Week/day time grid: the block's day column (the card lives in it, positioned in time units); other time views keep the pixel placement in `.grid`.
const col = props.variant === 'block' ? props.anchor.closest<HTMLElement>('.grid > .col') : null;
const slot = props.anchor.parentElement;
const timed = !!col && !!slot?.classList.contains('blk');
const host = timed ? col : props.variant === 'block' ? props.anchor.closest<HTMLElement>('.grid') : null;
interface Pos { left: number; top: number; width: number; maxHeight: number; minHeight: number; radius: string; dir: 'down' | 'up'; upH: number }
const pos = ref<Pos | null>(null);
/** The collapsed card is out of sight (scrolled or zoomed away): the grown card stays remembered but is not drawn. */
const away = ref(false);
const cardKey = () => ({ id: props.id, date: props.segment.date });
/** Later in time on top (all below the sheet's layer), the card tapped last above them all. */
const layerKey = `${props.id}|${props.segment.date}`;
const layer = computed(() => layerOf(layerKey, ui.isFront(cardKey())));
// the list's own time block at the current zoom (TimeGrid's geometry; the card is 1 px shorter than its `.blk`, which has a bottom gap)
const geo = computed(() => blockGeometry(props.segment.startMin, props.segment.endMin, hourHeight.value, 0));
/** Style of a time-unit placed card: top and real height from minutes, horizontal from `fitWidth` (px inside the day column). */
const timedStyle = computed(() => {
  const p = pos.value;
  if (!p || away.value) return { visibility: 'hidden' } as const;
  // the card's measured height (its real length), but the grown pill always keeps one readable title row
  const real = Math.max(TITLE_ROW_PX, p.minHeight || geo.value.height - 1);
  return {
    left: p.left + 'px', width: p.width + 'px',
    zIndex: layer.value,
    top: (p.dir === 'up' ? geo.value.top + real - p.upH : geo.value.top) + 'px', maxHeight: p.maxHeight + 'px', '--min-h': real + 'px', borderRadius: p.radius, '--xr': p.radius,
  };
});
const tl = useTaskList(() => props.id, { onGone: () => emit('close') });

// The nearest scrolling ancestor of the card, cut to the viewport: the area the expansion must stay in.
function bounds(): Box {
  const vp: Box = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  for (let n = props.anchor.parentElement; n && n !== document.body; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    // a fit-mode grid clips instead of scrolling (`overflow: hidden`), so its area bounds the expansion just the same
    if ((o === 'auto' || o === 'scroll' || n.hasAttribute('data-scroll-area')) && n.scrollHeight > n.clientHeight) {
      const r = n.getBoundingClientRect();
      return { left: Math.max(vp.left, r.left), top: Math.max(vp.top, r.top), right: Math.min(vp.right, r.right), bottom: Math.min(vp.bottom, r.bottom) };
    }
  }
  return vp;
}
// The bottom bar floats over the calendar on a phone: the grid continues under it, so its rect is no room for the card.
function barBox(): Box | null {
  const bar = document.querySelector<HTMLElement>('[data-testid="bottom-bar"][data-position="bottom"]');
  return bar ? bar.getBoundingClientRect() : null;
}
function place() {
  const el = panel.value;
  const card = el?.firstElementChild as HTMLElement | null;
  if (!el || !card || !props.anchor.isConnected) return;
  const a = props.anchor.getBoundingClientRect();
  const b = bounds();
  // room for the card stops at the floating bar; visibility of the anchor still counts the area under it
  const room = clipAboveBar(b, barBox());
  // gone only when neither the collapsed card nor the grown one is on screen: a zoom around a point below the card moves its time up while the card stays in view
  away.value = !anchorVisible(a, b) && !anchorVisible(el.getBoundingClientRect(), b);
  if (away.value) return;
  // a time block sits in a narrow side-by-side slot; grown it is only as wide as its content needs, up to its whole day column, over the neighbours (inside the column's border, with the block's 1 px inset)
  const colEl = props.variant === 'block' ? props.anchor.closest('.col') : null;
  const cr = colEl?.getBoundingClientRect();
  const box: Box = cr ? { left: cr.left + 2, right: cr.right - 1, top: a.top, bottom: a.bottom } : a;
  if (timed) {
    // only the screen dependent parts are measured: grow direction and room (the position itself is in time units, `timedStyle`)
    const fw = fitWidth({ left: a.left, width: a.width }, measureNatural(card, col!), { left: box.left, right: box.right });
    const q = placeExpanded(box, room, Math.max(card.offsetHeight, a.height));
    // style px are relative to the column's padding box
    const n: Pos = { left: Math.round(fw.left - cr!.left - col!.clientLeft), top: 0, width: fw.width, maxHeight: q.maxHeight, minHeight: a.height, radius: getComputedStyle(props.anchor).borderRadius, dir: q.dir, upH: Math.min(Math.max(card.offsetHeight, a.height), q.maxHeight) };
    const o = pos.value;
    if (!o || o.left !== n.left || o.width !== n.width || o.maxHeight !== n.maxHeight || o.minHeight !== n.minHeight || o.radius !== n.radius || o.dir !== n.dir || o.upH !== n.upH) pos.value = n;
    return;
  }
  // natural height of the grown card (the panel scrolls when it is cut to maxHeight), never less than the collapsed card
  const p = placeExpanded(box, room, props.variant === 'card' ? card.offsetHeight : Math.max(card.offsetHeight, a.height));
  const hr = host?.getBoundingClientRect();
  const n: Pos = { left: p.left - (hr?.left ?? 0), top: p.top - (hr?.top ?? 0), width: p.width, maxHeight: p.maxHeight, minHeight: props.variant === 'card' ? 0 : a.height, radius: getComputedStyle(props.anchor).borderRadius, dir: p.dir, upH: 0 };
  const o = pos.value;
  if (!o || o.left !== n.left || o.top !== n.top || o.width !== n.width || o.maxHeight !== n.maxHeight || o.minHeight !== n.minHeight || o.radius !== n.radius || o.dir !== n.dir) pos.value = n;
}

const panelName = `expanded-task-card-${props.id}-${props.segment.date}`;
let stops: Disposer[] = [];
let ro: ResizeObserver | null = null;
onMounted(() => {
  ui.setPanel(panelName, true);
  place();
  void nextTick(() => (panel.value?.querySelector('button') as HTMLElement | null)?.focus({ preventScroll: true }));
  stops.push(
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
  ui.setPanel(panelName, false);
  grownStarts.delete(layerKey);
  // give the focus back to the card, unless the person already moved on to something else
  const active = document.activeElement;
  if ((!active || active === document.body || panel.value?.contains(active)) && props.anchor.isConnected) props.anchor.focus({ preventScroll: true });
});

// The card moved on screen (the calendar re-laid out): follow it.
watch(() => props.anchor, place);
// editing the list's time behind its sheet re-orders the stack
watch(() => props.segment.startMin, (m) => grownStarts.set(layerKey, m), { immediate: true });
// A zoom commit lays the blocks out again: the position follows by itself (time units), the direction and room are measured again once the new layout is in.
watch(hourHeight, () => { void nextTick(place); });

/** Another grown card is drawn above this one where they overlap. */
function covered(): boolean {
  const mine = panel.value?.getBoundingClientRect();
  if (!mine) return false;
  const z = (e: Element) => Number(getComputedStyle(e).zIndex) || 0;
  return [...document.querySelectorAll<HTMLElement>('[data-testid="tasklist-expanded"][data-presentation="overlay"]')].some((o) => {
    if (o === panel.value || getComputedStyle(o).visibility === 'hidden') return false;
    const r = o.getBoundingClientRect();
    return z(o) > z(panel.value!) && r.left < mine.right && r.right > mine.left && r.top < mine.bottom && r.bottom > mine.top;
  });
}
// A tap anywhere on the grown card opens the normal list sheet (ticking and editing happen there) and it stays grown; a covered
// one first comes to the front. The focus goes back to the card first, so the sheet remembers it as its opener.
function openList() {
  if (covered()) { ui.bringToFront(cardKey()); return; }
  props.anchor.focus({ preventScroll: true });
  ui.revealTask(props.id);
}
</script>

<template>
  <Teleport :to="host ?? 'body'">
    <div
      ref="panel" class="xc" :class="{ inGrid: !!host }" role="group" data-testid="tasklist-expanded" data-presentation="overlay" data-readonly="true"
      :data-tasklist-id="id" :data-title="tl ? displayTitle(tl) : ''" :aria-label="tl ? neutralName(tl) : t('tasks.list.fallbackLabel')"
      :style="timed ? timedStyle : pos ? { left: pos.left + 'px', top: pos.top + 'px', width: pos.width + 'px', maxHeight: pos.maxHeight + 'px', '--min-h': pos.minHeight + 'px', borderRadius: pos.radius, '--xr': pos.radius, zIndex: layer, visibility: away ? 'hidden' : undefined } : { visibility: 'hidden' }"
    >
      <TaskListCard :segment="segment" :variant="variant" grown :grow-dir="pos?.dir" :tight="(pos?.minHeight || 0) < 36" @open-list="openList" @collapse="emit('close')" />
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
