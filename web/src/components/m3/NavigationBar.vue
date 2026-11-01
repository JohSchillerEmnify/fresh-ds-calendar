<script setup lang="ts">
import type { NavItem } from './types';
import { t } from '@/i18n';
import NavTablist from './NavTablist.vue';
import { onBeforeUnmount, onMounted } from 'vue';
import { barHostsRow } from '@/lib/barHost';

/** `size`: Expressive (64 px, a label on every item) or Compact (52 px, only the open view labelled); `hidden`: slid out of the viewport (scrolling down). */
withDefaults(defineProps<{ items: NavItem[]; modelValue: string; size?: 'expressive' | 'compact'; hidden?: boolean }>(), { size: 'expressive', hidden: false });
defineEmits<{ 'update:modelValue': [id: string] }>();
/** The tray puts its open tasks row into this bar while it is drawn. */
onMounted(() => { barHostsRow.value = true; });
onBeforeUnmount(() => { barHostsRow.value = false; });
</script>

<template>
  <nav class="nav-bar" data-testid="bottom-bar" data-position="bottom" data-safe-area="true" :data-size="size" :data-hidden="hidden ? 'true' : 'false'" :inert="hidden" :aria-label="t('nav.views')">
    <div id="bar-extra" class="extra" />
    <NavTablist :items="items" :model-value="modelValue" pill data-testid="view-switcher" data-position="bottom" @update:model-value="$emit('update:modelValue', $event)" />
  </nav>
</template>

<style scoped>
/* Floats above the calendar: a round bar inset from the edges, its own height (--nb-h) without the safe area, which only lifts it. */
.nav-bar {
  position: fixed; left: 12px; right: 12px; bottom: calc(var(--safe-bottom) + 8px); z-index: 6; display: flex; flex-direction: column;
  background: var(--md-sys-color-surface-container); border-radius: calc(var(--nb-h) / 2); box-shadow: var(--md-sys-elevation-3);
  transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-emphasized);
}
.nav-bar[data-size='expressive'] { --nb-h: 64px; }
.nav-bar[data-size='compact'] { --nb-h: 52px; }
.nav-bar[data-hidden='true'] { transform: translateY(calc(100% + var(--safe-bottom) + 16px)); }
/* Tablet and desktop: the same floating bar, 16 px from the edges; the body reserves its room (App.vue) */
@media (min-width: 768px) {
  .nav-bar { left: 16px; right: 16px; bottom: calc(var(--safe-bottom) + 16px); }
}
/* Phone, Expressive, calendar views: the + button stands beside the bar (never over its open tasks row) */
@media (max-width: 767.98px) {
  html[data-fab-beside='true'] .nav-bar[data-size='expressive'] { right: calc(16px + 64px + 12px); }
  html[data-hand='left'][data-touch][data-fab-beside='true'] .nav-bar[data-size='expressive'] { right: 12px; left: calc(16px + 64px + 12px); }
}
/* Compact: the + button sits beside the bar, on the thumb side (feature nav-expressive). */
.nav-bar[data-size='compact'] { right: calc(12px + 52px + 8px); }
html[data-hand='left'][data-touch] .nav-bar[data-size='compact'] { right: 12px; left: calc(12px + 52px + 8px); }
.extra:empty { display: none; }
.extra { flex: none; padding-top: 4px; }
.tabs { display: flex; height: var(--nb-h); flex: none; padding: 0 4px; }
.tabs :deep(.dest) {
  flex: 1; min-width: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-medium); border-radius: var(--md-sys-shape-corner-full);
}
.tabs :deep(.pill) {
  width: 56px; height: 32px; border-radius: var(--md-sys-shape-corner-full); display: flex; align-items: center; justify-content: center;
  transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring);
}
.tabs :deep(.pill svg) { width: 24px; height: 24px; }
.tabs :deep(.active) { color: var(--md-sys-color-on-surface); }
/* Fade only INTO the active state; the previously active tab (e.g. Year) must not animate when another tab is tapped. */
.tabs :deep(.active .pill) { transition: background var(--md-sys-motion-duration-medium), transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring); background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.tabs :deep(.dest:active .pill) { transform: scale(0.9); }
/* Compact: icons only, the open view's label beside its icon in the pill. */
.nav-bar[data-size='compact'] .tabs :deep(.dest) { flex-direction: row; justify-content: center; }
.nav-bar[data-size='compact'] .tabs :deep(.dest:not(.active) .lbl) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.nav-bar[data-size='compact'] .tabs :deep(.dest.active) { flex: 2; background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.nav-bar[data-size='compact'] .tabs :deep(.pill) { width: 32px; background: transparent; }
.nav-bar[data-size='compact'] .tabs :deep(.active .pill) { background: transparent; }
</style>
