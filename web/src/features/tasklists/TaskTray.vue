<script setup lang="ts">
/**
 * Open tasks tray. Phone: slim bar above the navigation bar (count chip, tap to expand, list slides up as tall as the
 * expanded list's sheet). Desktop: right-hand panel. Every open list is a `TaskListView`, the same component as the
 * expanded list; lists finished today fold to their struck-through title. Sets `--tray-h` on :root so the FAB floats
 * above it. Hidden outside calendar views.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRef, watch, nextTick, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { t } from '@/i18n';
import { IconKeyboardArrowUp as IconExpand } from '@/components/icons';
import { isPhone } from '@/composables/useViewport';
import { appTimeout, type Disposer } from '@/lib/timers';
import { vRipple } from '@/lib/ripple';
import { displayTitle, neutralName } from '@/lib/items';
import { showProgress } from './format';
import { useUiStore } from '@/stores/ui';
import { compareOpen, useTaskListsStore } from './store';
import { useTaskCategories } from './categories';
import TaskListView from './TaskListView.vue';

const route = useRoute();
const lists = useTaskListsStore();
const ui = useUiStore();
const cats = useTaskCategories();
const shown = computed(() => !!route.meta.view);
const expanded = toRef(ui, 'trayExpanded');
/** The list is showing: phone = expanded bar, desktop = not collapsed to the edge strip. */
const listShown = computed(() => (isPhone.value ? expanded.value : !ui.trayCollapsedDesktop));
const root = ref<HTMLElement | null>(null);
function toggle() {
  if (isPhone.value) expanded.value = !expanded.value;
  else ui.trayCollapsedDesktop = !ui.trayCollapsedDesktop;
}
const countText = computed(() => (lists.count ? t('tasks.tray.open', { count: lists.count }) : t('tasks.tray.none')));
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
watch([shown, isPhone, expanded, () => ui.trayCollapsedDesktop, () => lists.count], () => nextTick(setHeight));
watch(root, (el) => {
  ro?.disconnect();
  if (el && typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(setHeight);
    ro.observe(el);
  }
  setHeight();
});
// Tell the ui store which lists this tray shows, so opening one of them reveals its row instead of a second panel.
watchEffect(() => { ui.trayListIds = shown.value && !isPhone.value && listShown.value ? rows.value.map((r) => r.list.id) : []; });
// A revealed list: scroll its row into view (the highlight itself is `data-flash`).
watch(() => ui.flashId, (id) => {
  if (!id) return;
  void nextTick(() => root.value?.querySelector(`[data-testid="task-tray-item"][data-list-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
});
onMounted(() => { void lists.refresh().catch(() => undefined); });
onBeforeUnmount(() => {
  lingerStops.forEach((stop) => stop());
  ro?.disconnect();
  ro = null;
  ui.trayExpanded = false;
  ui.trayListIds = [];
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
  <aside v-if="shown" ref="root" class="tray" :class="{ phone: isPhone, open: listShown, collapsed: !listShown && !isPhone }" data-testid="task-tray" :data-expanded="listShown">
    <button
      v-ripple class="bar" type="button" data-testid="task-tray-toggle" :aria-expanded="listShown" aria-controls="task-tray-list"
      :aria-label="isPhone ? undefined : listShown ? t('tasks.tray.collapse') : t('tasks.tray.expand')" @click="toggle"
    >
      <span class="chip" :class="{ none: !lists.count }" data-testid="task-tray-count" :data-count="lists.count">{{ countText }}</span>
      <span v-if="lists.nextTask && !expanded && isPhone" class="peek">{{ t('tasks.tray.next', { title: lists.nextTask.item.title }) }}</span>
      <IconExpand class="chev" data-testid="task-tray-chevron" aria-hidden="true" />
    </button>
    <TransitionGroup v-show="listShown" id="task-tray-list" tag="ul" name="tl" class="list">
      <li
        v-for="r in rows" :key="r.list.id" class="row tl-surface" :class="{ fin: r.fin }" data-testid="task-tray-item" :data-title="displayTitle(r.list)" :data-list-id="r.list.id" :data-flash="ui.flashId === r.list.id ? 'true' : undefined"
        :data-date="r.list.date" :data-finished="r.fin ? 'true' : undefined" :style="{ '--c': cats.color(r.list) }"
      >
        <div v-if="r.fin" class="head">
          <span v-if="displayTitle(r.list)" class="t" data-testid="task-tray-title">{{ displayTitle(r.list) }}</span>
          <span v-if="showProgress(r.list)" class="c" data-testid="task-tray-row-count">{{ r.list.doneCount }}/{{ r.list.totalCount }}</span>
          <button
            v-ripple class="mv" type="button" data-testid="task-tray-unfold" :aria-expanded="unfolded.has(r.list.id)"
            :aria-label="unfolded.has(r.list.id) ? t('tasks.tray.fold', { title: neutralName(r.list) }) : t('tasks.tray.showItems', { title: neutralName(r.list) })" @click="toggleFold(r.list.id)"
          ><IconExpand class="fold" :class="{ up: unfolded.has(r.list.id) }" /></button>
        </div>
        <TaskListView v-if="!r.fin || unfolded.has(r.list.id)" :id="r.list.id" :list="r.list" class="view" @completed="(catMs) => linger(r.list.id, catMs)" />
      </li>
      <li v-if="!lists.count" key="empty" class="empty">{{ t('tasks.tray.empty') }}</li>
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
.row { display: flex; flex-direction: column; flex: none; --tl-surface-top: 4px; }
.view { padding: 0 12px 12px; }
.head { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 0 0 12px; }
.fin { opacity: 0.6; }
.row[data-flash] { outline: 3px solid var(--md-sys-color-primary); outline-offset: 1px; }
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
/* Phone without a bottom bar: the tray is the bottom edge and pads the safe area itself. */
@media (max-width: 767.98px) {
  html:not([data-nav-pos='bottom']) .tray.phone { padding-bottom: var(--safe-bottom); }
  /* the bottom bar floats over the calendar: the tray stands clear of it (feature nav-expressive) */
  html[data-nav-pos='bottom'] .tray.phone { margin-bottom: var(--navbar-h); }
}
@media (min-width: 768px) {
  .tray { width: 380px; border-left: 1px solid var(--md-sys-color-outline-variant); overflow: hidden; transition: width 200ms var(--md-sys-motion-spring); }
  .bar { padding-right: 12px; }
  .open .chev { transform: rotate(90deg); }
  .tray.collapsed .chev { transform: rotate(-90deg); }
  /* Collapsed: a slim edge strip (56 px) with only the toggle; the count chip reads sideways. */
  .tray.collapsed { width: 56px; }
  .collapsed .bar { flex-direction: column; justify-content: flex-start; gap: 12px; padding: 12px 0; }
  .collapsed .chev { margin-left: 0; order: -1; }
  .collapsed .chip { writing-mode: vertical-rl; padding: 12px 4px; white-space: nowrap; }
  .list { flex: 1; min-height: 0; max-height: none; }
}
/* Left-handed mode (phone): the toggle chevron sits at the left, right of the "+" button's clearance; the fold toggle too. */
@media (max-width: 767.98px) {
  html[data-hand='left'][data-touch] .bar { padding: 0 16px 0 88px; }
  html[data-hand='left'][data-touch] .chev { order: -1; margin-left: 0; }
  html[data-hand='left'][data-touch] .head { padding: 0 12px 0 0; }
  html[data-hand='left'][data-touch] .mv { order: -1; }
}
/* Left-handed mode (touch tablet): the side panel moves next to the navigation rail at the left; its edge and fold chevron mirror. */
@media (min-width: 768px) {
  html[data-hand='left'][data-touch] .tray { order: -1; border-left: 0; border-right: 1px solid var(--md-sys-color-outline-variant); }
  html[data-hand='left'][data-touch] .open .chev { transform: rotate(-90deg); }
  html[data-hand='left'][data-touch] .tray.collapsed .chev { transform: rotate(90deg); }
}
</style>
