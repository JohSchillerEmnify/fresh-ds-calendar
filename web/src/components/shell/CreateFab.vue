<script setup lang="ts">
import { computed } from 'vue';
import { IconAdd } from '@/components/icons';
import Fab from '@/components/m3/Fab.vue';
import { useRoute } from 'vue-router';
import { openNew, openNewUndated } from '@/extensions/create';
import { isPhone } from '@/composables/useViewport';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';

/** FAB: opens the one "new" dialog (event or task list, switchable there); in the Tasks view a new list without a date. */
const ui = useUiStore();
const route = useRoute();
/** Phone: out of the way while the open tasks tray, a view's bottom panel or a persistent snackbar (update hints) is open (it would cover their controls). */
const away = computed(() => isPhone.value && (ui.trayExpanded || ui.panelOpen || ui.snackbars.some((s) => s.duration === 0)));
/** Wider screens: the button stays but lifts above the persistent snackbars, which are centred and would otherwise cover it. */
const lift = computed(() => (isPhone.value ? 0 : ui.snackbars.filter((s) => s.duration === 0).length));
</script>

<template>
  <div class="fab-wrap" :class="{ away: away }" :style="{ '--snack-lift': lift * 64 + 'px' }" data-testid="create-fab-area" :inert="away">
    <Fab :label="t('calendar.create.label')" data-testid="create-button" @click="route.meta.tasks ? openNewUndated() : openNew()"><IconAdd /></Fab>
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
@media (min-width: 768px) { .fab-wrap { bottom: calc(24px + var(--snack-lift, 0px)); right: calc(var(--tray-w, 0px) + 24px); } } /* left of the tray panel */
/* View switcher position (feature nav-position). Phone without a bottom bar: above the tray bar at the bottom edge. */
@media (max-width: 767.98px) {
  html:not([data-nav-pos='bottom']) .fab-wrap { bottom: calc(max(var(--tray-h, 0px), var(--safe-bottom)) + 12px); }
  /* the rail is on the same side as the "+", so the button stands clear of it */
  html[data-nav-pos='rail'] .fab-wrap { right: calc(var(--rail-w) + var(--safe-right) + 12px); }
}
@media (min-width: 768px) { html[data-nav-pos='bottom'] .fab-wrap { bottom: calc(var(--navbar-h) + var(--safe-bottom) + 24px + var(--snack-lift, 0px)); } } /* above the full-width bar */
/* Left-handed mode: the button sits at the left. Phone: slides out to the left; tablet: right of the rail and the side tray (which moves to the left there), never over it. */
html[data-hand='left'][data-touch] .fab-wrap { right: auto; align-items: flex-start; }
@media (max-width: 767.98px) {
  html[data-hand='left'][data-touch] .fab-wrap { left: calc(16px + var(--safe-left)); }
  html[data-hand='left'][data-touch][data-nav-pos='rail'] .fab-wrap { left: calc(var(--rail-w) + var(--safe-left) + 12px); }
  html[data-hand='left'][data-touch] .fab-wrap.away { transform: translateX(calc(-100% - 24px)); }
}
/* Compact bottom bar (feature nav-expressive): the button is as tall as the bar and stands beside it on the thumb side. */
@media (max-width: 767.98px) {
  html[data-nav-pos='bottom'][data-bar-size='compact'] .fab-wrap { bottom: calc(var(--safe-bottom) + 8px); right: calc(12px + var(--safe-right)); }
  html[data-nav-pos='bottom'][data-bar-size='compact'] .fab-wrap :deep(.fab) { width: 52px; height: 52px; }
  html[data-hand='left'][data-touch][data-nav-pos='bottom'][data-bar-size='compact'] .fab-wrap { left: calc(12px + var(--safe-left)); }
}
@media (min-width: 768px) {
  html[data-hand='left'][data-touch] .fab-wrap { left: calc(var(--tray-w, 0px) + 24px); }
  html[data-hand='left'][data-touch][data-nav-pos='rail'] .fab-wrap { left: calc(var(--rail-w) + var(--tray-w, 0px) + 24px); }
}
</style>
