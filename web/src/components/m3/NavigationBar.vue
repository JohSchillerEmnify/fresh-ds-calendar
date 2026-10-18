<script setup lang="ts">
import type { NavItem } from './types';
import { t } from '@/i18n';
import NavTablist from './NavTablist.vue';

defineProps<{ items: NavItem[]; modelValue: string }>();
defineEmits<{ 'update:modelValue': [id: string] }>();
</script>

<template>
  <nav class="nav-bar" data-testid="bottom-bar" data-position="bottom" data-safe-area="true" :aria-label="t('nav.views')">
    <NavTablist :items="items" :model-value="modelValue" pill data-testid="view-switcher" data-position="bottom" @update:model-value="$emit('update:modelValue', $event)" />
  </nav>
</template>

<style scoped>
.nav-bar {
  flex: none; background: var(--md-sys-color-surface-container); padding-bottom: var(--safe-bottom);
  position: relative; z-index: 6;
}
.tabs { display: flex; height: var(--navbar-h); padding: 0 4px; }
.tabs :deep(.dest) {
  flex: 1; min-width: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-medium); border-radius: var(--md-sys-shape-corner-large);
}
.tabs :deep(.pill) {
  width: 64px; height: 32px; border-radius: var(--md-sys-shape-corner-full); display: flex; align-items: center; justify-content: center;
  transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring);
}
.tabs :deep(.pill svg) { width: 24px; height: 24px; }
.tabs :deep(.active) { color: var(--md-sys-color-on-surface); }
/* Fade only INTO the active state; the previously active tab (e.g. Year) must not animate when another tab is tapped. */
.tabs :deep(.active .pill) { transition: background var(--md-sys-motion-duration-medium), transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring); background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.tabs :deep(.dest:active .pill) { transform: scale(0.9); }
</style>
