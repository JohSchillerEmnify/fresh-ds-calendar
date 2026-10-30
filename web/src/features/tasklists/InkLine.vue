<script setup lang="ts">
/** One line of ink (feature handwritten-lists): SVG in line-height units; editable takes pen strokes and erasing, `change` reports all strokes. */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { InkPoint, InkStroke } from '@/api/types';
import { eraseAt, penRole, readableInk, strokePath, toLineUnits } from '@/lib/ink';
import { useInkStore } from '@/stores/ink';
import { usePrefsStore } from '@/stores/prefs';

const props = defineProps<{
  strokes: InkStroke[];
  editable?: boolean;
  /** Spoken name of the line (a screen reader reads "Handwritten item 2 of 5"). */
  label?: string;
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
/** A pen was last at work at this time (ms); a touch right after it is a palm (decision R1). */
let penAt = 0;
const PALM_MS = 800;
const PALM_WIDTH = 40;
const ERASE_RADIUS = 0.35;

const shown = computed(() => erasing.value ?? props.strokes);
/** The width of the line in line heights: wide enough for the ink, so a narrow line scales it down instead of cutting it off. */
const widthUnits = ref(10);
const reach = computed(() => Math.max(1, ...shown.value.flatMap((s) => s.p.map((q) => q[0] + 0.3))));
const viewBox = computed(() => `0 0 ${Math.max(widthUnits.value, reach.value)} 1`);

const paths = computed(() => shown.value.map((s) => ({
  d: strokePath(s.p),
  style: s.c ? { '--l': readableInk(s.c, false), '--d': readableInk(s.c, true) } : {},
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

let moved = false;
function down(e: PointerEvent): void {
  if (e.pointerType === 'pen') { ink.notePen(); penAt = Date.now(); }
  if (!props.editable) return;
  moved = false;
  if (e.pointerType === 'touch') {
    fingers.set(e.pointerId, e.clientY);
    if (fingers.size > 1) { cancel(); return; }
  }
  const role = penRole(e, prefs.labsDrawWithFinger);
  if (role === 'ignore' || isPalm(e)) return;
  try { svg.value?.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer cannot be captured */ }
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
  if (!l) return;
  moved = true;
  for (const c of e.getCoalescedEvents?.() ?? [e]) {
    const p = point(c);
    l.points.push(p);
    if (l.erase) erasing.value = eraseAt(erasing.value ?? props.strokes, p[0], p[1], ERASE_RADIUS);
  }
}
function up(e: PointerEvent): void {
  fingers.delete(e.pointerId);
  if (e.pointerType === 'pen') penAt = Date.now();
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
  emit('change', [...props.strokes, { p: l.points, ...(l.colour ? { c: l.colour } : {}) }]);
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
});
onBeforeUnmount(() => {
  observer?.disconnect();
  svg.value?.removeEventListener('touchstart', stylusTouch);
});
</script>

<template>
  <svg
    ref="svg" class="ink" :class="{ editable, finger: editable && prefs.labsDrawWithFinger }" :viewBox="viewBox" preserveAspectRatio="xMinYMid meet"
    data-testid="ink-line" :data-strokes="shown.length" :role="label ? 'img' : undefined" :aria-label="label" :aria-hidden="label ? undefined : 'true'"
    @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancel($event)"
  >
    <path v-for="(p, i) in paths" :key="i" class="p" :d="p.d" :style="p.style" data-testid="ink-stroke" />
    <path v-if="livePath" class="p" :d="livePath" :style="liveColour" />
  </svg>
</template>

<style scoped>
.ink { display: block; width: 100%; height: var(--ink-h, 44px); overflow: hidden; color: var(--md-sys-color-on-surface); touch-action: auto; }
.p { fill: var(--l, currentColor); }
@media (prefers-color-scheme: dark) { :global(:root:not([data-theme='light'])) .p { fill: var(--d, currentColor); } }
:global(:root[data-theme='dark']) .p { fill: var(--d, currentColor); }
/* a finger scrolls the list, a pen draws; with "Draw with finger" a single finger draws and scrolling takes two */
.editable { touch-action: pan-y; }
.editable.finger { touch-action: pinch-zoom; }
</style>
