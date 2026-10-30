<script setup lang="ts">
/** A tonal "More" icon button that opens a small menu card under it (the card's secondary actions); closes on Escape, a press outside or a choice. */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { IconMoreHoriz } from '@/components/icons';
import { listen, type Disposer } from '@/lib/timers';
import { vRipple } from '@/lib/ripple';
import type { MenuItem } from './types';

const props = defineProps<{ label: string; items: MenuItem[]; testid?: string; danger?: string[] }>();
const emit = defineEmits<{ select: [id: string] }>();
const open = ref(false);
const trigger = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const pos = ref({ top: 0, right: 0 });
let stops: Disposer[] = [];

function close(refocus = false): void {
  open.value = false;
  if (refocus) trigger.value?.focus({ preventScroll: true });
}
function toggle(): void {
  if (open.value) return close();
  // fixed under the button, right edges aligned: no ancestor can clip it
  const r = trigger.value!.getBoundingClientRect();
  pos.value = { top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) };
  open.value = true;
}
function choose(id: string): void {
  close(true);
  emit('select', id);
}
function onKey(e: KeyboardEvent): void {
  const els = [...(panel.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const i = els.indexOf(document.activeElement as HTMLElement);
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
}
watch(open, async (o) => {
  stops.forEach((s) => s());
  stops = [];
  if (!o) return;
  await nextTick();
  // near the bottom edge the card opens upwards instead of leaving the screen
  const h = panel.value?.offsetHeight ?? 0;
  const r = trigger.value!.getBoundingClientRect();
  if (pos.value.top + h > window.innerHeight - 8) pos.value = { ...pos.value, top: Math.max(8, r.top - 4 - h) };
  panel.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  stops.push(listen(document, 'pointerdown', (e) => {
    const n = e.target as Node;
    if (!panel.value?.contains(n) && !trigger.value?.contains(n)) close();
  }, { capture: true }));
});
onBeforeUnmount(() => stops.forEach((s) => s()));
</script>

<template>
  <span class="om">
    <button
      ref="trigger" v-ripple class="more" :class="{ on: open }" type="button" :aria-label="label" :title="label" aria-haspopup="menu" :aria-expanded="open" :data-testid="testid"
      @click="toggle"
    ><IconMoreHoriz /></button>
    <Teleport to="body">
      <div v-if="open" ref="panel" class="panel" role="menu" :aria-label="label" :style="{ top: pos.top + 'px', right: pos.right + 'px' }" @keydown="onKey">
        <button
          v-for="it in props.items" :key="it.id" v-ripple class="item" :class="{ danger: props.danger?.includes(it.id) }" role="menuitem" type="button" :data-testid="it.testid"
          @click="choose(it.id)"
        >
          <component :is="it.icon" v-if="it.icon" aria-hidden="true" />
          <span>{{ it.label }}</span>
        </button>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.more {
  position: relative; width: 48px; height: 48px; flex: none; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--md-sys-shape-corner-full);
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);
  transition: border-radius var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring);
}
.more.on { border-radius: var(--md-sys-shape-corner-large); background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
.more :deep(svg) { width: 24px; height: 24px; }
.panel {
  position: fixed; z-index: 70; min-width: 220px; padding: 8px; border-radius: var(--md-sys-shape-corner-extra-large); display: flex; flex-direction: column; gap: 2px;
  background: var(--md-sys-color-surface-container-high); box-shadow: var(--md-sys-elevation-3);
}
.item { min-height: 52px; padding: 0 16px; border-radius: var(--md-sys-shape-corner-large); display: flex; align-items: center; gap: 12px; text-align: left; font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-on-surface); }
.item:focus-visible { background: var(--md-sys-color-secondary-container); }
@media (hover: hover) { .item:hover { background: var(--md-sys-color-secondary-container); } }
.item :deep(svg) { width: 24px; height: 24px; }
.danger { color: var(--md-sys-color-error); }
</style>
