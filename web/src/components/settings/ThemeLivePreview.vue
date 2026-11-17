<script setup lang="ts">
/**
 * Sticky live preview at the top of the theme menu (feature theme-menu): the sample calendar (`ThemePreview`, made of the
 * app's own top bar and week grid) under the `<html>` theme attributes, so every theme change (including a slider before
 * release) shows at once. The content is inert; only the handle below it is interactive and folds the preview to a thin
 * top bar strip, remembered per device.
 */
import Pressable from '@/components/m3/Pressable.vue';
import { useBarSize } from '@/composables/useBarSize';
import { computed, ref, watch } from 'vue';
import { IconExpandMore as IconExpand } from '@/components/icons';
import { t } from '@/i18n';
import { useThemeStore } from '@/stores/theme';
import { resolveTheme as resolveMode } from '@/theme';
import { useSettingsStore } from '@/stores/settings';
import ThemePreview from './ThemePreview.vue';
import { readCollapsed, writeCollapsed } from './themeLivePreviewSample';

const barSize = useBarSize().top;
const theme = useThemeStore();
const settings = useSettingsStore();
const dark = computed(() => resolveMode(theme.resolved.mode ?? settings.settings.themeMode) === 'dark');

const collapsed = ref(readCollapsed());
watch(collapsed, writeCollapsed);
</script>

<template>
  <section class="live" :class="{ collapsed }" :data-bar="barSize" data-testid="theme-live-preview" :data-collapsed="collapsed" :aria-label="t('themePreview.label')">
    <ThemePreview class="pv" :theme="theme.resolved" :dark="dark" :bar-only="collapsed" />
    <Pressable class="handle" type="button" data-testid="theme-live-preview-toggle" :aria-expanded="!collapsed" :aria-label="collapsed ? t('themePreview.expand') : t('themePreview.collapse')" @click="collapsed = !collapsed">
      <IconExpand class="chev" :class="{ up: !collapsed }" aria-hidden="true" />
    </Pressable>
  </section>
</template>

<style scoped>
/* pinned under the menu header (safe area + 8 + 44 + 8 px); on the desktop the same offset in the right column */
.live { position: sticky; top: calc(var(--safe-top) + 64px); z-index: 1; display: flex; flex-direction: column; border-radius: var(--md-sys-shape-corner-large); overflow: hidden; background: var(--md-sys-color-surface); box-shadow: 0 0 0 1px var(--md-sys-color-outline-variant), var(--md-sys-elevation-2); }
.pv { max-height: 34vh; }
.live[data-bar='compact'] { top: calc(var(--safe-top) + 56px); }
.handle { display: flex; align-items: center; justify-content: center; height: 24px; border: 0; background: var(--md-sys-color-surface-container); color: var(--md-sys-color-on-surface-variant); cursor: pointer; }
.chev { width: 20px; height: 20px; transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring); }
.chev.up { transform: rotate(180deg); }
</style>
