<script setup lang="ts">
/**
 * The task list card expanded in place over the calendar (ARCHITECTURE "Expanded task list card"): a fixed overlay
 * teleported to the body, placed over its collapsed `anchor` card (`placeExpanded`: down, up or scrolling inside, always
 * within the visible scroll area), so the calendar underneath never moves. The list itself is `TaskListView`, editable in
 * the day view and `readonly` in the week and month view. Closes on Escape, the system back, a tap elsewhere, a change of view or date, a
 * scroll that takes the card out of sight, or when a dialog opens. The focus moves in and returns to the card.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t } from '@/i18n';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { listen, type Disposer } from '@/lib/timers';
import { displayTitle } from '@/lib/items';
import { useCalendarStore } from '@/stores/calendar';
import { useItemsStore } from '@/stores/items';
import { useUiStore } from '@/stores/ui';
import { anchorVisible, placeExpanded, type Box } from './expand';
import TaskListView from './TaskListView.vue';

const props = defineProps<{ id: string; anchor: HTMLElement; readonly: boolean }>();
const emit = defineEmits<{ close: [] }>();
const items = useItemsStore();
const ui = useUiStore();
const calendar = useCalendarStore();
// the system back closes the expansion first (ARCHITECTURE "Back closes overlays")
useOverlayHistory(() => true, () => emit('close'));
const panel = ref<HTMLElement | null>(null);
const view = ref<{ busy: boolean } | null>(null);
const pos = ref<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
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
  if (!el || !props.anchor.isConnected) return;
  const a = props.anchor.getBoundingClientRect();
  const b = bounds();
  if (!anchorVisible(a, b)) { emit('close'); return; }
  // natural height of the content plus the border, whatever the current maxHeight cuts off
  const p = placeExpanded(a, b, el.scrollHeight + el.offsetHeight - el.clientHeight);
  const n = { left: p.left, top: p.top, width: p.width, maxHeight: p.maxHeight };
  const o = pos.value;
  if (!o || o.left !== n.left || o.top !== n.top || o.width !== n.width || o.maxHeight !== n.maxHeight) pos.value = n;
}

let stops: Disposer[] = [];
let ro: ResizeObserver | null = null;
onMounted(() => {
  ui.setPanel('expanded-task-card', true);
  place();
  void nextTick(() => panel.value?.focus({ preventScroll: true }));
  stops.push(
    listen(document, 'keydown', (e) => { if (e.key === 'Escape' && !view.value?.busy) emit('close'); }),
    // capture: a tap elsewhere closes, while the tapped control still does its own thing
    listen(document, 'click', (e) => {
      const target = e.target as Node | null;
      if (target && !panel.value?.contains(target) && !props.anchor.contains(target)) emit('close');
    }, { capture: true }),
    listen(window, 'scroll', place, { capture: true, passive: true }),
    listen(window, 'resize', place),
  );
  if (typeof ResizeObserver !== 'undefined' && panel.value) { ro = new ResizeObserver(place); ro.observe(panel.value); }
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

// The expansion covers the collapsed card, so a tap on its head (outside the buttons) is the tap on the card again.
function onClick(e: MouseEvent) {
  const el = e.target as Element | null;
  if (el?.closest('header') && !el.closest('button, a, input')) emit('close');
}

// Opening the dialog: the focus goes back to the card first, so the dialog remembers it as its opener.
function onEdit() {
  props.anchor.focus({ preventScroll: true });
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="panel" class="xc" role="group" tabindex="-1" data-testid="tasklist-expanded" data-presentation="overlay" :data-readonly="readonly ? 'true' : 'false'"
      :data-tasklist-id="id" :data-title="tl ? displayTitle(tl) : ''" :aria-label="tl ? displayTitle(tl) : t('tasks.list.fallbackLabel')"
      @click="onClick"
      :style="{ '--c': tl?.color ?? 'transparent', ...(pos ? { left: pos.left + 'px', top: pos.top + 'px', width: pos.width + 'px', maxHeight: pos.maxHeight + 'px' } : { visibility: 'hidden' }) }"
    >
      <TaskListView ref="view" :id="id" closable overlay :readonly="readonly" @close="emit('close')" @deleted="emit('close')" @edit="onEdit" />
    </div>
  </Teleport>
</template>

<style scoped>
.xc {
  position: fixed; z-index: 40; box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain; outline: 0;
  padding: 4px 12px 8px; border-radius: var(--md-sys-shape-corner-large, 16px); border-top: 4px solid var(--c);
  background: color-mix(in srgb, var(--c) 7%, var(--md-sys-color-surface-container-low)); color: var(--md-sys-color-on-surface);
  box-shadow: var(--md-sys-elevation-3, 0 6px 18px rgb(0 0 0 / 0.35));
}
</style>
