<script setup lang="ts">
import { ref } from 'vue';
import { useMenuNav } from '@/composables/useMenuNav';
import { vRipple } from '@/lib/ripple';

import type { MenuItem } from './types';
const props = defineProps<{ open: boolean; items: MenuItem[]; label: string; testid?: string }>();
const emit = defineEmits<{ close: []; select: [id: string] }>();
const root = ref<HTMLElement | null>(null);
const { onKey } = useMenuNav({ open: () => props.open, panel: root, close: () => emit('close') });
</script>

<template>
  <div v-if="open" ref="root" class="menu" role="menu" :aria-label="label" :data-testid="testid" @keydown="onKey">
    <button
      v-for="(it, i) in items" :key="it.id" v-ripple class="item" role="menuitem" type="button" :data-testid="it.testid"
      :style="{ '--i': i }" @click="emit('select', it.id)"
    >
      <component :is="it.icon" v-if="it.icon" aria-hidden="true" />
      <span>{{ it.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.menu {
  display: flex; flex-direction: column; gap: 8px; align-items: flex-end;
}
.item {
  min-height: 48px; padding: 0 20px 0 16px; border-radius: var(--md-sys-shape-corner-large); display: flex; align-items: center; gap: 12px;
  background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);
  font: var(--md-sys-typescale-label-large); box-shadow: var(--md-sys-elevation-1);
  animation: pop var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring) both; animation-delay: calc(var(--i) * 30ms);
}
.item :deep(svg) { width: 22px; height: 22px; }
@keyframes pop { from { opacity: 0; transform: translateY(12px) scale(0.9); } }
html[data-hand='left'][data-touch] .menu { align-items: flex-start; }
</style>
