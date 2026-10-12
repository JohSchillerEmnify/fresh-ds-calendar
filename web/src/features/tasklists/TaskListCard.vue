<script setup lang="ts">
/**
 * Collapsed task list card (registered for kind 'tasklist'), used in month cells, week/day all-day rows and as timed
 * blocks. Layout is driven by container queries on the card itself, so it never overflows at 50 px (phone month):
 *   title always wins; emoji only from 56 px; count badge from 84 px (below that only a thin progress bar on the bottom edge shows progress);
 *   item titles inline from 150 px (always in the DOM for screen readers, visually hidden when narrow).
 * Drag and drop: the root element is the drag target. It is exposed (`defineExpose({ el })`), emitted once as
 * `el` after mount and carries `data-draggable="tasklist"`; wrap or `useDraggable(elRef)` it from outside.
 */
import { computed, onMounted, ref } from 'vue';
import type { ItemRendererProps } from '@/extensions/registry';
import { vRipple } from '@/lib/ripple';
import { ProgressRing } from '@/motion';
import { useSettingsStore } from '@/stores/settings';
import { carriedLabel, formatEstimate, isComplete, itemClass } from './format';

const props = defineProps<ItemRendererProps>();
const emit = defineEmits<{ open: []; el: [el: HTMLElement] }>();
const settings = useSettingsStore();
const el = ref<HTMLElement | null>(null);
defineExpose({ el });
onMounted(() => { if (el.value) emit('el', el.value); });

const tl = computed(() => {
  const i = props.segment.item;
  if (i.kind !== 'tasklist') throw new Error('TaskListCard needs a task list');
  return i;
});
const icon = computed(() => settings.categoryById(tl.value.categoryId)?.icon ?? null);
const calm = computed(() => settings.settings.calmMode);
const carried = computed(() => !!props.segment.carriedFrom);
const complete = computed(() => isComplete(tl.value));
/** Timed blocks drop the item text when too short to hold the title row plus a line (never overlap). */
const roomForItems = computed(() => !props.height || props.height >= 46);
const lines = computed(() => (props.height ? Math.max(1, Math.floor((props.height - 26 - (tl.value.estimateMinutes ? 14 : 0)) / 14)) : 2));
const pct = computed(() => (tl.value.totalCount ? Math.round((tl.value.doneCount / tl.value.totalCount) * 100) : 0));
const label = computed(() => `${tl.value.title}, ${tl.value.doneCount} of ${tl.value.totalCount} done`);
</script>

<template>
  <button
    ref="el" v-ripple class="tl" :class="[variant, { carried, complete }]" type="button" data-testid="tasklist-card" data-draggable="tasklist"
    :data-tasklist-id="tl.id" :data-title="tl.title" :data-date="segment.date" :data-time="tl.time ?? ''" :data-color="tl.color"
    :data-category-id="tl.categoryId ?? ''" :aria-label="label" :style="{ '--c': tl.color, '--lines': lines }" @click.stop="emit('open')"
  >
    <span v-if="variant === 'dot'" class="dot" aria-hidden="true" />
    <span class="row">
      <span v-if="icon" class="emoji" data-testid="tasklist-card-icon" aria-hidden="true">{{ icon }}</span>
      <span class="title" data-testid="tasklist-card-title">{{ tl.title }}</span>
      <span class="meta">
        <span :key="tl.doneCount" class="count" data-testid="tasklist-card-count">{{ tl.doneCount }}/{{ tl.totalCount }}</span>
        <ProgressRing class="ring" :done="tl.doneCount" :total="tl.totalCount" :size="variant === 'block' || variant === 'allday' ? 18 : 12" :stroke="variant === 'chip' ? 2.2 : 2.8" />
      </span>
    </span>
    <span class="pbar" aria-hidden="true" :style="{ '--p': pct + '%' }" />
    <span v-if="!calm && roomForItems" class="items" data-testid="tasklist-card-items"><template v-if="tl.items.length"><template v-for="(i, n) in tl.items" :key="i.id"><span :class="itemClass(i.done)">{{ i.title }}</span><span v-if="n < tl.items.length - 1" class="sep">{{ ', ' }}</span></template></template><template v-else>No items</template></span>
    <span v-if="segment.startTime || tl.time || tl.estimateMinutes || carried" class="foot">
      <span v-if="tl.time && variant === 'block'" class="time" data-testid="tasklist-card-time">{{ tl.time }}</span>
      <span v-else-if="tl.time" class="sr" data-testid="tasklist-card-time">{{ tl.time }}</span>
      <span v-if="tl.estimateMinutes" class="est" data-testid="tasklist-card-estimate">{{ formatEstimate(tl.estimateMinutes) }}</span>
      <span v-if="carried" class="from" data-testid="tasklist-card-overdue">{{ carriedLabel(segment.carriedFrom!) }}</span>
    </span>
  </button>
</template>

<style scoped>
.tl {
  --bg: color-mix(in srgb, var(--c) 20%, var(--md-sys-color-surface-container-high));
  container-type: inline-size; position: relative; display: flex; flex-direction: column; min-width: 0; width: 100%; text-align: left;
  color: var(--md-sys-color-on-surface); background: var(--bg); border-left: 3px solid var(--c); border-radius: var(--md-sys-shape-corner-extra-small);
  padding: 1px 4px 2px; overflow: hidden; cursor: pointer; font: var(--md-sys-typescale-label-medium);
  transition: background var(--md-sys-motion-duration-medium), transform var(--md-sys-motion-duration-short);
}
.tl.carried { --bg: color-mix(in srgb, var(--md-sys-color-tertiary-container) 70%, color-mix(in srgb, var(--c) 14%, var(--md-sys-color-surface-container-high))); }
.tl.complete { opacity: 0.55; }
.tl.complete .title, .it.done { text-decoration: line-through; }
.it.done { opacity: 0.7; }
.row { display: flex; align-items: center; gap: 3px; min-width: 0; min-height: 16px; }
.emoji { flex: none; font-size: 11px; line-height: 1; }
.title {
  flex: 1 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; font-weight: 500; line-height: 16px;
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 9px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 9px), transparent);
}
.meta { flex: none; display: inline-flex; align-items: center; gap: 4px; }
.count { font: var(--md-sys-typescale-label-small); font-size: 10px; padding: 0 5px; border-radius: 8px; background: color-mix(in srgb, var(--c) 28%, transparent); line-height: 15px; }
html:not([data-motion='off']) .count { animation: bump 380ms var(--md-sys-motion-spring) both; }
.items, .est, .from, .time { font-size: 11px; line-height: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--md-sys-color-on-surface-variant); }
.foot { display: flex; gap: 6px; min-width: 0; flex-wrap: wrap; }
.from { background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); border-radius: 6px; padding: 0 5px; font-weight: 500; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* chip: one line (month cell, week all-day row) */
.chip { min-height: 18px; flex-direction: row; align-items: center; gap: 3px; }
.chip .row { display: contents; }
.chip .meta { order: 3; margin-left: auto; }
.chip .items, .chip .foot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.chip .ring { display: none; }
.dot { display: none; }
/* allday: roomier chip (day all-day area, week row on desktop) */
.allday { padding: 3px 6px 4px 6px; }
.allday .items { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.allday .ring { display: none; }
/* block: timed, sized by estimate */
.block { height: 100%; padding: 3px 5px; border-radius: var(--md-sys-shape-corner-small); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 30%, transparent); }
.block { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; align-content: start; }
.block .row { min-width: 0; }
.block .items { white-space: normal; display: block; overflow: hidden; min-height: 0; max-height: calc(var(--lines) * 14px); }
.block .foot { align-self: end; flex-wrap: nowrap; overflow: hidden; }
.dot { display: none; }

/* card: month cell on wide screens, task names listed one per line while the cell is wide enough */
.card { flex: none; padding: 2px 4px 3px; }
.card .items { display: none; }
.card .foot { display: none; }
@container (min-width: 60px) {
  .card .items { display: flex; flex-direction: column; white-space: normal; overflow: visible; }
  .card .items .sep { display: none; }
  .card .items .it { overflow-wrap: anywhere; }
}
.card .title { white-space: normal; -webkit-mask-image: none; mask-image: none; overflow-wrap: anywhere; }

/* narrow cards: title keeps priority */
/* tight (phone month / week columns): no count text, no ring; a thin progress bar on the bottom edge keeps the whole width for the title */
.pbar { display: none; position: absolute; left: 0; bottom: 0; height: 2.5px; width: var(--p); background: var(--c); border-radius: 0 2px 2px 0; transition: width 480ms cubic-bezier(0.3, 0, 0.2, 1); }
@container (max-width: 83px) { .count, .ring { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); } .pbar { display: block; } .meta { gap: 0; } }
@container (max-width: 55px) { .emoji { display: none; } .row { gap: 2px; } .block .items, .allday .items { display: none; } .block .foot, .allday .foot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); } }
@container (min-width: 150px) {
  .chip .title { flex: 0 1 auto; -webkit-mask-image: none; mask-image: none; text-overflow: ellipsis; }
  .chip .items { position: static; width: auto; height: auto; clip-path: none; flex: 1 1 0; min-width: 0; order: 2; }
}
@keyframes bump { 0% { transform: scale(0.7); } 60% { transform: scale(1.18); } 100% { transform: scale(1); } }
</style>
