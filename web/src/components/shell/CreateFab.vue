<script setup lang="ts">
import IconAdd from '~icons/material-symbols/add';
import Fab from '@/components/m3/Fab.vue';
import { useRoute } from 'vue-router';
import { openNew, openNewUndated } from '@/extensions/create';
import { isPhone } from '@/composables/useViewport';
import { useUiStore } from '@/stores/ui';

/** FAB: opens the one "new" dialog (event or task list, switchable there); in the Tasks view a new list without a date. */
const ui = useUiStore();
const route = useRoute();
</script>

<template>
  <div class="fab-wrap" :class="{ away: isPhone && ui.trayExpanded }" data-testid="create-fab-area" :inert="isPhone && ui.trayExpanded">
    <Fab label="Create" data-testid="create-button" @click="route.meta.tasks ? openNewUndated() : openNew()"><IconAdd /></Fab>
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
/* Left-handed mode (phone): the button sits at the left and slides out to the left. */
@media (max-width: 767.98px) {
  html[data-hand='left'] .fab-wrap { right: auto; left: calc(16px + var(--safe-left)); align-items: flex-start; }
  html[data-hand='left'] .fab-wrap.away { transform: translateX(calc(-100% - 24px)); }
}
</style>
