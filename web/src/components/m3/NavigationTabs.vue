<script setup lang="ts">
/** The view switcher as a tabs row under the top app bar (position `top`); same tab markup as the bar and the rail. */
import type { NavItem } from './types';
import { t } from '@/i18n';
import NavTablist from './NavTablist.vue';

defineProps<{ items: NavItem[]; modelValue: string }>();
defineEmits<{ 'update:modelValue': [id: string] }>();
</script>

<template>
  <nav class="nav-tabs" data-testid="nav-tabs" :aria-label="t('nav.views')">
    <NavTablist :items="items" :model-value="modelValue" data-testid="view-switcher" data-position="top" @update:model-value="$emit('update:modelValue', $event)" />
  </nav>
</template>

<style scoped>
.nav-tabs { flex: none; background: var(--md-sys-color-surface); border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.tabs { display: flex; min-height: 48px; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tabs :deep(.dest) {
  flex: 1 0 auto; min-width: 44px; min-height: 48px; padding: 0 16px; position: relative; display: flex; align-items: center; justify-content: center;
  color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-title-small);
}
.tabs :deep(.active) { color: var(--md-sys-color-primary); }
/* Fade only INTO the active state, like the bottom bar: the previously active tab must not animate. */
.tabs :deep(.dest::after) {
  content: ''; position: absolute; left: 16px; right: 16px; bottom: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--md-sys-color-primary);
  transform: scaleX(0); transition: none;
}
.tabs :deep(.active::after) { transform: scaleX(1); transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring); }
</style>
