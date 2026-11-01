<script setup lang="ts">
/** M3 modal navigation drawer: the view destinations on top, a `default` slot for more content, a `footer` slot at the bottom. */
import type { NavItem } from './types';
import { vRipple } from '@/lib/ripple';
import AdaptiveSheet from './AdaptiveSheet.vue';

defineProps<{ open: boolean; label: string; items: NavItem[]; modelValue: string; side: 'left' | 'right' }>();
defineEmits<{ close: []; 'update:modelValue': [id: string] }>();
</script>

<template>
  <AdaptiveSheet :open="open" :label="label" :side="side" testid="side-menu" :panel-attrs="{ 'data-open': 'true' }" @close="$emit('close')">
    <nav class="views" :aria-label="label">
      <button
        v-for="it in items" :key="it.id" v-ripple class="dest" type="button" :class="{ active: it.id === modelValue }" :aria-current="it.id === modelValue ? 'page' : undefined"
        :data-testid="`side-menu-view-${it.id}`" @click="$emit('update:modelValue', it.id)"
      >
        <component :is="it.icon" class="ico" /><span>{{ it.label }}</span>
      </button>
    </nav>
    <div class="mid"><slot /></div>
    <div class="foot"><slot name="footer" /></div>
  </AdaptiveSheet>
</template>

<style scoped>
.views { display: flex; flex-direction: column; gap: 2px; }
.dest { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 16px; border-radius: var(--md-sys-shape-corner-full); font: var(--md-sys-typescale-label-large); color: var(--md-sys-color-on-surface-variant); text-align: left; }
.dest.active { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.ico { width: 24px; height: 24px; flex: none; }
.mid { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 0; }
.foot { flex: none; border-top: 1px solid var(--md-sys-color-outline-variant); padding-top: 8px; }
</style>
