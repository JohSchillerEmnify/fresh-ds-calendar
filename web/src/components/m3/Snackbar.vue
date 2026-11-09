<script setup lang="ts">
import { useMutationObserver, useResizeObserver } from '@vueuse/core';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t } from '@/i18n';
import { appTimeout, type Disposer } from '@/lib/timers';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const host = ref<HTMLElement | null>(null);
/** While a snackbar stays, the page leaves the strip it covers free (`--snack-room`, used by the shell), so no control sits under it. */
function measure() {
  const el = host.value;
  const room = el && ui.snackbars.some((s) => s.duration === 0) ? el.offsetHeight + (parseFloat(getComputedStyle(el).bottom) || 0) : 0;
  document.documentElement.style.setProperty('--snack-room', `${room}px`);
}
useResizeObserver(host, measure);
// the bar sliding away or the layout switching moves the snackbar without resizing it
useMutationObserver(document.documentElement, measure, { attributes: true, attributeFilter: ['data-bar-hidden', 'data-bar-size', 'data-nav-pos'] });
watch(() => ui.snackbars, () => void nextTick(measure), { deep: true });
const timers = new Map<number, Disposer>();
function arm() {
  for (const s of ui.snackbars) {
    if (s.duration > 0 && !timers.has(s.id)) {
      timers.set(s.id, appTimeout(() => { timers.delete(s.id); ui.dismiss(s.id); }, s.duration));
    }
  }
  for (const [id, stop] of timers) if (!ui.snackbars.some((s) => s.id === id)) { stop(); timers.delete(id); }
}
const stopWatch = ui.$subscribe(arm);
onMounted(() => { arm(); measure(); });
onBeforeUnmount(() => { document.documentElement.style.removeProperty('--snack-room'); stopWatch(); timers.forEach((s) => s()); timers.clear(); });
</script>

<template>
  <div ref="host" class="host" aria-live="polite">
    <div v-for="s in ui.snackbars" :key="s.id" class="snack snack-skin" role="status" :aria-live="s.countdown ? 'off' : undefined" :data-testid="s.testid ?? 'snackbar'">
      <span class="msg" data-testid="snackbar-text">{{ s.text }}</span>
      <button v-if="s.action" class="act" type="button" :data-testid="s.action.testid" @click="s.action.run(); if (!s.action.keep) ui.dismiss(s.id)">{{ s.action.label }}</button>
      <button class="x" type="button" :aria-label="t('calendar.actions.dismiss')" :data-testid="s.dismissTestid ?? (s.testid ? s.testid + '-dismiss' : 'snackbar-dismiss')" @click="s.onClose?.(); ui.dismiss(s.id)">✕</button>
    </div>
  </div>
</template>

<style scoped>
.host { position: fixed; left: 0; right: 0; bottom: calc(var(--navbar-h) + var(--safe-bottom) + 8px); z-index: 60; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 0 12px; pointer-events: none; }
@media (min-width: 768px) { .host { bottom: 16px; } }
.snack {
  pointer-events: auto; display: flex; align-items: center; gap: 4px; min-height: 48px; max-width: 560px; width: 100%; padding: 4px 4px 4px 16px;
  animation: in 250ms var(--md-sys-motion-spring) both;
}
.msg { flex: 1; min-width: 0; }
.act, .x { min-width: 44px; min-height: 44px; font: var(--md-sys-typescale-label-large); color: var(--snack-action); border-radius: var(--md-sys-shape-corner-full); }
@keyframes in { from { transform: translateY(16px); opacity: 0; } }
/* Left-handed mode (phone, touch tablet): the action and the dismiss button sit at the left end. */
html[data-hand='left'][data-touch] .snack { flex-direction: row-reverse; padding: 4px 16px 4px 4px; }
</style>
