<script setup lang="ts">
/**
 * Bottom sheet on phones, centered modal (<= 520 px) from 768 px up. Used by every dialog.
 * Renders nothing while closed (v-if), so no DOM or references are retained. Escape / Cancel close;
 * the scrim closes only when `dismissOnScrim` (feature dialogs pass `!dirty`).
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { isPhone, acquireViewport } from '@/composables/useViewport';
import { listen, type Disposer } from '@/lib/timers';

const props = withDefaults(defineProps<{ open: boolean; label: string; dismissOnScrim?: boolean; testid?: string }>(), { dismissOnScrim: true });
const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement | null>(null);
const drag = ref(0);
const release = acquireViewport();
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
  stops.push(listen(document, 'keydown', (e) => { if (e.key === 'Escape') emit('close'); }));
}, { immediate: true });

onBeforeUnmount(() => { stops.forEach((s) => s()); release(); });

let startY = 0;
function down(e: PointerEvent) {
  if (!isPhone.value) return;
  startY = e.clientY;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (startY) drag.value = Math.max(0, e.clientY - startY);
}
function up() {
  if (drag.value > 90) emit('close');
  drag.value = 0;
  startY = 0;
}
</script>

<template>
  <div v-if="open" class="layer" :class="isPhone ? 'phone' : 'desk'">
    <div class="scrim" data-testid="sheet-scrim" @click="dismissOnScrim && emit('close')" />
    <section
      ref="panel" class="panel" role="dialog" aria-modal="true" :aria-label="label" tabindex="-1" :data-testid="testid"
      :data-presentation="isPhone ? 'sheet' : 'modal'" :style="drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined"
    >
      <div v-if="isPhone" class="handle" aria-hidden="true" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"><span /></div>
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
.desk { align-items: center; justify-content: center; }
.desk .panel { width: min(520px, calc(100vw - 32px)); border-radius: var(--md-sys-shape-corner-extra-large); box-shadow: var(--md-sys-elevation-3); animation: zoom 260ms var(--md-sys-motion-spring) both; }
.handle { display: flex; justify-content: center; padding: 12px 0 4px; touch-action: none; cursor: grab; flex: none; }
.handle span { width: 32px; height: 4px; border-radius: 2px; background: var(--md-sys-color-on-surface-variant); opacity: 0.4; }
.body { overflow-y: auto; overscroll-behavior: contain; padding: 8px 16px 16px; min-height: 0; }
@keyframes fade { from { opacity: 0; } }
@keyframes up { from { transform: translateY(100%); } }
@keyframes zoom { from { transform: scale(0.9); opacity: 0; } }
</style>
