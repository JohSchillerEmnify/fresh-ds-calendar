<script setup lang="ts">
/** A tonal "More" icon button that opens a small menu card under it (the card's secondary actions); closes on Escape, a press outside or a choice. */
import { nextTick, ref, watch } from 'vue';
import { useMenuNav } from '@/composables/useMenuNav';
import { IconMoreHoriz } from '@/components/icons';
import { vRipple } from '@/lib/ripple';
import type { MenuItem } from './types';

const props = defineProps<{ label: string; items: MenuItem[]; testid?: string; danger?: string[] }>();
const emit = defineEmits<{ select: [id: string] }>();
const open = ref(false);
const trigger = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const pos = ref({ top: 0, right: 0 });
/** Where the card goes: the enclosing modal dialog (so the dialog stays modal for it), else the body. */
const host = ref<HTMLElement | 'body'>('body');
const MIN_W = 220;
const EDGE = 8;

function close(refocus = false): void {
  open.value = false;
  if (refocus) trigger.value?.focus({ preventScroll: true });
}
function toggle(): void {
  if (open.value) return close();
  // fixed under the button, right edges aligned: no ancestor can clip it
  const r = trigger.value!.getBoundingClientRect();
  host.value = trigger.value!.closest<HTMLElement>('[role="dialog"]') ?? 'body';
  pos.value = { top: r.bottom + 4, right: Math.min(Math.max(EDGE, window.innerWidth - r.right), window.innerWidth - MIN_W - EDGE) };
  open.value = true;
}
function choose(id: string): void {
  close(true);
  emit('select', id);
}
const { onKey } = useMenuNav({ open: () => open.value, panel, trigger, close, closeOnMove: true });
watch(open, async (o) => {
  if (!o) return;
  await nextTick();
  const el = panel.value;
  if (!el) return;
  const pr = el.getBoundingClientRect();
  // no layout (nothing measured yet): keep the first guess
  if (!pr.width && !pr.height) return;
  // below the button, or above it near the bottom edge; never past the left edge
  const r = trigger.value!.getBoundingClientRect();
  const top = r.bottom + 4 + pr.height > window.innerHeight - EDGE ? Math.max(EDGE, r.top - 4 - pr.height) : r.bottom + 4;
  const rightEdge = Math.max(pr.width + EDGE, Math.min(r.right, window.innerWidth - EDGE));
  // a transformed ancestor (a sheet mid-animation) moves the origin of fixed coordinates: correct by what was measured
  pos.value = { top: pos.value.top + (top - pr.top), right: pos.value.right - (rightEdge - pr.right) };
});
</script>

<template>
  <span class="om">
    <button
      ref="trigger" v-ripple class="more" :class="{ on: open }" type="button" :aria-label="label" :title="label" aria-haspopup="menu" :aria-expanded="open" :data-testid="testid"
      @click="toggle" @keydown="onKey"
    ><IconMoreHoriz /></button>
    <Teleport :to="host">
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
