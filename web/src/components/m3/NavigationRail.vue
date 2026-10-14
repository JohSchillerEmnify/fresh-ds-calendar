<script setup lang="ts">
import { vRipple } from '@/lib/ripple';
import type { NavItem } from './types';
import { t } from '@/i18n';

/** `phone`: the slim rail of the phone layout, on `side` (the thumb side); otherwise the 80 px rail at the left. */
withDefaults(defineProps<{ items: NavItem[]; modelValue: string; phone?: boolean; side?: 'left' | 'right' }>(), { phone: false, side: 'left' });
defineEmits<{ 'update:modelValue': [id: string] }>();
</script>

<template>
  <nav class="rail" :class="[{ phone }, `side-${side}`]" data-testid="bottom-bar" data-position="rail" :data-side="side" data-safe-area="true" :aria-label="t('nav.views')">
    <div class="tabs" role="tablist" aria-orientation="vertical" data-testid="view-switcher" data-position="rail">
      <button
        v-for="it in items" :key="it.id" v-ripple class="dest" role="tab" type="button"
        :aria-selected="it.id === modelValue" :class="{ active: it.id === modelValue }" :data-testid="it.testid" :data-experimental="it.experimental ? 'true' : undefined"
        @click="$emit('update:modelValue', it.id)"
      >
        <span class="pill"><component :is="it.icon" /></span>
        <span class="lbl">{{ it.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.rail { width: var(--rail-w); flex: none; background: var(--md-sys-color-surface); padding: 12px 0; border-right: 1px solid var(--md-sys-color-outline-variant); }
.tabs { display: flex; flex-direction: column; gap: 12px; align-items: center; }
.dest { width: 72px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 0; color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-medium); border-radius: var(--md-sys-shape-corner-large); min-height: 44px; }
.pill { width: 56px; height: 32px; border-radius: var(--md-sys-shape-corner-full); display: flex; align-items: center; justify-content: center; }
.pill :deep(svg) { width: 24px; height: 24px; }
.active { color: var(--md-sys-color-on-surface); }
.active .pill { transition: background var(--md-sys-motion-duration-medium); background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
/* Phone: slim, on the thumb side; scrolls when the Labs views make it taller than the screen. */
.rail.phone { width: calc(var(--rail-w)); overflow-y: auto; padding: 8px 0 var(--safe-bottom); overscroll-behavior: contain; }
.rail.phone.side-left { border-right: 1px solid var(--md-sys-color-outline-variant); }
.rail.phone.side-right { border-right: 0; border-left: 1px solid var(--md-sys-color-outline-variant); }
.rail.phone.side-right { order: 1; } /* after the calendar column in the body row */
.rail.phone .tabs { gap: 8px; }
.rail.phone .dest { width: 100%; }
</style>
