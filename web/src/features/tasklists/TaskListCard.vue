<script setup lang="ts">
/**
 * Collapsed task list card (registered for kind 'tasklist'), used in month cells, week/day all-day rows and as timed blocks.
 * A task list is marked as a task: a tiny checkbox (empty / partly filled / checked by done count) before the title, a dashed
 * left edge and a lighter tint; events are plain solid blocks.
 * Item names are never dropped when the list has items. The degradation ladder (`fitItems`, budget from the `height` prop or
 * a default) goes: one name per line -> ellipsised names, as many lines as fit -> first N names + "+k" line -> (cards narrower
 * than 84 px, "mini" tier) 9 px rows with a tiny checkbox glyph each -> (timed block without a spare row) names inline next
 * to the title. All items stay in the DOM (`.over` hides the surplus) so text content and screen readers see the full list.
 * Drag and drop through `useCalendarDrag` (long press on touch, move past the slop with a mouse); a tap still opens the list.
 */
import { computed, onMounted, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import type { ItemRendererProps } from '@/extensions/registry';
import { cardClick, useCalendarDrag } from '@/features/calendar/dnd';
import { vRipple } from '@/lib/ripple';
import { ProgressRing } from '@/motion';
import { useSettingsStore } from '@/stores/settings';
import { carriedLabel, checkState, formatEstimate, isComplete, itemClass } from './format';
import { fitItems } from './layout';

const props = defineProps<ItemRendererProps>();
const emit = defineEmits<{ open: []; el: [el: HTMLElement] }>();
const settings = useSettingsStore();
const el = ref<HTMLElement | null>(null);
defineExpose({ el });
onMounted(() => { if (el.value) emit('el', el.value); });
useCalendarDrag(el, () => props.segment, () => props.variant);
const { width } = useElementSize(el);

const tl = computed(() => {
  const i = props.segment.item;
  if (i.kind !== 'tasklist') throw new Error('TaskListCard needs a task list');
  return i;
});
const icon = computed(() => settings.categoryById(tl.value.categoryId)?.icon ?? null);
const calm = computed(() => settings.settings.calmMode);
const carried = computed(() => !!props.segment.carriedFrom);
const complete = computed(() => isComplete(tl.value));
const check = computed(() => checkState(tl.value.doneCount, tl.value.totalCount));
const pct = computed(() => (tl.value.totalCount ? Math.round((tl.value.doneCount / tl.value.totalCount) * 100) : 0));
const label = computed(() => `${tl.value.title}, ${tl.value.doneCount} of ${tl.value.totalCount} done`);
/** Narrow cards (phone month, phone week columns) switch to 9 px mini rows. Unmeasured (0) counts as roomy. */
const mini = computed(() => width.value > 0 && width.value < 84);
const hasFoot = computed(() => !!(props.segment.startTime || tl.value.time || tl.value.estimateMinutes || carried.value));
const fit = computed(() => {
  const block = props.variant === 'block';
  const footVisible = hasFoot.value && (block || props.variant === 'allday');
  return fitItems({
    count: tl.value.items.length,
    height: props.height || undefined,
    titleH: mini.value ? 15 : 17,
    rowH: mini.value ? 11 : 14,
    pad: block ? 6 : 5,
    footH: footVisible ? 14 : 0,
    minLines: block ? 0 : mini.value ? 3 : 2,
    maxLines: block ? 12 : mini.value ? 4 : props.height ? 8 : 5,
  });
});
const moreText = computed(() => (mini.value ? `+${fit.value.more}` : `+${fit.value.more} more`));
</script>

<template>
  <button
    ref="el" v-ripple class="tl" :class="[variant, { carried, complete, mini }]" type="button" data-testid="tasklist-card" data-draggable="tasklist"
    :data-fit="fit.inline ? 'inline' : fit.more ? 'more' : 'all'" :data-tier="mini ? 'mini' : 'full'"
    :data-tasklist-id="tl.id" :data-title="tl.title" :data-date="tl.date" :data-time="tl.time ?? ''" :data-color="tl.color"
    :data-category-id="tl.categoryId ?? ''" :aria-label="label" :style="{ '--c': tl.color, '--fill': check.fill + '%' }" @click="cardClick($event, () => emit('open'))"
  >
    <span v-if="variant === 'dot'" class="dot" aria-hidden="true" />
    <span class="row">
      <span class="cb" :data-state="check.state" data-testid="tasklist-card-check" aria-hidden="true" />
      <span v-if="icon" class="emoji" data-testid="tasklist-card-icon" aria-hidden="true">{{ icon }}</span>
      <span class="title" data-testid="tasklist-card-title">{{ tl.title }}</span>
      <span class="meta">
        <span :key="tl.doneCount" class="count" data-testid="tasklist-card-count">{{ tl.doneCount }}/{{ tl.totalCount }}</span>
        <ProgressRing class="ring" :done="tl.doneCount" :total="tl.totalCount" :size="variant === 'block' || variant === 'allday' ? 18 : 12" :stroke="variant === 'chip' ? 2.2 : 2.8" />
      </span>
    </span>
    <span class="pbar" aria-hidden="true" :style="{ '--p': pct + '%' }" />
    <template v-if="!calm">
      <span class="items" data-testid="tasklist-card-items"><template v-if="tl.items.length"><template v-for="(i, n) in tl.items" :key="i.id"><span :class="[itemClass(i.done), { over: n >= fit.shown }]">{{ i.title }}</span><span v-if="n < tl.items.length - 1" class="sep">{{ ', ' }}</span></template></template><template v-else>No items</template></span>
      <span v-if="fit.more" class="more" data-testid="tasklist-card-more" aria-hidden="true">{{ moreText }}</span>
    </template>
    <span v-if="hasFoot" class="foot">
      <span v-if="tl.time && variant === 'block'" class="time" data-testid="tasklist-card-time">{{ tl.time }}</span>
      <span v-else-if="tl.time" class="sr" data-testid="tasklist-card-time">{{ tl.time }}</span>
      <span v-if="tl.estimateMinutes" class="est" data-testid="tasklist-card-estimate">{{ formatEstimate(tl.estimateMinutes) }}</span>
      <span v-if="carried" class="from" data-testid="tasklist-card-overdue">{{ carriedLabel(segment.carriedFrom!) }}</span>
    </span>
  </button>
</template>

<style scoped>
.tl {
  --bg: color-mix(in srgb, var(--c) 13%, var(--md-sys-color-surface-container-high));
  container-type: inline-size; position: relative; display: flex; flex-direction: column; min-width: 0; width: 100%; text-align: left;
  color: var(--md-sys-color-on-surface); background: var(--bg); border-left: 3px dashed var(--c); border-radius: var(--md-sys-shape-corner-extra-small);
  padding: 1px 4px 2px; overflow: hidden; cursor: pointer; font: var(--md-sys-typescale-label-medium);
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  transition: background var(--md-sys-motion-duration-medium), transform var(--md-sys-motion-duration-short);
}
.tl[data-dragging='true'] { cursor: grabbing; }
.tl.carried { --bg: color-mix(in srgb, var(--md-sys-color-tertiary-container) 70%, color-mix(in srgb, var(--c) 14%, var(--md-sys-color-surface-container-high))); }
.tl.complete { opacity: 0.55; }
.tl.complete .title, .it.done { text-decoration: line-through; }
.it.done { opacity: 0.7; }
.row { display: flex; align-items: center; gap: 3px; min-width: 0; min-height: 16px; }
.emoji { flex: none; font-size: 11px; line-height: 1; }
.title {
  flex: 1 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; font-weight: 500; line-height: 16px; text-overflow: ellipsis;
}
.meta { flex: none; display: inline-flex; align-items: center; gap: 4px; }
.count { font: var(--md-sys-typescale-label-small); font-size: 10px; padding: 0 5px; border-radius: 8px; background: color-mix(in srgb, var(--c) 28%, transparent); line-height: 15px; }
html:not([data-motion='off']) .count { animation: bump 380ms var(--md-sys-motion-spring) both; }

/* task marker: tiny checkbox in the category colour, empty / partly filled / checked */
.cb { position: relative; flex: none; box-sizing: border-box; width: 11px; height: 11px; border: 1.5px solid var(--c); border-radius: 3px; background: transparent; }
.cb[data-state='partial'] { background: linear-gradient(to top, var(--c) var(--fill), transparent var(--fill)); }
.cb[data-state='done'] { background: var(--c); }
.cb[data-state='done']::after { content: ''; position: absolute; left: 2.5px; top: 0; width: 3px; height: 6px; border: solid var(--md-sys-color-surface); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }

/* item names: one per line, ellipsised, tiny checkbox glyph each; surplus hidden (.over) behind the "+k" line */
.items, .est, .from, .time { font-size: 11px; line-height: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--md-sys-color-on-surface-variant); }
.items { display: flex; flex-direction: column; min-width: 0; }
.items .sep { display: none; }
.it { position: relative; display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 12px; }
.it::before { content: ''; position: absolute; left: 1px; top: 3.5px; box-sizing: border-box; width: 7px; height: 7px; border: 1px solid var(--c); border-radius: 2px; }
.it.done::before { background: var(--c); }
.it.over { display: none; }
.more { font-size: 10px; line-height: 13px; padding-left: 12px; font-weight: 500; color: var(--md-sys-color-on-surface-variant); white-space: nowrap; }
.foot { display: flex; gap: 6px; min-width: 0; flex-wrap: wrap; }
.from { background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); border-radius: 6px; padding: 0 5px; font-weight: 500; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* chip: one line (kept for hosts that ask for it; the calendar views use card / allday) */
.chip { min-height: 18px; flex-direction: row; align-items: center; gap: 3px; }
.chip .row { display: contents; }
.chip .meta { order: 3; margin-left: auto; }
.chip .items, .chip .more, .chip .foot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.chip .ring { display: none; }
.dot { display: none; }
/* allday: roomier card (day all-day area, week all-day row) */
.allday { padding: 3px 6px 4px 6px; }
.allday .ring { display: none; }
/* block: timed, sized by estimate */
.block { height: 100%; padding: 3px 5px; border-radius: var(--md-sys-shape-corner-small); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 30%, transparent); }
.block { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; align-content: start; }
.block .row { min-width: 0; }
.block .items { min-height: 0; }
.block .more { grid-row: auto; }
.block .foot { align-self: end; flex-wrap: nowrap; overflow: hidden; }
/* no spare row: names run next to the title */
.block[data-fit='inline'] { display: flex; flex-direction: row; align-items: center; gap: 5px; padding-top: 1px; padding-bottom: 1px; }
.block[data-fit='inline'] .row { flex: 0 1 auto; max-width: 62%; }
.block[data-fit='inline'] .items { display: block; flex: 1 1 0; min-width: 0; align-self: center; }
.block[data-fit='inline'] .it { display: inline; padding: 0; }
.block[data-fit='inline'] .it::before { display: none; }
.block[data-fit='inline'] .sep { display: inline; }
.block[data-fit='inline'] .foot { flex: none; align-self: center; }
.block[data-fit='inline'] .pbar { display: none; }

/* card: month cell. Foot hidden, the cell is small */
.card { flex: none; padding: 2px 4px 3px; }
.card .foot { display: none; }

/* mini tier (cards narrower than 84 px: phone month, phone week columns): 9 px rows */
.mini { padding: 1px 2px 2px 3px; border-left-width: 2px; }
.mini .row { gap: 2px; min-height: 14px; }
.mini .title { font-size: 10px; line-height: 14px; text-overflow: clip; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 7px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 7px), transparent); }
.mini .cb { width: 9px; height: 9px; border-width: 1.2px; border-radius: 2.5px; }
.mini .cb[data-state='done']::after { left: 1.7px; top: -0.5px; width: 2.4px; height: 5px; border-width: 0 1.2px 1.2px 0; }
.mini .items, .mini .it { font-size: 9px; line-height: 11px; }
.mini .it { padding-left: 8px; }
.mini .it::before { left: 0.5px; top: 2px; width: 5px; height: 5px; border-radius: 1.5px; }
.mini .more { font-size: 9px; line-height: 11px; padding-left: 8px; }
.mini.allday, .mini.block { padding: 1px 2px 2px 3px; }
.mini .foot { display: none; }
.mini.block .foot { display: flex; }
.mini .time, .mini .est, .mini .from { font-size: 9px; line-height: 11px; }

/* narrow cards: title keeps priority */
/* tight: no count text, no ring; a thin progress bar on the bottom edge keeps the whole width for the title */
.pbar { display: none; position: absolute; left: 0; bottom: 0; height: 2.5px; width: var(--p); background: var(--c); border-radius: 0 2px 2px 0; transition: width 480ms cubic-bezier(0.3, 0, 0.2, 1); }
@container (max-width: 83px) { .count, .ring { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); } .pbar { display: block; } .meta { gap: 0; } }
@container (max-width: 55px) { .emoji { display: none; } .row { gap: 2px; } .allday .foot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); } }
@container (min-width: 150px) {
  .chip .title { flex: 0 1 auto; }
  .chip .items { position: static; width: auto; height: auto; clip-path: none; flex: 1 1 0; min-width: 0; order: 2; }
}
@keyframes bump { 0% { transform: scale(0.7); } 60% { transform: scale(1.18); } 100% { transform: scale(1); } }
</style>
