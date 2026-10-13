<script setup lang="ts">
import { IconAdd } from '@/components/icons';
import Fab from '@/components/m3/Fab.vue';
import { openNew } from '@/extensions/create';
import { isPhone } from '@/composables/useViewport';
import { useUiStore } from '@/stores/ui';

/** FAB: opens the one "new" dialog (event or task list, switchable there). */
const ui = useUiStore();
</script>

<template>
  <div class="fab-wrap" :class="{ away: isPhone && ui.trayExpanded }" data-testid="create-fab-area" :inert="isPhone && ui.trayExpanded">
    <Fab label="Create" data-testid="create-button" @click="openNew()"><IconAdd /></Fab>
  </div>
</template>

<style scoped>
.fab-wrap {
  position: fixed; right: calc(16px + var(--safe-right)); bottom: calc(var(--navbar-h) + var(--safe-bottom) + 12px); /* phone: floats over the tray bar (its toggle keeps clear), inside thumb reach */
  z-index: 30; display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
}
.fab-wrap { transition: transform 220ms var(--md-sys-motion-spring), opacity 160ms linear; }
/* Phone: slides out to the right while the open tasks tray is expanded (it would cover the tray's controls). */
.fab-wrap.away { transform: translateX(calc(100% + 24px)); opacity: 0; pointer-events: none; }
@media (min-width: 768px) { .fab-wrap { bottom: 24px; right: calc(var(--tray-w, 0px) + 24px); } } /* left of the tray panel */
</style>
