<script setup lang="ts">
/**
 * Collapsed task list card (registered for kind 'tasklist'), used in month cells, week/day all-day rows and as timed blocks.
 * A task list is marked as a task: a tiny checkbox (empty / partly filled / checked by done count) before the title, solid
 * fill in the list colour (like events) with a white or black on-colour.
 * Item names are never dropped when the list has items. The degradation ladder (`cardLayout` in ./layout, budget from the `height` prop or
 * a default) goes: one name per line -> ellipsised names, as many lines as fit, the rest fading out at the bottom (no count)
 * -> (cards narrower than 92 px, "mini" tier) 9 px rows with a tiny checkbox glyph each -> (timed block without a spare row)
 * names inline next to the title; mini cards never go inline (no room beside the title), their names go in rows below it. All items stay in the DOM (`.over` hides the surplus) so text content and screen readers see the full list.
 * A complete list's title is struck through by a hand-drawn line (`StrikeLine`, `data-struck="true"`), its done state.
 * Drag and drop through `useCalendarDrag` (long press on touch, move past the slop with a mouse); a tap expands the card in place
 * (`ExpandedCard`, one at a time, state in the `ui` store). The expansion renders this same card with the `grown` prop: full
 * height, every item (ticked ones struck), the time foot, a wrapping title, display-only and without drag; a tap on it emits
 * `open-list` (the host opens the list sheet).
 */
import { badgeInitial } from './sharing';
import { computed, defineAsyncComponent, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { t } from '@/i18n';
import { onColor } from '@/api/colors';
import type { ItemRendererProps } from '@/extensions/registry';
import { cardClick, useCalendarDrag } from '@/features/calendar/dnd';
import { inPreview } from '@/composables/usePreview';
import { vRipple } from '@/lib/ripple';
import { displayTitle } from '@/lib/items';
import { useInkStore } from '@/stores/ink';
import InkLine from './InkLine.vue';
import ResizeHandles from '@/features/calendar/ResizeHandles.vue';
import { showsHandles } from '@/features/calendar/resize';
import { ProgressRing } from '@/motion';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useTaskCategories } from './categories';
import { useUiStore } from '@/stores/ui';
import { carriedLabel, checkState, formatEstimate, isComplete, itemClass, showProgress } from './format';
import { cardLayout } from './layout';
import { sectionKey } from './section';
import StrikeLine from './StrikeLine.vue';

const ExpandedCard = defineAsyncComponent(() => import('./ExpandedCard.vue'));

/** Cards narrower than this (border box) use the mini tier; about the old content-box 84 px of a full-padding card. */
const MINI_BELOW_PX = 92;
const props = defineProps<ItemRendererProps & { grown?: boolean; /** Where a grown card extends beyond its real time block. */ growDir?: 'down' | 'up'; /** Grown over a short real block: the head row drops its extras so it fits the pill. */ tight?: boolean }>();
const emit = defineEmits<{ open: []; el: [el: HTMLElement]; openList: []; collapse: [] }>();
const settings = useSettingsStore();
const ui = useUiStore();
const el = ref<HTMLElement | null>(null);
defineExpose({ el });
onMounted(() => { if (el.value) emit('el', el.value); });
// a preview copy (swipe neighbour) is inert: no drag handlers
if (!inPreview() && !props.grown) useCalendarDrag(el, () => props.segment, () => props.variant);
// Border box, not content box: the mini tier changes the card's padding, so a content-box width flips the tier it decides (a loop).
const { width } = useElementSize(el, undefined, { box: 'border-box' });
/** Expanded in place over the calendar (a swipe preview copy never is); a tap expands, items change only in the day view. */
/** This very card was tapped: a view may hold the same list twice (the zoom month's chip layer and its timeline), only the tapped one grows. */
const tapped = ref(false);
const sameCard = (c: { id: string; date: string } | null) => !!c && c.id === props.segment.item.id && c.date === props.segment.date;
const expanded = computed(() => !props.grown && !inPreview() && tapped.value && sameCard(ui.expandedCard));
watch(() => ui.expandedCard, (c) => { if (!sameCard(c)) tapped.value = false; });
const cardKey = () => ({ id: props.segment.item.id, date: props.segment.date });
/**
 * A tap on the collapsed card always expands it (collapsing happens on the grown card, elsewhere, Escape or back); the card that was tapped is the one that grows — also a time block that already shows every item: the grown card is
 * the pill-and-list presentation the owner wants on a tap, never a detour to the sheet (owner, 2026-10-19).
 */
function toggle() {
  // Growing in place is a Labs experiment (owner, 2026-10-19: it does not work properly yet); off, or with the setting
  // "Tapping a task list: drawer", a tap opens the list sheet.
  if (prefs.taskOpen === 'drawer' || !prefs.labsGrowCards) {
    el.value?.focus({ preventScroll: true });
    ui.revealTask(tl.value.id);
    return;
  }
  tapped.value = true;
  ui.expandCard(cardKey());
}
/** A tap on the grown card's title row folds it back up; anywhere else on it opens the list. */
function onGrownTap(e: MouseEvent) { if ((e.target as Element).closest('.row')) emit('collapse'); else emit('openList'); }
/** The month (and zoom month) cell card has no time axis: grown it is a plain card as tall as its content, no real block and extension. */
const flat = computed(() => !!props.grown && props.variant === 'card');
onBeforeUnmount(() => { if (!inPreview() && !props.grown) ui.collapseCard(cardKey()); });

const tl = computed(() => {
  const i = props.segment.item;
  if (i.kind !== 'tasklist') throw new Error('TaskListCard needs a task list');
  return i;
});
/** Resize handles show after a release without moving (time grid blocks only). */
const resizing = computed(() => !props.grown && showsHandles(ui.resizing, props.segment, props.variant));
const cats = useTaskCategories();
const icon = computed(() => (!cats.on.value ? null : (tl.value.categoryInfo === undefined ? settings.categoryById(tl.value.categoryId)?.icon : tl.value.categoryInfo?.icon)) ?? null);
const color = computed(() => cats.color(tl.value));
/** The other person's initial on a shared list. */
const badge = computed(() => badgeInitial(tl.value));
const calm = computed(() => settings.settings.calmMode);
const prefs = usePrefsStore();
/** Carried over to today and labelled so (Settings → Task lists can hide where it came from). */
const carried = computed(() => !!props.segment.carriedFrom && prefs.showCarriedFrom);
const progress = computed(() => showProgress(tl.value));
const complete = computed(() => isComplete(tl.value));
const check = computed(() => checkState(tl.value.doneCount, tl.value.totalCount));
const pct = computed(() => (tl.value.totalCount ? Math.round((tl.value.doneCount / tl.value.totalCount) * 100) : 0));
const title = computed(() => displayTitle(tl.value));
/** An ink item on the card: the text lines grow to the ink line height so text and ink sit evenly (decision M3). */
const inked = computed(() => tl.value.items.some((i) => i.ink));
const ink = useInkStore();
const label = computed(() => {
  const titled = !!title.value;
  const params = { title: title.value, done: tl.value.doneCount, total: tl.value.totalCount };
  // one item is just done or not done: the count and ring are dropped for it too
  if (!progress.value) return complete.value ? t(titled ? 'tasks.card.labelDone' : 'tasks.card.labelUntitledDone', params) : t(titled ? 'tasks.card.labelOpen' : 'tasks.card.labelUntitledOpen', params);
  return t(titled ? 'tasks.card.label' : 'tasks.card.labelUntitled', params);
});
/** Narrow cards (phone month, phone week columns) switch to 9 px mini rows. Unmeasured (0) counts as roomy. */
const mini = computed(() => width.value > 0 && width.value < MINI_BELOW_PX);
/** Overview shows open items only (ticked ones live in the expanded view), as many as there is room for: no fixed limit. */
const openItems = computed(() => tl.value.items.filter((i) => !i.done));
const section = inject(sectionKey, () => 'full' as const);
/** Section mode 'titles' overrides the per-card state: title row only (one ~22 px line). */
// the band's title form is for the pill only: the grown card always shows its items, whatever the band's section mode
const titles = computed(() => !props.grown && section() === 'titles' && props.variant === 'allday');
const collapsed = computed(() => titles.value);
/** Item fit, time foot and lead, decided in one place (`cardLayout`). */
const fit = computed(() => cardLayout({
  variant: props.variant, grown: !!props.grown, titles: titles.value, mini: mini.value, height: props.height,
  timed: !!tl.value.time, titled: !!title.value, open: openItems.value.length, total: tl.value.items.length,
}));
/** Untitled list whose card would otherwise show no item text (chip, titles mode, or a card/block too short to fit any
 * item): surface the FIRST item where the title would be, so the overview is never blank, in every view. It renders as an
 * item, never stored as the event title; the grown/opened card shows the whole list below with no title. */
const lead = computed(() => (fit.value.lead ? (tl.value.items[0] ?? null) : null));
/** Rank among open items: ticked items are hidden, open ones past the budget are `over`. */
const rank = computed(() => {
  const m = new Map<string, number>();
  openItems.value.forEach((i, n) => m.set(i.id, n));
  return m;
});
const hideItem = (id: string) => !props.grown && ((rank.value.get(id) ?? Infinity) >= fit.value.shown || !rank.value.has(id));
const showSep = (id: string) => fit.value.inline && (rank.value.get(id) ?? Infinity) < fit.value.shown - 1;
</script>

<template>
  <button
    ref="el" v-ripple class="tl skin" :class="[variant, { untitled: !title, inked, carried, complete, mini, collapsed, titles, resizing, grown, flat, up: grown && growDir === 'up' }]" type="button" :data-testid="grown ? 'tasklist-card-grown' : 'tasklist-card'" :data-draggable="grown ? undefined : 'tasklist'" :data-tight="tight ? 'true' : undefined"
    :data-fit="fit.inline ? 'inline' : fit.more ? 'more' : 'all'" :data-tier="mini ? 'mini' : 'full'"
    :data-tasklist-id="tl.id" :data-title="title" :data-untitled="title ? undefined : 'true'" :data-date="segment.date" :data-time="tl.time ?? ''" :data-color="color"
    :data-category-id="cats.categoryId(tl) ?? ''" :aria-label="label" :aria-expanded="expanded" :style="{ '--c': color, '--on-solid': onColor(color), '--fill': check.fill + '%' }" @click="grown ? onGrownTap($event) : cardClick($event, toggle)"
  >
    <span v-if="variant === 'dot'" class="dot" aria-hidden="true" />
    <span class="row">
      <span v-if="grown && !flat" class="gl real" data-testid="tasklist-grown-real" aria-hidden="true" />
      <span class="cb" :data-state="check.state" data-testid="tasklist-card-check" aria-hidden="true" />
      <span v-if="icon" class="emoji" data-testid="tasklist-card-icon" aria-hidden="true">{{ icon }}</span>
      <span v-if="title" class="title" data-testid="tasklist-card-title" :data-struck="complete ? 'true' : undefined"><span class="tx">{{ title }}<StrikeLine v-if="complete" /></span></span>
      <span v-else-if="lead" :class="[itemClass(lead.done), 'lead']" data-testid="tasklist-card-lead" :data-title="lead.title" :data-done="lead.done"><InkLine v-if="lead.ink" class="inkitem" :strokes="ink.strokes(lead.id)" :label="t('ink.placeholder')" /><template v-else>{{ lead.title }}</template></span>
      <span v-if="badge && !mini" class="shbadge" data-testid="tasklist-shared-badge" aria-hidden="true">{{ badge }}</span>
      <span v-if="tl.estimateMinutes" class="est" data-testid="tasklist-card-estimate">{{ formatEstimate(tl.estimateMinutes) }}</span>
      <span v-if="carried" class="from" data-testid="tasklist-card-overdue" :aria-label="mini ? carriedLabel(segment.carriedFrom!) : undefined" :title="mini ? carriedLabel(segment.carriedFrom!) : undefined">{{ mini ? '↶' : carriedLabel(segment.carriedFrom!) }}</span>
      <span class="meta">
        <span v-if="progress" :key="tl.doneCount" class="count" data-testid="tasklist-card-count">{{ tl.doneCount }}/{{ tl.totalCount }}</span>
        <ProgressRing v-if="progress" class="ring" :done="tl.doneCount" :total="tl.totalCount" :size="variant === 'block' || variant === 'allday' ? 18 : 12" :stroke="variant === 'chip' ? 2.2 : 2.8" />
      </span>
    </span>
    <span v-if="progress" class="pbar" data-testid="tasklist-card-bar" aria-hidden="true" :style="{ '--p': pct + '%' }" />
    <span class="extbox">
    <span v-if="grown && !flat" class="gl ext" data-testid="tasklist-grown-ext" aria-hidden="true" />
    <template v-if="!calm">
      <span class="items" data-testid="tasklist-card-items" :data-fade="fit.more > 0 && !fit.inline ? 'true' : undefined"><template v-if="tl.items.length"><template v-for="(i, n) in tl.items" :key="i.id"><span :class="[itemClass(i.done), { over: hideItem(i.id) }]" data-testid="tasklist-card-item" :data-title="i.title" :data-done="i.done" :data-ink="i.ink ? 'true' : undefined"><InkLine v-if="i.ink" class="inkitem" :strokes="ink.strokes(i.id)" :label="t('ink.item', { n: n + 1, total: tl.items.length })" /><template v-else>{{ i.title }}</template></span><span v-if="n < tl.items.length - 1" class="sep" :class="{ nosep: !showSep(i.id) }">{{ ', ' }}</span></template></template><template v-else>{{ t('tasks.card.noItems') }}</template></span>
    </template>
    <span v-if="fit.foot" class="foot">
      <span v-if="tl.time && variant === 'block'" class="time" data-testid="tasklist-card-time">{{ tl.time }}</span>
      <span v-else-if="tl.time" class="sr" data-testid="tasklist-card-time">{{ tl.time }}</span>
    </span>
    </span>
    <ResizeHandles v-if="resizing" :segment="segment" />
    <ExpandedCard v-if="expanded && el" :id="tl.id" :anchor="el" :segment="segment" :variant="variant" @close="ui.collapseCard(cardKey())" />
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
/* the lead is the list's first item rendered in the title slot (an actual .it, so its marker and strike match the items
 * shown below); it just fills the row like a title would */
.it.lead { flex: 1 1 auto; min-width: 0; }
.meta { flex: none; display: inline-flex; align-items: center; gap: 4px; }
/* titleless: no title text, so the count badge keeps the right edge */
.untitled .meta { margin-left: auto; }
.count { font: var(--md-sys-typescale-label-small); font-size: 10px; padding: 0 5px; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--on) 45%, transparent); line-height: 13px; }
html:not([data-motion='off']) .count { animation: bump 380ms var(--md-sys-motion-spring) both; }

/* task marker: tiny checkbox in the category colour, empty / partly filled / checked */
.cb { position: relative; flex: none; box-sizing: border-box; width: 11px; height: 11px; border: 1.5px solid var(--on); border-radius: var(--cb-r, 3px); background: transparent; }
.cb[data-state='partial'] { background: linear-gradient(to top, var(--on) var(--fill), transparent var(--fill)); }
.cb[data-state='done'] { background: var(--on); }
.cb[data-state='done']::after { content: ''; position: absolute; left: 2.5px; top: 0; width: 3px; height: 6px; border: solid var(--e-mark, var(--c)); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }

/* an ink item is a small picture of its line; with ink on the card every text line is as tall (about 24 px) */
.inkitem { --ink-h: 24px; display: inline-block; width: 100%; vertical-align: middle; }
.inked .items, .inked .items > span { line-height: 24px; }
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
.block { height: 100%; padding: 3px 5px; border-radius: var(--r-block); box-shadow: var(--block-sh); }
.block { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; align-content: start; }
.block .row { min-width: 0; }
.block .items { min-height: 0; }
.block .foot { align-self: end; flex-wrap: nowrap; overflow: hidden; }
/* no spare row: names run next to the title, at the TOP of the block: a later entry cascading over it leaves only the top
   strip visible (feature event-display), so a centred title was cut in half (owner, 2026-10-20) */
.block[data-fit='inline'] { display: flex; flex-direction: row; align-items: flex-start; gap: 5px; padding-top: 1px; padding-bottom: 1px; }
.block[data-fit='inline'] .row { flex: 0 1 auto; min-width: 3ch; }
.block[data-fit='inline'] .meta { display: none; }
.block[data-fit='inline'] .items { display: block; flex: 1 1 0; min-width: 0; line-height: 16px; }
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

/* grown (the expanded card, ExpandedCard): the same card at its full height; the host scrolls when it is cut to the screen */
.tl.grown { display: flex; flex-direction: column; height: auto; min-height: var(--min-h, 0); overflow: visible; cursor: pointer; }
.grown > * { flex: none; }
/* the grown card is drawn by two layers: the real time block (the normal card look) and, slimmer and lighter, the part that only
   extends it (below the real end, above the real start when it grows up); the seam between them marks the real end time */
.tl.grown { min-width: 0; animation: none; isolation: isolate; border-radius: inherit; }
/* the content sits 1 px inside the extension box so item/title text never spills past the lighter layer's edge */
.tl.grown:not(.flat) { background: transparent; border-color: transparent; box-shadow: none; --ext-in: 4px; padding: 0 calc(var(--ext-in) + 1px); }
/* the pill sits flush at the host's top (or bottom when grown up), so the real layer is exactly the card's box — no vertical
   padding on the host; the list keeps its breathing room inside the extension instead */
.tl.grown:not(.flat) .extbox { padding: 3px 0; }
/* the real layer wears the block card's own ring and shadow, so the collapsed card underneath never shows as a second edge */
.block.grown:not(.flat) .real { box-shadow: var(--block-sh); }
/* flat (month cell card): the card's own look, as tall as its content */
.tl.grown.flat { min-height: 0; }
.gl { position: absolute; z-index: -1; box-sizing: border-box; pointer-events: none; --bw: var(--e-bw, 0px); }
.real {
  top: calc(-1 * var(--bw)); left: calc(-1 * var(--e-bl, var(--bw))); right: calc(-1 * var(--bw)); height: var(--min-h, 0px);
  background: color-mix(in srgb, var(--c) var(--e-fill), var(--md-sys-color-surface)); border: var(--bw) solid var(--c); border-left-width: var(--e-bl, var(--bw));
  border-radius: var(--xr, var(--r-block)); box-shadow: var(--glow-sh);
}
.ext {
  top: calc(var(--min-h, 0px) - var(--bw)); bottom: calc(-1 * var(--bw)); left: var(--ext-in, 4px); right: var(--ext-in, 4px);
  /* on the raised container tone, so the list reads as a box in the dark theme too (on the plain surface it vanished there) */
  background: color-mix(in srgb, var(--c) calc(var(--e-fill) * 0.72), var(--md-sys-color-surface-container-high));
  border-radius: 0 0 var(--xr, var(--r-block)) var(--xr, var(--r-block)); box-shadow: inset 0 2px 0 color-mix(in srgb, var(--on) 28%, transparent);
}
.grown.up .real { top: auto; bottom: calc(-1 * var(--bw)); }
.grown.up .ext {
  top: calc(-1 * var(--bw)); bottom: calc(var(--min-h, 0px) - var(--bw));
  border-radius: var(--xr, var(--r-block)) var(--xr, var(--r-block)) 0 0; box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--on) 28%, transparent);
}
.grown .row { align-items: flex-start; flex-wrap: wrap; max-width: 100%; }
/* a narrow column wraps the badges below the title instead of squeezing it to a stub */
.grown .title { flex: 1 1 10ch; min-width: min(10ch, 100%); }
.grown .title, .grown .tx { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: break-word; hyphens: auto; -webkit-mask-image: none; mask-image: none; }
.grown .items { overflow: visible; margin-top: 4px; }
.grown .it { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: break-word; hyphens: auto; }
/* The two layers are two containers, never mixed (owner): the head row IS the pill — exactly the real block's height, one line,
   its extras dropped when the pill is short — and the items are the extension, starting at the seam, never inside the pill. */
/* Two containers that never mix (owner, 2026-10-19): the head row IS the pill — at least the real block's height, the full card
   width, the title wraps and stays readable, and over a short real block (`tight`) its extras are dropped — and the extension box
   holds the items, starting at the seam. Each layer is drawn inside its own container, so it follows that container's height. */
.extbox { display: contents; }
.tl.grown:not(.flat) .row { position: relative; height: var(--min-h, 0px); min-height: 0; min-width: 0; box-sizing: border-box; align-items: center; align-self: stretch; width: auto; max-width: none; overflow: hidden; margin: 0 calc(-1 * (var(--ext-in) + 1px)); padding: 0 5px; }
/* a tight pill is one flex line: the title shrinks and ellipsises instead of dropping below the icon where the pill would hide it;
   a tall pill keeps wrapping, so a narrow column (the 7-day week) stacks the row's parts instead of cutting them */
.tl.grown[data-tight='true'] .row { flex-wrap: nowrap; }
.tl.grown[data-tight='true'] .title { flex: 1 1 0; min-width: 0; }
/* a tight pill's count is compact (no capsule padding), so the title keeps as many letters as the column allows */
.tl.grown[data-tight='true'] .count { padding: 0 2px; }
.tl.grown[data-tight='true'] .meta { gap: 2px; }
/* a tight (one-line) pill keeps its count beside the ellipsised title when the card has room for both (70 px and up, e.g. the
   two-row overview's columns); below that — the 7-day week's 43 px columns — the title comes first and the count stays out */
@container (min-width: 70px) { .tl.grown[data-tight='true'] .count { position: static; width: auto; height: auto; overflow: visible; clip-path: none; } }
/* a tight pill (one line) keeps the title on that line with an ellipsis — the pill never grows past the real block */
.tl.grown[data-tight='true'] .title, .tl.grown[data-tight='true'] .tx { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; hyphens: manual; }.tl.grown:not(.flat) .real { top: calc(-1 * var(--bw)); bottom: 0; left: calc(-1 * var(--e-bl, var(--bw))); right: calc(-1 * var(--bw)); height: auto; }
.tl.grown:not(.flat) .extbox { display: flex; flex-direction: column; position: relative; min-width: 0; }
.tl.grown:not(.flat) .ext { top: calc(-1 * var(--bw)); bottom: calc(-1 * var(--bw)); left: -1px; right: -1px; }
.tl.grown:not(.flat) .pbar { display: none; }
/* the list holds items only: the time foot is neither pill content nor an item (the pill sits on its time block anyway) */
.tl.grown:not(.flat) .foot { display: none; }
.tl.grown[data-tight='true'] .est, .tl.grown[data-tight='true'] .from, .tl.grown[data-tight='true'] .shbadge, .tl.grown[data-tight='true'] .ring { display: none; }
/* grown upwards: the pill is at the bottom, the items stay above it in the extension */
.tl.grown.up:not(.flat) { flex-direction: column-reverse; }
.tl.grown.up:not(.flat) .real { top: calc(-1 * var(--bw)); bottom: 0; }
.tl.grown.up:not(.flat) .ext { top: calc(-1 * var(--bw)); bottom: calc(-1 * var(--bw)); }
.grown .foot { overflow: visible; margin-top: auto; }

/* card: month cell. Foot hidden, the cell is small */
.card { flex: none; padding: 2px 4px 3px; }
.card .foot { display: none; }

/* mini tier (cards narrower than 92 px: phone month, phone week columns): 9 px rows */
.mini { padding: 1px 2px 2px 3px; }
.mini .row { gap: 2px; min-height: 14px; }
.mini .title { font-size: 10px; line-height: 14px; text-overflow: clip; -webkit-mask-image: var(--fade-end); mask-image: var(--fade-end); }
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
