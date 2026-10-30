<script setup lang="ts">
/**
 * Bottom sheet on phones, centered modal (<= 520 px) from 768 px up. Used by every dialog.
 * Renders nothing while closed (v-if), so no DOM or references are retained. Escape / Cancel close;
 * the scrim closes only when `dismissOnScrim` (feature dialogs pass `!dirty`).
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { isPhone, acquireViewport } from '@/composables/useViewport';
import { appTimeout, listen, type Disposer } from '@/lib/timers';
import { createVelocityTracker } from '@/motion/spring';
import { getMotionLevel } from '@/motion/level';
import { useOverlayHistory } from '@/lib/overlayHistory';

const props = withDefaults(defineProps<{
  open: boolean; label: string; dismissOnScrim?: boolean; testid?: string;
  /** Extra attributes for the panel (data-*), inline style, desktop popover anchor, and opt-out of the built-in Escape handler. */
  panelAttrs?: Record<string, string>; panelStyle?: Record<string, string>; anchor?: { left: number; top: number; maxH: number } | null; escape?: boolean;
  /** A drawer from this screen edge, full height (the side menu), instead of a sheet or a modal. */
  side?: 'left' | 'right';
}>(), { dismissOnScrim: true, escape: true });
const emit = defineEmits<{ close: [] }>();
useOverlayHistory(() => props.open, () => emit('close'));
const panel = ref<HTMLElement | null>(null);
const drag = ref(0);
const release = acquireViewport();
defineExpose({ panel });
let stops: Disposer[] = [];
let opener: HTMLElement | null = null;

watch(() => props.open, async (o) => {
  stops.forEach((s) => s());
  stops = [];
  if (!o) {
    opener?.focus?.({ preventScroll: true });
    opener = null;
    return;
  }
  opener = document.activeElement as HTMLElement | null;
  await nextTick();
  panel.value?.focus({ preventScroll: true });
  stops.push(listen(document, 'keydown', (e) => { if (e.key === 'Escape' && props.escape) emit('close'); }));
}, { immediate: true });

onBeforeUnmount(() => { stops.forEach((s) => s()); release(); });

// Swipe-down-to-close anywhere on the sheet (phone only). Touch events so we can preventDefault once the drag is ours.
const SLOP = 8;
const CLOSE_FRAC = 0.25;
const CLOSE_VELOCITY = 700; // px/s
const NO_DRAG = 'input:not([type=checkbox]):not([type=radio]):not([type=button]),textarea,select,[contenteditable="true"],[data-no-sheet-drag]';
const TOP_ZONE = 56; // a touch this close to the sheet's top edge always drags (header/title), even if content is scrolled
const vt = createVelocityTracker(100);
let phase: 'idle' | 'pending' | 'drag' | 'ignore' = 'idle';
let sx = 0;
let sy = 0;
let height = 1;
let stopTimer: Disposer | undefined;
const closing = ref(false);

/** True when the touch started on the handle or on content that can still scroll up. */
function startsAtTop(t: HTMLElement): boolean {
  for (let n: HTMLElement | null = t; n && n !== panel.value; n = n.parentElement) if (n.scrollTop > 0) return false;
  return true;
}
function ts(e: TouchEvent) {
  if (props.side || !isPhone.value || closing.value || e.touches.length !== 1 || !panel.value) { phase = 'ignore'; return; }
  const t = e.target as HTMLElement;
  const inTop = e.touches[0].clientY - panel.value.getBoundingClientRect().top < TOP_ZONE;
  if (t.closest?.(NO_DRAG) || !(inTop || startsAtTop(t))) { phase = 'ignore'; return; }
  phase = 'pending';
  sx = e.touches[0].clientX;
  sy = e.touches[0].clientY;
  height = panel.value.offsetHeight || 1;
  vt.reset();
  vt.add(sx, sy, e.timeStamp);
}
function tm(e: TouchEvent) {
  if (phase !== 'pending' && phase !== 'drag') return;
  const x = e.touches[0].clientX;
  const y = e.touches[0].clientY;
  const dx = x - sx;
  const dy = y - sy;
  if (phase === 'pending') {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return;
    if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { phase = 'ignore'; return; }
    phase = 'drag';
  }
  if (e.cancelable) e.preventDefault();
  vt.add(x, y, e.timeStamp);
  drag.value = Math.max(0, dy - SLOP);
}
function te() {
  const was = phase;
  phase = 'idle';
  if (was !== 'drag') return;
  const shouldClose = drag.value > height * CLOSE_FRAC || (vt.velocity().vy > CLOSE_VELOCITY && drag.value > 0);
  if (!shouldClose) { drag.value = 0; return; }
  // Dirty guard (dismissOnScrim=false): ask the parent, spring back, let it show its confirm.
  if (!props.dismissOnScrim || getMotionLevel() === 'off') { emit('close'); drag.value = 0; return; }
  closing.value = true;
  drag.value = height;
  stopTimer = appTimeout(() => { emit('close'); closing.value = false; drag.value = 0; }, 180);
}
function tc() { phase = 'idle'; drag.value = 0; }

watch(panel, (el, _o, onCleanup) => {
  if (!el) return;
  const off = [
    listen(el, 'touchstart', ts as EventListener, { passive: true, capture: true }),
    listen(el, 'touchmove', tm as EventListener, { passive: false, capture: true }),
    listen(el, 'touchend', te, { capture: true }),
    listen(el, 'touchcancel', tc, { capture: true }),
  ];
  onCleanup(() => off.forEach((o) => o()));
});
onBeforeUnmount(() => stopTimer?.());
</script>

<template>
  <div v-if="open" class="layer" :class="[side ? `drawer side-${side}` : isPhone ? 'phone' : 'desk', { anchored: !side && !isPhone && !!anchor }]">
    <div class="scrim" data-testid="sheet-scrim" :style="drag ? { opacity: 1 - Math.min(1, drag / 400) } : undefined" @click="dismissOnScrim && emit('close')" />
    <section
      ref="panel" class="panel" role="dialog" aria-modal="true" :aria-label="label" tabindex="-1" :data-testid="testid"
      :data-presentation="side ? 'drawer' : isPhone ? 'sheet' : anchor ? 'popover' : 'modal'" v-bind="panelAttrs" :class="{ anchored: !side && !isPhone && !!anchor }"
      :style="[panelStyle, !isPhone && anchor ? { left: anchor.left + 'px', top: anchor.top + 'px', maxHeight: anchor.maxH + 'px' } : null, drag ? { transform: `translateY(${drag}px)`, transition: closing ? 'transform 180ms ease-in' : 'none' } : null]"
    >
      <div v-if="isPhone && !side" class="handle" aria-hidden="true"><span /></div>
      <div class="body"><slot /></div>
    </section>
  </div>
</template>

<style scoped>
.layer { position: fixed; inset: 0; z-index: 50; display: flex; }
.scrim { position: absolute; inset: 0; background: var(--md-sys-color-scrim, rgb(0 0 0 / 0.4)); animation: fade var(--md-sys-motion-duration-medium) both; }
.panel {
  position: relative; background: var(--md-sys-color-surface-container-low); color: var(--md-sys-color-on-surface); outline: 0;
  display: flex; flex-direction: column; max-height: 90dvh;
}
.phone { align-items: flex-end; }
.phone .panel {
  width: 100%; border-radius: var(--md-sys-shape-corner-extra-large) var(--md-sys-shape-corner-extra-large) 0 0;
  padding-bottom: var(--safe-bottom); animation: up 320ms var(--md-sys-motion-spring) both; transition: transform 200ms;
}
.desk.anchored .scrim { background: rgb(0 0 0 / 0.12); }
.desk .panel.anchored { position: fixed; width: min(380px, calc(100vw - 16px)); transform-origin: left top; }
.desk { align-items: center; justify-content: center; }
.desk .panel { width: min(520px, calc(100vw - 32px)); border-radius: var(--md-sys-shape-corner-extra-large); box-shadow: var(--md-sys-elevation-3); animation: zoom 260ms var(--md-sys-motion-spring) both; }
.drawer { align-items: stretch; }
.drawer.side-right { justify-content: flex-end; }
.drawer .panel { width: min(320px, 86vw); max-height: none; padding: var(--safe-top) 0 var(--safe-bottom); box-shadow: var(--md-sys-elevation-3); }
.drawer.side-left .panel { border-radius: 0 var(--md-sys-shape-corner-extra-large) var(--md-sys-shape-corner-extra-large) 0; padding-left: var(--safe-left); animation: from-left 280ms var(--md-sys-motion-emphasized) both; }
.drawer.side-right .panel { border-radius: var(--md-sys-shape-corner-extra-large) 0 0 var(--md-sys-shape-corner-extra-large); padding-right: var(--safe-right); animation: from-right 280ms var(--md-sys-motion-emphasized) both; }
.drawer .body { flex: 1; display: flex; flex-direction: column; padding: 12px; }
.handle { display: flex; justify-content: center; align-items: center; min-height: 44px; margin: -12px 0; touch-action: none; cursor: grab; flex: none; }
.handle span { width: 32px; height: 4px; border-radius: 2px; background: var(--md-sys-color-on-surface-variant); opacity: 0.4; }
.body { border-radius: inherit; /* clips the scrollbar to the panel's rounding */ overflow-y: auto; overscroll-behavior: contain; padding: 8px 16px 16px; min-height: 0; }
@keyframes fade { from { opacity: 0; } }
@keyframes up { from { transform: translateY(100%); } }
@keyframes from-left { from { transform: translateX(-100%); } }
@keyframes from-right { from { transform: translateX(100%); } }
@keyframes zoom { from { transform: scale(0.9); opacity: 0; } }
</style>
