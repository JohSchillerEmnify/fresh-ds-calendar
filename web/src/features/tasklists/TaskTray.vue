<script setup lang="ts">
/**
 * Open tasks tray. Phone: slim bar above the navigation bar (count chip, tap to expand, list slides up as tall as the
 * expanded list's sheet). Desktop: right-hand panel. Every open list is a `TaskListView`, the same component as the
 * expanded list; lists finished today fold to their struck-through title. Sets `--tray-h` on :root so the FAB floats
 * above it. Hidden outside calendar views.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRef, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import IconExpand from '~icons/material-symbols/keyboard-arrow-up';
import { isPhone } from '@/composables/useViewport';
import { appTimeout, type Disposer } from '@/lib/timers';
import { vRipple } from '@/lib/ripple';
import { displayTitle } from '@/lib/items';
import { useUiStore } from '@/stores/ui';
import { compareOpen, useTaskListsStore } from './store';
import TaskListView from './TaskListView.vue';

const route = useRoute();
const lists = useTaskListsStore();
const ui = useUiStore();
const shown = computed(() => !!route.meta.view);
const expanded = toRef(ui, 'trayExpanded');
const root = ref<HTMLElement | null>(null);
const countText = computed(() => (lists.count ? `${lists.count} open` : 'No open tasks'));
/**
 * Lists just finished here stay open (celebration and "All done!" visible) for this long before folding, or until the
 * support cat's visit ends if it came (`catMs`), so the cat keeps its card.
 */
const LINGER_MS = 2000;
const lingering = reactive(new Set<string>());
const lingerStops = new Map<string, Disposer>();
function linger(id: string, catMs = 0) {
  lingerStops.get(id)?.();
  lingering.add(id);
  lingerStops.set(id, appTimeout(() => { lingering.delete(id); lingerStops.delete(id); }, Math.max(LINGER_MS, catMs)));
}
/** Open lists (plus lingering just-finished ones, in their place), then lists finished today (folded unless unfolded). */
const rows = computed(() => {
  const fin = lists.finished.filter((l) => !lingering.has(l.id));
  const linger = lists.finished.filter((l) => lingering.has(l.id));
  const open = linger.length ? [...lists.tray, ...linger].sort(compareOpen) : lists.tray;
  return open.map((l) => ({ list: l, fin: false })).concat(fin.map((l) => ({ list: l, fin: true })));
});

let ro: ResizeObserver | null = null;
/** Publishes the tray's footprint: `--tray-h` (phone bar) and `--tray-w` (desktop side panel) keep the FAB clear of it. */
function setHeight() {
  const box = shown.value && root.value ? root.value.getBoundingClientRect() : null;
  document.documentElement.style.setProperty('--tray-h', `${box && isPhone.value ? Math.round(box.height) : 0}px`);
  document.documentElement.style.setProperty('--tray-w', `${box && !isPhone.value ? Math.round(box.width) : 0}px`);
}
watch([shown, isPhone, expanded, () => lists.count], () => nextTick(setHeight));
watch(root, (el) => {
  ro?.disconnect();
  if (el && typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(setHeight);
    ro.observe(el);
  }
  setHeight();
});
onMounted(() => { void lists.refresh().catch(() => undefined); });
onBeforeUnmount(() => {
  lingerStops.forEach((stop) => stop());
  ro?.disconnect();
  ro = null;
  ui.trayExpanded = false;
  document.documentElement.style.removeProperty('--tray-h');
  document.documentElement.style.removeProperty('--tray-w');
});

/** Finished lists unfolded in this tray (UI state only). */
const unfolded = reactive(new Set<string>());
function toggleFold(id: string) {
  if (unfolded.has(id)) unfolded.delete(id);
  else unfolded.add(id);
}
</script>

<template>
  <aside v-if="shown" ref="root" class="tray" :class="{ phone: isPhone, open: expanded || !isPhone }" data-testid="task-tray" :data-expanded="expanded || !isPhone">
    <button
      v-ripple class="bar" type="button" data-testid="task-tray-toggle" :aria-expanded="expanded || !isPhone" aria-controls="task-tray-list"
      @click="expanded = !expanded"
    >
      <span class="chip" :class="{ none: !lists.count }" data-testid="task-tray-count" :data-count="lists.count">{{ countText }}</span>
      <span v-if="lists.nextTask && !expanded && isPhone" class="peek">Next: {{ lists.nextTask.item.title }}</span>
      <IconExpand class="chev" aria-hidden="true" />
    </button>
    <TransitionGroup v-show="expanded || !isPhone" id="task-tray-list" tag="ul" name="tl" class="list">
      <li
        v-for="r in rows" :key="r.list.id" class="row" :class="{ fin: r.fin }" data-testid="task-tray-item" :data-title="displayTitle(r.list)"
        :data-date="r.list.date" :data-finished="r.fin ? 'true' : undefined" :style="{ '--c': r.list.color }"
      >
        <div v-if="r.fin" class="head">
          <span class="t" data-testid="task-tray-title">{{ displayTitle(r.list) }}</span>
          <span class="c">{{ r.list.doneCount }}/{{ r.list.totalCount }}</span>
          <button
            v-ripple class="mv" type="button" data-testid="task-tray-unfold" :aria-expanded="unfolded.has(r.list.id)"
            :aria-label="unfolded.has(r.list.id) ? `Fold ${displayTitle(r.list)}` : `Show items of ${displayTitle(r.list)}`" @click="toggleFold(r.list.id)"
          ><IconExpand class="fold" :class="{ up: unfolded.has(r.list.id) }" /></button>
        </div>
        <TaskListView v-if="!r.fin || unfolded.has(r.list.id)" :id="r.list.id" :list="r.list" class="view" @completed="(catMs) => linger(r.list.id, catMs)" />
      </li>
      <li v-if="!lists.count" key="empty" class="empty">Nothing waiting. Nice.</li>
    </TransitionGroup>
  </aside>
</template>

<style scoped>
.tray { flex: none; background: var(--md-sys-color-surface-container); color: var(--md-sys-color-on-surface); display: flex; flex-direction: column; min-width: 0; }
.bar { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 88px 0 16px; width: 100%; text-align: left; }
.chip { background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); border-radius: 999px; padding: 4px 12px; font: var(--md-sys-typescale-label-large); }
.chip.none { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.peek { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-body-small); }
.chev { margin-left: auto; width: 24px; height: 24px; transition: transform 240ms var(--md-sys-motion-spring); }
.open .chev { transform: rotate(180deg); }
.list { list-style: none; margin: 0; padding: 0 8px 8px; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
/* Phone, opened: as tall as the expanded list's sheet at most, but never more than the space above the navigation bar
   (the tray shrinks and scrolls; a fixed dvh height pushed the last rows under the navigation bar). */
.phone.open { flex: 0 1 auto; min-height: 0; }
.phone .list { max-height: calc(90dvh - var(--navbar-h, 80px) - 44px); }
/* Cards stand off the tray background: own surface tint, outline and a light shadow. */
.row {
  display: flex; flex-direction: column; flex: none; border-radius: 14px; border-top: 4px solid var(--c);
  border-inline: 1px solid var(--md-sys-color-outline-variant); border-bottom: 1px solid var(--md-sys-color-outline-variant);
  background: color-mix(in srgb, var(--c) 14%, var(--md-sys-color-surface-container-highest));
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
}
.view { padding: 0 12px 12px; }
.head { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 0 0 12px; }
.fin { opacity: 0.6; }
.fin .t { text-decoration-line: line-through; }
.fold { width: 22px; height: 22px; transform: rotate(180deg); transition: transform 200ms var(--md-sys-motion-spring); }
.fold.up { transform: none; }
.tl-move { transition: transform 260ms var(--md-sys-motion-spring); }
.t { flex: 1; min-width: 0; font: var(--md-sys-typescale-title-small); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c { font: var(--md-sys-typescale-label-medium); color: var(--md-sys-color-on-surface-variant); }
.mv { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none; color: var(--md-sys-color-on-surface-variant); }
.mv :deep(svg) { width: 22px; height: 22px; }
.empty { padding: 12px 16px; color: var(--md-sys-color-on-surface-variant); }
.phone { border-top: 1px solid var(--md-sys-color-outline-variant); }
@media (min-width: 768px) {
  .tray { width: 380px; border-left: 1px solid var(--md-sys-color-outline-variant); overflow: hidden; }
  .bar { cursor: default; padding-right: 12px; }
  .chev { display: none; }
  .list { flex: 1; min-height: 0; max-height: none; }
}
</style>
