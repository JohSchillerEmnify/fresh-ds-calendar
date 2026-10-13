<script setup lang="ts">
import type { NavItem } from './types';
import { t } from '@/i18n';
import { vRipple } from '@/lib/ripple';


defineProps<{ items: NavItem[]; modelValue: string }>();
defineEmits<{ 'update:modelValue': [id: string] }>();
</script>

<template>
  <nav class="nav-bar" data-testid="bottom-bar" data-safe-area="true" :aria-label="t('nav.views')">
    <div class="tabs" role="tablist" data-testid="view-switcher">
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
.nav-bar {
  flex: none; background: var(--md-sys-color-surface-container); padding-bottom: var(--safe-bottom);
  position: relative; z-index: 6;
}
.tabs { display: flex; height: var(--navbar-h); padding: 0 4px; }
.dest {
  flex: 1; min-width: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-medium); border-radius: var(--md-sys-shape-corner-large);
}
.pill {
  width: 64px; height: 32px; border-radius: var(--md-sys-shape-corner-full); display: flex; align-items: center; justify-content: center;
  transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring);
}
.pill :deep(svg) { width: 24px; height: 24px; }
.active { color: var(--md-sys-color-on-surface); }
/* Fade only INTO the active state; the previously active tab (e.g. Year) must not animate when another tab is tapped. */
.active .pill { transition: background var(--md-sys-motion-duration-medium), transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring); background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.dest:active .pill { transform: scale(0.9); }
</style>
