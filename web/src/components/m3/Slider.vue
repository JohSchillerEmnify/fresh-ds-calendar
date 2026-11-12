<script setup lang="ts">
import { ref } from 'vue';
/**
 * Slider: a labelled native `input[type=range]` with its value shown next to the label. Keyboard (arrows, Home/End,
 * PageUp/PageDown) and screen readers come from the native control; `valueText` is what is shown and announced
 * (`aria-valuetext`, e.g. "4 px"). `update:modelValue` fires while moving (live preview), `commit` when a move ends
 * (end of a real drag, or each keyboard step; a tap or a vertical swipe changes nothing), so callers can save once.
 */
const props = defineProps<{ modelValue: number; min: number; max: number; label: string; valueText: string; step?: number; disabled?: boolean; testid?: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: number]; commit: [v: number] }>();

// A native range sets its value at the first touch, so a scrolling finger would change it: the input ignores the pointer
// and `.hit` lets a finger set it only after a horizontal drag past the slop; a mouse or pen click still sets it at once.
const SLOP = 8;
const THUMB = 16; // the native thumb's width: the value runs over the track minus one thumb
let drag: { x: number; y: number; from: number; id: number; live: boolean; last: number } | null = null;
const input = ref<HTMLInputElement | null>(null);

function snap(v: number): number {
  const step = props.step ?? 1;
  return Math.min(props.max, Math.max(props.min, props.min + Math.round((v - props.min) / step) * step));
}
function set(v: number, d: NonNullable<typeof drag>) {
  if (v === d.last) return;
  d.last = v;
  emit('update:modelValue', v);
}
function perPx(el: HTMLElement) { return (props.max - props.min) / Math.max(1, el.clientWidth - THUMB); }
function down(e: PointerEvent) {
  if (props.disabled) return;
  const el = e.currentTarget as HTMLElement;
  input.value?.focus({ preventScroll: true });
  drag = { x: e.clientX, y: e.clientY, from: props.modelValue, id: e.pointerId, live: e.pointerType !== 'touch', last: props.modelValue };
  if (!drag.live) return;
  el.setPointerCapture(e.pointerId);
  set(snap(props.min + (e.clientX - el.getBoundingClientRect().left - THUMB / 2) * perPx(el)), drag);
}
function move(e: PointerEvent) {
  const d = drag;
  if (!d || e.pointerId !== d.id) return;
  const el = e.currentTarget as HTMLElement;
  const dx = e.clientX - d.x;
  if (!d.live) {
    if (Math.abs(dx) < SLOP || Math.abs(dx) < Math.abs(e.clientY - d.y)) return;
    d.live = true;
    el.setPointerCapture(e.pointerId);
    set(snap(d.from + (dx - Math.sign(dx) * SLOP) * perPx(el)), d);
    return;
  }
  const base = e.pointerType === 'touch' ? d.from + (dx - Math.sign(dx) * SLOP) * perPx(el) : props.min + (e.clientX - el.getBoundingClientRect().left - THUMB / 2) * perPx(el);
  set(snap(base), d);
}
function up(e: PointerEvent) {
  const d = drag;
  if (!d || e.pointerId !== d.id) return;
  drag = null;
  if (d.live && d.last !== d.from) emit('commit', d.last);
}
</script>

<template>
  <div class="slider" :class="{ off: disabled }">
    <label class="row">
      <span class="lab">{{ label }}</span>
      <output class="val" :data-testid="testid ? `${testid}-value` : undefined">{{ valueText }}</output>
      <input
        ref="input" type="range" :min="min" :max="max" :step="step ?? 1" :value="modelValue" :disabled="disabled" :aria-valuetext="valueText"
        :data-testid="testid" @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
        @change="emit('commit', Number(($event.target as HTMLInputElement).value))"
      />
      <span v-if="!disabled" class="hit" :data-testid="testid ? `${testid}-hit` : undefined" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="drag = null" />
    </label>
  </div>
</template>

<style scoped>
.slider { flex: 1 1 100%; min-width: 0; }
.row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0 12px; }
.lab { font: var(--md-sys-typescale-body-large); padding: 4px 4px 0; }
.val { font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-on-surface-variant); font-variant-numeric: tabular-nums; }
input { grid-row: 2; pointer-events: none; grid-column: 1 / -1; width: 100%; min-height: 44px; margin: 0; accent-color: var(--md-sys-color-primary); cursor: pointer; background: transparent; }
.hit { grid-column: 1 / -1; grid-row: 2; align-self: stretch; touch-action: pan-y; cursor: pointer; }
input:disabled { cursor: default; }
.off { opacity: 0.38; }
input:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; border-radius: var(--md-sys-shape-corner-full); }
</style>
