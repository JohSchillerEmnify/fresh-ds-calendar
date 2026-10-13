<script setup lang="ts">
import { shownVersion } from '@/pwa/version';

/** Small build-version label in the bottom-left corner (pref `versionInCorner`); `raised` lifts it above the bottom bar. */
defineProps<{ raised: boolean }>();
const { version } = shownVersion();
</script>

<template>
  <span class="version-label" :class="{ raised }" data-testid="app-version">{{ version }}</span>
</template>

<style scoped>
/* Below dialogs and the FAB layer, never intercepts taps; the bottom bar (phone) is cleared via `raised`. */
.version-label {
  position: fixed; left: 8px; bottom: calc(var(--safe-bottom) + 4px); z-index: 20; pointer-events: none;
  font: var(--md-sys-typescale-label-small); color: var(--md-sys-color-on-surface-variant); opacity: 0.7;
}
.version-label.raised { bottom: calc(var(--navbar-h) + var(--safe-bottom) + 4px); }
</style>
