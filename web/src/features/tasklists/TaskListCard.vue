<script setup lang="ts">
/**
 * Collapsed task list card (registered for kind 'tasklist'), used in month cells, week/day all-day rows and as timed blocks.
 * A task list is marked as a task: a tiny checkbox (empty / partly filled / checked by done count) before the title, solid
 * fill in the list colour (like events) with a white or black on-colour.
 * Item names are never dropped when the list has items. The degradation ladder (`fitItems`, budget from the `height` prop or
 * a default) goes: one name per line -> ellipsised names, as many lines as fit, the rest fading out at the bottom (no count)
 * -> (cards narrower than 92 px, "mini" tier) 9 px rows with a tiny checkbox glyph each -> (timed block without a spare row)
 * names inline next to the title; mini cards never go inline (no room beside the title), their names go in rows below it. All items stay in the DOM (`.over` hides the surplus) so text content and screen readers see the full list.
 * A complete list's title is struck through by a hand-drawn line (`StrikeLine`, `data-struck="true"`), its done state.
 * Drag and drop through `useCalendarDrag` (long press on touch, move past the slop with a mouse); a tap expands the card in place
 * (`ExpandedCard`, one at a time, state in the `ui` store) and a second tap collapses it.
 */
import { badgeInitial } from './sharing';
import { computed, defineAsyncComponent, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { t } from '@/i18n';
import { onColor } from '@/api/colors';
import type { ItemRendererProps } from '@/extensions/registry';
import { cardClick, useCalendarDrag } from '@/features/calendar/dnd';
import { inPreview } from '@/composables/usePreview';
import { vRipple } from '@/lib/ripple';
import { displayTitle } from '@/lib/items';
import ResizeHandles from '@/features/calendar/ResizeHandles.vue';
import { ProgressRing } from '@/motion';
import { usePrefsStore } from '@/stores/prefs';
import { useCalendarStore } from '@/stores/calendar';
import { useSettingsStore } from '@/stores/settings';
import { useTaskCategories } from './categories';
import { useUiStore } from '@/stores/ui';
import { carriedLabel, checkState, formatEstimate, isComplete, itemClass } from './format';
import { fitItems } from './layout';
import { sectionKey } from './section';
import StrikeLine from './StrikeLine.vue';

const ExpandedCard = defineAsyncComponent(() => import('./ExpandedCard.vue'));

/** Timed blocks shorter than this (about an hour or less) show the open items inline after the title, no footer row. */
const INLINE_BELOW_PX = 62;
/** Cards narrower than this (border box) use the mini tier; about the old content-box 84 px of a full-padding card. */
const MINI_BELOW_PX = 92;
const props = defineProps<ItemRendererProps>();
const emit = defineEmits<{ open: []; el: [el: HTMLElement] }>();
const settings = useSettingsStore();
const ui = useUiStore();
const calendar = useCalendarStore();
const el = ref<HTMLElement | null>(null);
defineExpose({ el });
onMounted(() => { if (el.value) emit('el', el.value); });
// a preview copy (swipe neighbour) is inert: no drag handlers
if (!inPreview()) useCalendarDrag(el, () => props.segment, () => props.variant);
// Border box, not content box: the mini tier changes the card's padding, so a content-box width flips the tier it decides (a loop).
const { width } = useElementSize(el, undefined, { box: 'border-box' });
/** Expanded in place over the calendar (a swipe preview copy never is); tap toggles, items change only in the day view. */
const expanded = computed(() => !inPreview() && ui.expandedCard?.id === props.segment.item.id && ui.expandedCard.date === props.segment.date);
const cardKey = () => ({ id: props.segment.item.id, date: props.segment.date });
onBeforeUnmount(() => { if (!inPreview()) ui.collapseCard(cardKey()); });

const tl = computed(() => {
  const i = props.segment.item;
  if (i.kind !== 'tasklist') throw new Error('TaskListCard needs a task list');
  return i;
});
/** Resize handles show after a release without moving (time grid blocks only). */
const resizing = computed(() => props.variant === 'block' && ui.resizing?.kind === 'tasklist' && ui.resizing.id === tl.value.id && ui.resizing.date === props.segment.date);
const cats = useTaskCategories();
const icon = computed(() => (!cats.on.value ? null : (tl.value.categoryInfo === undefined ? settings.categoryById(tl.value.categoryId)?.icon : tl.value.categoryInfo?.icon)) ?? null);
const color = computed(() => cats.color(tl.value));
/** The other person's initial on a shared list. */
const badge = computed(() => badgeInitial(tl.value));
const calm = computed(() => settings.settings.calmMode);
const prefs = usePrefsStore();
/** Carried over to today and labelled so (Settings → Task lists can hide where it came from). */
const carried = computed(() => !!props.segment.carriedFrom && prefs.showCarriedFrom);
const complete = computed(() => isComplete(tl.value));
const check = computed(() => checkState(tl.value.doneCount, tl.value.totalCount));
const pct = computed(() => (tl.value.totalCount ? Math.round((tl.value.doneCount / tl.value.totalCount) * 100) : 0));
const label = computed(() => t('tasks.card.label', { title: displayTitle(tl.value), done: tl.value.doneCount, total: tl.value.totalCount }));
/** Narrow cards (phone month, phone week columns) switch to 9 px mini rows. Unmeasured (0) counts as roomy. */
const mini = computed(() => width.value > 0 && width.value < MINI_BELOW_PX);
/** A block too short for a second row (the inline threshold) drops the time line, also when no open item is left to go inline. */
const shortBlock = computed(() => props.variant === 'block' && !!props.height && props.height < INLINE_BELOW_PX);
const hasFoot = computed(() => !!tl.value.time && !fit.value.inline && !shortBlock.value);
/** Overview shows open items only (ticked ones live in the expanded view), as many as there is room for: no fixed limit. */
const openItems = computed(() => tl.value.items.filter((i) => !i.done));
const section = inject(sectionKey, () => 'full' as const);
/** Section mode 'titles' overrides the per-card state: title row only (one ~22 px line). */
const titles = computed(() => section() === 'titles' && props.variant === 'allday');
const collapsed = computed(() => titles.value);
const fit = computed(() => {
  const block = props.variant === 'block';
  const footVisible = block && !!tl.value.time && !mini.value;
  const open = openItems.value.length;
  if (collapsed.value || !open) return { shown: 0, more: 0, inline: false };
  const f = fitItems({
    count: open,
    height: props.height || undefined,
    titleH: mini.value ? 15 : 17,
    rowH: mini.value ? 11 : 14,
    pad: block ? 6 : 5,
    footH: footVisible ? 14 : 0,
    minLines: block ? 0 : 1,
  });
  // Mini cards are too narrow for inline names: rows below the title.
  if (mini.value && (f.inline || shortBlock.value)) {
    const shown = f.inline ? 0 : f.shown;
    return { shown, more: open - shown, inline: false };
  }
  // Inline names run on in one line and fade out at the right edge, so every open one is shown.
  if (f.inline || shortBlock.value) return { shown: open, more: 0, inline: true };
  return { shown: f.shown, more: f.more, inline: false };
});
/** Rank among open items: ticked items are hidden, open ones past the budget are `over`. */
const rank = computed(() => {
  const m = new Map<string, number>();
  openItems.value.forEach((i, n) => m.set(i.id, n));
  return m;
});
const hideItem = (id: string) => (rank.value.get(id) ?? Infinity) >= fit.value.shown || !rank.value.has(id);
const showSep = (id: string) => fit.value.inline && (rank.value.get(id) ?? Infinity) < fit.value.shown - 1;
</script>

<template>
  <button
    ref="el" v-ripple class="tl skin" :class="[variant, { carried, complete, mini, collapsed, titles, resizing }]" type="button" data-testid="tasklist-card" data-draggable="tasklist"
    :data-fit="fit.inline ? 'inline' : fit.more ? 'more' : 'all'" :data-tier="mini ? 'mini' : 'full'"
    :data-tasklist-id="tl.id" :data-title="displayTitle(tl)" :data-date="segment.date" :data-time="tl.time ?? ''" :data-color="color"
    :data-category-id="cats.categoryId(tl) ?? ''" :aria-label="label" :aria-expanded="expanded" :style="{ '--c': color, '--on-solid': onColor(color), '--fill': check.fill + '%' }" @click="cardClick($event, () => ui.toggleCard(cardKey()))"
  >
    <span v-if="variant === 'dot'" class="dot" aria-hidden="true" />
    <span class="row">
      <span class="cb" :data-state="check.state" data-testid="tasklist-card-check" aria-hidden="true" />
      <span v-if="icon" class="emoji" data-testid="tasklist-card-icon" aria-hidden="true">{{ icon }}</span>
      <span class="title" data-testid="tasklist-card-title" :data-struck="complete ? 'true' : undefined"><span class="tx">{{ displayTitle(tl) }}<StrikeLine v-if="complete" /></span></span>
      <span v-if="badge && !mini" class="shbadge" data-testid="tasklist-shared-badge" aria-hidden="true">{{ badge }}</span>
      <span v-if="tl.estimateMinutes" class="est" data-testid="tasklist-card-estimate">{{ formatEstimate(tl.estimateMinutes) }}</span>
      <span v-if="carried" class="from" data-testid="tasklist-card-overdue" :aria-label="mini ? carriedLabel(segment.carriedFrom!) : undefined" :title="mini ? carriedLabel(segment.carriedFrom!) : undefined">{{ mini ? '↶' : carriedLabel(segment.carriedFrom!) }}</span>
      <span class="meta">
        <span :key="tl.doneCount" class="count" data-testid="tasklist-card-count">{{ tl.doneCount }}/{{ tl.totalCount }}</span>
        <ProgressRing class="ring" :done="tl.doneCount" :total="tl.totalCount" :size="variant === 'block' || variant === 'allday' ? 18 : 12" :stroke="variant === 'chip' ? 2.2 : 2.8" />
      </span>
    </span>
    <span class="pbar" aria-hidden="true" :style="{ '--p': pct + '%' }" />
    <template v-if="!calm">
      <span class="items" data-testid="tasklist-card-items" :data-fade="fit.more > 0 && !fit.inline ? 'true' : undefined"><template v-if="tl.items.length"><template v-for="(i, n) in tl.items" :key="i.id"><span :class="[itemClass(i.done), { over: hideItem(i.id) }]" data-testid="tasklist-card-item" :data-title="i.title">{{ i.title }}</span><span v-if="n < tl.items.length - 1" class="sep" :class="{ nosep: !showSep(i.id) }">{{ ', ' }}</span></template></template><template v-else>{{ t('tasks.card.noItems') }}</template></span>
    </template>
    <span v-if="hasFoot" class="foot">
      <span v-if="tl.time && variant === 'block'" class="time" data-testid="tasklist-card-time">{{ tl.time }}</span>
      <span v-else-if="tl.time" class="sr" data-testid="tasklist-card-time">{{ tl.time }}</span>
    </span>
    <ResizeHandles v-if="resizing" :segment="segment" />
    <ExpandedCard v-if="expanded && el" :id="tl.id" :anchor="el" :readonly="calendar.view !== 'day'" @close="ui.collapseCard(cardKey())" />
  </button>
</template>

<style scoped>
.shbadge { flex: none; min-width: 14px; padding: 0 3px; border-radius: 7px; font-size: 9px; line-height: 14px; text-align: center; background: color-mix(in srgb, currentColor 18%, transparent); }
.tl {
  container-type: inline-size; position: relative; display: flex; flex-direction: column; min-width: 0; width: 100%; text-align: left;
  
  padding: 1px 4px 2px; overflow: hidden; cursor: pointer; font: var(--md-sys-typescale-label-medium);
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  transition: background var(--md-sys-motion-duration-medium), box-shadow var(--md-sys-motion-duration-medium), transform var(--md-sys-motion-duration-short);
}
.tl[data-dragging='true'] { cursor: grabbing; }
/* the handles stick out of the block */
.tl.resizing { overflow: visible; }
.tl.complete { opacity: 0.55; }
.it.done { text-decoration: line-through; }
/* done state: a hand-drawn line over the title text (StrikeLine), not text-decoration */
.tx { position: relative; display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; vertical-align: top; --strike-w: 1.400px; }
.mini .tx { text-overflow: clip; }
.it.done { opacity: 0.7; }
.row { display: flex; align-items: center; gap: 3px; min-width: 0; min-height: 16px; }
.emoji { flex: none; font-size: 11px; line-height: 1; }
.title {
  flex: 1 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; font-weight: 500; line-height: 16px; text-overflow: ellipsis;
}
.meta { flex: none; display: inline-flex; align-items: center; gap: 4px; }
.count { font: var(--md-sys-typescale-label-small); font-size: 10px; padding: 0 5px; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--on) 45%, transparent); line-height: 13px; }
html:not([data-motion='off']) .count { animation: bump 380ms var(--md-sys-motion-spring) both; }

/* task marker: tiny checkbox in the category colour, empty / partly filled / checked */
.cb { position: relative; flex: none; box-sizing: border-box; width: 11px; height: 11px; border: 1.5px solid var(--on); border-radius: var(--cb-r, 3px); background: transparent; }
.cb[data-state='partial'] { background: linear-gradient(to top, var(--on) var(--fill), transparent var(--fill)); }
.cb[data-state='done'] { background: var(--on); }
.cb[data-state='done']::after { content: ''; position: absolute; left: 2.5px; top: 0; width: 3px; height: 6px; border: solid var(--e-mark, var(--c)); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }

/* item names: one per line, ellipsised, tiny checkbox glyph each; surplus hidden (.over), the last row fades out */
.items, .est, .from, .time { font-size: 11px; line-height: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--on); }
.items { display: flex; flex-direction: column; min-width: 0; }
.items .sep { display: none; }
.it { position: relative; display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 12px; }
.it::before { content: ''; position: absolute; left: 1px; top: 3.5px; box-sizing: border-box; width: 7px; height: 7px; border: 1px solid var(--on); border-radius: 2px; }
.it.done::before { background: var(--on); }
.it.over { display: none; }
.tl { --fs: 11px; }
.tl.mini { --fs: 9px; }
.it { font-size: var(--fs); }
/* truncated list: the rows that do not fit are cut, the last visible row fades out at the bottom (no count) */
.items[data-fade='true'] { -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 14px), transparent); mask-image: linear-gradient(180deg, #000 calc(100% - 14px), transparent); }
.foot { display: flex; gap: 6px; min-width: 0; flex-wrap: wrap; }
.from { flex: 0 100 auto; max-width: 45%; border: 1px solid color-mix(in srgb, var(--on) 45%, transparent); border-radius: 6px; padding: 0 5px; font-weight: 500; font-size: 10px; line-height: 14px; }
.row .est { flex: none; font-size: 10px; }
.card .row .est, .card .row .from, .mini .row .est, .block[data-fit='inline'] .from { display: none; }
.titles { padding-top: 1px; padding-bottom: 1px; }
.titles .row { min-height: 20px; }
/* Titles only: checkbox glyph + title + x/y, nothing else */
.titles .emoji, .titles .est, .titles .foot, .titles .ring, .titles .items { display: none; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* chip: one line (kept for hosts that ask for it; the calendar views use card / allday) */
.chip { min-height: 18px; flex-direction: row; align-items: center; gap: 3px; }
.chip .row { display: contents; }
.chip .meta { order: 3; margin-left: auto; }
.chip .items, .chip .foot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.chip .ring { display: none; }
.dot { display: none; }
/* allday: roomier card (day all-day area, week all-day row) */
.allday { padding: 3px 6px 4px 6px; }
.allday .ring { display: none; }
/* block: timed, sized by estimate */
.block { height: 100%; padding: 3px 5px; border-radius: var(--r-block); box-shadow: 0 0 0 1px var(--md-sys-color-surface), 0 1px 3px rgb(0 0 0 / 0.28), var(--glow-sh); }
.block { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; align-content: start; }
.block .row { min-width: 0; }
.block .items { min-height: 0; }
.block .foot { align-self: end; flex-wrap: nowrap; overflow: hidden; }
/* no spare row: names run next to the title */
.block[data-fit='inline'] { display: flex; flex-direction: row; align-items: center; gap: 5px; padding-top: 1px; padding-bottom: 1px; }
.block[data-fit='inline'] .row { flex: 0 1 auto; min-width: 3ch; }
.block[data-fit='inline'] .meta { display: none; }
.block[data-fit='inline'] .items { display: block; flex: 1 1 0; min-width: 0; align-self: center; }
.block[data-fit='inline'] .it { display: inline; padding: 0; }
/* inline keeps hiding ticked and surplus names: this selector outranks the general `.it.over` */
.block[data-fit='inline'] .it.over { display: none; }
.block[data-fit='inline'] .items { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 12px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 12px), transparent); }
.block[data-fit='inline'] .sep { display: inline; }
.block[data-fit='inline'] .sep.nosep { display: none; }
.block[data-fit='inline'] .it::before { display: none; }
.block[data-fit='inline'] .foot { flex: none; align-self: center; }
.mini.block[data-fit='inline'] .row { flex: 0 1 auto; min-width: 2ch; }
.block[data-fit='inline'] .pbar, .block[data-fit='inline'] .est { display: none; }

/* card: month cell. Foot hidden, the cell is small */
.card { flex: none; padding: 2px 4px 3px; }
.card .foot { display: none; }

/* mini tier (cards narrower than 92 px: phone month, phone week columns): 9 px rows */
.mini { padding: 1px 2px 2px 3px; }
.mini .row { gap: 2px; min-height: 14px; }
.mini .title { font-size: 10px; line-height: 14px; text-overflow: clip; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 7px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 7px), transparent); }
.mini .cb { width: 9px; height: 9px; border-width: 1.2px; border-radius: var(--cb-r, 2.5px); }
.mini .cb[data-state='done']::after { left: 1.7px; top: -0.5px; width: 2.4px; height: 5px; border-width: 0 1.2px 1.2px 0; }
.mini .items, .mini .it { line-height: 11px; }
.mini .it { padding-left: 8px; }
.mini .it::before { left: 0.5px; top: 2px; width: 5px; height: 5px; border-radius: 1.5px; }
.mini.allday, .mini.block { padding: 1px 2px 2px 3px; }
.mini .foot { display: none; }
.mini.block .foot { display: none; }
.mini .time, .mini .est, .mini .from { font-size: 9px; line-height: 11px; }
.mini .from { flex: none; max-width: none; padding: 0 2px; }

/* narrow cards: title keeps priority */
/* tight: no count text, no ring; a thin progress bar on the bottom edge keeps the whole width for the title */
.pbar { display: none; position: absolute; left: 0; bottom: 0; height: 2.5px; width: var(--p); background: var(--on); border-radius: 0 2px 2px 0; transition: width 480ms cubic-bezier(0.3, 0, 0.2, 1); }
@container (max-width: 83px) { .count, .ring { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); } .pbar { display: block; } .meta { gap: 0; } }
@container (max-width: 55px) { .emoji { display: none; } .row { gap: 2px; } .allday .foot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); } }
@container (min-width: 150px) {
  .chip .title { flex: 0 1 auto; }
  .chip .items { position: static; width: auto; height: auto; clip-path: none; flex: 1 1 0; min-width: 0; order: 2; }
}
@keyframes bump { 0% { transform: scale(0.7); } 60% { transform: scale(1.18); } 100% { transform: scale(1); } }
</style>
