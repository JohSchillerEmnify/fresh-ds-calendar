<script setup lang="ts">
/** One line of ink (feature handwritten-lists): SVG in line-height units; editable takes pen strokes and erasing, `change` reports all strokes. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { InkPoint, InkStroke } from '@/api/types';
import { eraseAt, flattenColours, parseColour, penRole, readableInk, readableOn, strokePath, toLineUnits, type Rgba } from '@/lib/ink';
import { useInkStore } from '@/stores/ink';
import { usePrefsStore } from '@/stores/prefs';

const props = defineProps<{
  strokes: InkStroke[];
  editable?: boolean;
  /** Spoken name of the line (a screen reader reads "Handwritten item 2 of 5"). */
  label?: string;
  /** Read-only on a card: crop to the writing so it fills the line, and keep it readable on this card colour (hex). */
  onCard?: string;
}>();
const emit = defineEmits<{
  change: [strokes: InkStroke[]];
  /** A click or tap that drew nothing (a mouse click, or a finger tap with "Draw with finger" off). */
  tap: [];
}>();

const ink = useInkStore();
const prefs = usePrefsStore();
const svg = ref<SVGSVGElement | null>(null);
const live = ref<{ points: InkPoint[]; colour: string | null; erase: boolean } | null>(null);
/** The strokes as an erase gesture leaves them while it is still going on. */
const erasing = ref<InkStroke[] | null>(null);
/** A pen is over or on the line: the browser must not pan from it (a pen is panned like a finger unless `touch-action` says no). */
const penOver = ref(false);
/** A pen was last at work at this time (ms); a touch right after it is a palm (decision R1). */
let penAt = 0;
const PALM_MS = 800;
const PALM_WIDTH = 40;
const ERASE_RADIUS = 0.35;

const shown = computed(() => erasing.value ?? props.strokes);
/** The width of the line in line heights: wide enough for the ink, so a narrow line scales it down instead of cutting it off. */
const widthUnits = ref(10);
const reach = computed(() => Math.max(1, ...shown.value.flatMap((s) => s.p.map((q) => q[0] + 0.3))));
const viewBox = computed(() => {
  const pts = props.onCard ? shown.value.flatMap((st) => st.p) : [];
  if (!pts.length) return `0 0 ${Math.max(widthUnits.value, reach.value)} 1`;
  // a card line is small: crop the empty margins so the writing fills it, never thinner than half a line
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const q of pts) [x0, x1, y0, y1] = [Math.min(x0, q[0]), Math.max(x1, q[0]), Math.min(y0, q[1]), Math.max(y1, q[1])];
  const h = Math.max(1 / 2, y1 - y0 + 0.2);
  return `${x0 - 0.1} ${(y0 + y1) / 2 - h / 2} ${x1 - x0 + 0.2} ${h}`;
});
/** The card's text colour and painted background (#rrggbb) as the theme sets them; chosen ink is adjusted to read on that. */
const textOn = ref('#000000');
const ground = ref(props.onCard ?? '#ffffff');
/** The `<html>` attributes that change the theme's colours (see `applyAttrs`/`applyThemeMode`); `style` carries the fine-tuning variables. */
const THEME_ATTRS = ['data-theme', 'data-theme-name', 'data-entries', 'data-corners', 'style'];
const readText = (): void => {
  const el = svg.value;
  if (!el) return;
  const text = flattenColours([parseColour(getComputedStyle(el).color)]);
  if (text) textOn.value = text;
  const card = el.closest('.tl');
  if (!card) return;
  // top-first: the card's glow layers, the card, then its ancestors until one is opaque
  const stack: (Rgba | null)[] = [...Array.from(card.querySelectorAll('.gl')).reverse(), card].map((e) => parseColour(getComputedStyle(e).backgroundColor));
  for (let e = card.parentElement; e && !stack.some((c) => c && c[3] >= 1); e = e.parentElement) stack.push(parseColour(getComputedStyle(e).backgroundColor));
  ground.value = flattenColours(stack.reverse()) ?? ground.value;
};
/** The card repaints through a transition: read its final colour when the card's own background ends. */
const onTransitionEnd = (e: TransitionEvent): void => {
  if (e.target === e.currentTarget && e.propertyName === 'background-color') readText();
};
let themeWatch: MutationObserver | undefined;
const OUTLINE_MAX_POINTS = 3000;
const pointCount = computed(() => shown.value.reduce((n, st) => n + st.p.length, 0));
const cardInk = (hex: string): Record<string, string> => { const c = readableOn(hex, [ground.value], textOn.value); return { '--l': c, '--d': c }; };

const paths = computed(() => shown.value.map((s) => ({
  d: strokePath(s.p),
  colour: s.c ?? 'theme',
  style: s.c ? (props.onCard ? cardInk(s.c) : { '--l': readableInk(s.c, false), '--d': readableInk(s.c, true) }) : {},
})));
const livePath = computed(() => (live.value && !live.value.erase ? strokePath(live.value.points) : ''));
const liveColour = computed(() => (live.value?.colour ? { '--l': readableInk(live.value.colour, false), '--d': readableInk(live.value.colour, true) } : {}));

let observer: ResizeObserver | null = null;
function measure(): void {
  const el = svg.value;
  if (el && el.clientHeight > 0) widthUnits.value = el.clientWidth / el.clientHeight;
}

/** A pointer position in line-height units, through the SVG's own transform so a scaled-down line stays right. */
function point(e: PointerEvent): InkPoint {
  const el = svg.value!;
  const m = el.getScreenCTM?.();
  if (m) {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y, Math.min(1, Math.max(0.05, e.pressure))];
  }
  const r = el.getBoundingClientRect();
  return toLineUnits(e, r, r.height);
}

function isPalm(e: PointerEvent): boolean {
  return e.pointerType === 'touch' && (Date.now() - penAt < PALM_MS || e.width > PALM_WIDTH || e.height > PALM_WIDTH);
}

/** The fingers on the line: with "Draw with finger" one draws, two scroll the list (decision Q8). */
const fingers = new Map<number, number>();
function scroller(): HTMLElement | null {
  for (let el = svg.value?.parentElement ?? null; el; el = el.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

/** The pointer that owns the stroke going on: a palm or a second pointer must not add to it. */
let activeId = -1;
let moved = false;
function down(e: PointerEvent): void {
  if (e.pointerType === 'pen') { ink.notePen(); penAt = Date.now(); penOver.value = true; }
  if (!props.editable) return;
  moved = false;
  if (e.pointerType === 'touch') {
    fingers.set(e.pointerId, e.clientY);
    if (fingers.size > 1) { cancel(); return; }
  }
  const role = penRole(e, prefs.labsDrawWithFinger);
  if (role === 'ignore' || isPalm(e)) return;
  // a stroke is going on: the other pointer is a palm or a second hand and must not capture it
  if (live.value) return;
  try { svg.value?.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer cannot be captured */ }
  activeId = e.pointerId;
  const erase = role === 'erase' || ink.eraser;
  const first = point(e);
  live.value = { points: [first], colour: ink.colour, erase };
  if (erase) erasing.value = eraseAt(props.strokes, first[0], first[1], ERASE_RADIUS);
  e.preventDefault();
}
function move(e: PointerEvent): void {
  if (e.pointerType === 'pen') penAt = Date.now();
  if (e.pointerType === 'touch' && fingers.size > 1) {
    const dy = (fingers.get(e.pointerId) ?? e.clientY) - e.clientY;
    fingers.set(e.pointerId, e.clientY);
    const el = scroller();
    if (el) el.scrollTop += dy;
    return;
  }
  const l = live.value;
  if (!l || e.pointerId !== activeId) return;
  moved = true;
  const coalesced = e.getCoalescedEvents?.() ?? [];
  for (const c of coalesced.length ? coalesced : [e]) {
    const p = point(c);
    l.points.push(p);
    if (l.erase) erasing.value = eraseAt(erasing.value ?? props.strokes, p[0], p[1], ERASE_RADIUS);
  }
}
function up(e: PointerEvent): void {
  fingers.delete(e.pointerId);
  if (e.pointerType === 'pen') penAt = Date.now();
  if (live.value && e.pointerId !== activeId) return;
  const l = live.value;
  live.value = null;
  if (!l) {
    // a click that drew nothing
    if (props.editable && !moved && e.pointerType !== 'pen') emit('tap');
    return;
  }
  if (!l.erase) l.points.push(point(e));
  const kept = erasing.value;
  erasing.value = null;
  if (l.erase) {
    if (kept && kept.length !== props.strokes.length) emit('change', kept);
    return;
  }
  emit('change', [...props.strokes, { p: l.points, ...(l.colour ? { c: l.colour } : {}), t: Date.now() }]);
}
/** The pen came into or left the line (hovering counts); a finger or mouse changes nothing. */
function penAbove(e: PointerEvent, over: boolean): void {
  if (e.pointerType === 'pen') penOver.value = over;
}
/** A pen the browser cancelled keeps what it wrote so far; any other cancel drops the stroke. */
function cancelled(e: PointerEvent): void {
  if (e.pointerType === 'pen' && live.value && e.pointerId === activeId) up(e);
  else cancel(e);
}
function cancel(e?: PointerEvent): void {
  if (e) fingers.delete(e.pointerId);
  live.value = null;
  erasing.value = null;
}

/** On iOS a stylus must not scroll: its touch is claimed here, a finger still scrolls (`touch-action: pan-y`). */
function stylusTouch(e: TouchEvent): void {
  if (props.editable && Array.from(e.changedTouches).some((t) => (t as Touch & { touchType?: string }).touchType === 'stylus')) e.preventDefault();
}

onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined' && svg.value) { observer = new ResizeObserver(measure); observer.observe(svg.value); }
  svg.value?.addEventListener('touchstart', stylusTouch, { passive: false });
  if (props.onCard && typeof MutationObserver !== 'undefined') {
    readText();
    themeWatch = new MutationObserver(readText);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: THEME_ATTRS });
    svg.value?.closest('.tl')?.addEventListener('transitionend', onTransitionEnd as EventListener);
    // the card's styles may land a tick after mount
    void nextTick(readText);
  }
});
watch(() => props.onCard, () => { if (props.onCard) readText(); }, { flush: 'post' });
onBeforeUnmount(() => {
  observer?.disconnect();
  themeWatch?.disconnect();
  svg.value?.closest('.tl')?.removeEventListener('transitionend', onTransitionEnd as EventListener);
  svg.value?.removeEventListener('touchstart', stylusTouch);
});
</script>

<template>
  <svg
    ref="svg" class="ink" :class="{ oncard: onCard, outlined: onCard && pointCount <= OUTLINE_MAX_POINTS, editable, finger: editable && prefs.labsDrawWithFinger, pen: editable && penOver }" :viewBox="viewBox" preserveAspectRatio="xMinYMid meet"
    data-testid="ink-line" :data-strokes="shown.length" :role="label ? 'img' : undefined" :aria-label="label" :aria-hidden="label ? undefined : 'true'"
    @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancelled"
    @pointerenter="penAbove($event, true)" @pointerleave="penAbove($event, false)"
  >
    <path v-for="(p, i) in paths" :key="i" class="p" :d="p.d" :style="p.style" data-testid="ink-stroke" :data-colour="p.colour" />
    <path v-if="livePath" class="p" :d="livePath" :style="liveColour" />
  </svg>
</template>

<style scoped>
.ink { display: block; width: 100%; height: var(--ink-h, 44px); overflow: hidden; color: var(--md-sys-color-on-surface); touch-action: auto; }
.p { fill: var(--l, currentColor); }
/* a card line is drawn small: a hairline outline keeps the thin strokes legible (skipped for huge ink: stroking tens of thousands of points stalls the paint) */
.outlined .p { stroke: var(--l, currentColor); stroke-width: 0.05; stroke-linejoin: round; }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) .p { fill: var(--d, currentColor); } }
:root[data-theme='dark'] .p { fill: var(--d, currentColor); }
/* a finger scrolls the list, a pen draws; with "Draw with finger" a single finger draws and scrolling takes two */
.editable { touch-action: pan-y; }
.editable.finger { touch-action: pinch-zoom; }
/* a pen over the line writes and never pans (on Windows the browser pans a pen on `pan-y` and cancels the stroke) */
.editable.pen { touch-action: none; }
</style>
