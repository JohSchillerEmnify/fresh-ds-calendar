<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import IconYear from '~icons/material-symbols/calendar-month';
import IconMonth from '~icons/material-symbols/calendar-view-month';
import IconWeek from '~icons/material-symbols/calendar-view-week';
import IconDay from '~icons/material-symbols/calendar-view-day';
import IconLab from '~icons/material-symbols/science';
import AppTopBar from '@/components/shell/AppTopBar.vue';
import CreateFab from '@/components/shell/CreateFab.vue';
import FilterBar from '@/components/shell/FilterBar.vue';
import InstallPrompts from '@/components/shell/InstallPrompts.vue';
import ReauthBanner from '@/components/shell/ReauthBanner.vue';
import SwipeCarousel from '@/components/shell/SwipeCarousel.vue';
import SyncErrorBanner from '@/components/shell/SyncErrorBanner.vue';
import DragCat from '@/features/motivation/DragCat.vue';
import NavigationBar from '@/components/m3/NavigationBar.vue';
import NavigationRail from '@/components/m3/NavigationRail.vue';
import Snackbar from '@/components/m3/Snackbar.vue';
import type { NavItem } from '@/components/m3/types';
import { acquireViewport, isPhone } from '@/composables/useViewport';
import { useNav } from '@/composables/useNav';
import { calendarHeaders, dialogs, trayComponents } from '@/extensions/registry';
import type { ViewKind } from '@/lib/dates';
import { api } from '@/api/client';
import { usePrefsStore } from '@/stores/prefs';
import { useMotivationStore } from '@/features/motivation';
import { isGestureClaimed, setSoundsEnabled, useAnimationLevel } from '@/motion';
import { initInstall } from '@/pwa/install';
import { useAuthStore } from '@/stores/auth';
import { useCalendarStore } from '@/stores/calendar';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useFilters } from '@/composables/useFilters';
import { useSyncStore } from '@/stores/sync';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { useOverlayHistory } from '@/lib/overlayHistory';

const route = useRoute();
const auth = useAuthStore();
const cal = useCalendarStore();
const ui = useUiStore();
const nav = useNav();
const sync = useSyncStore();
const clock = useClockStore();
const filters = useFilters();
const calendars = useCalendarsStore();
const settings = useSettingsStore();
const motivation = useMotivationStore();
const labs = usePrefsStore();
useAnimationLevel(() => settings.settings.animationLevel, () => settings.settings.calmMode, () => settings.settings.ignoreSystemMotion);
watch(() => settings.settings.sounds, (v) => setSoundsEnabled(v), { immediate: true });

const isCalendar = computed(() => !!route.meta.view || !!route.meta.lab);
const activeView = computed(() => (route.meta.lab as string | undefined) ?? cal.view);
const baseItems: NavItem[] = [
  { id: 'year', label: 'Year', icon: IconYear, testid: 'view-switch-year' },
  { id: 'month', label: 'Month', icon: IconMonth, testid: 'view-switch-month' },
  { id: 'week', label: 'Week', icon: IconWeek, testid: 'view-switch-week' },
  { id: 'day', label: 'Day', icon: IconDay, testid: 'view-switch-day' },
];
// Labs views are offered only with the Labs switch on, marked as experimental.
const items = computed<NavItem[]>(() => labs.labs
  ? [...baseItems, ...(['clock', 'timeline', 'strip'] as const).map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1), icon: IconLab, testid: `view-switch-${id}`, experimental: true }))]
  : baseItems);
const filterShown = computed(() => isCalendar.value && (ui.filtersShown || filters.active.value));
const dialogComp = computed(() => (ui.dialog ? dialogs[ui.dialog.kind] : undefined));

/** Swipe navigation is off while a drag, picker, dialog or resize owns the screen, and outside the calendar. */
const swipeDisabled = () => isGestureClaimed() || ui.pickerOpen || !!ui.dialog || !!ui.resizing || !isCalendar.value;
let undo: Array<() => void> = [];
onMounted(() => {
  undo.push(acquireViewport(), initInstall(), api.onMotivationChanged(() => { void motivation.refresh(); }), auth.listen());
  clock.startTicker();
  // the sign-in page has no data to sync (and every call would be refused)
  if (!route.meta.public) {
    sync.start();
    void calendars.load().catch((e) => sync.reportError(e));
    void labs.load();
  }
});
onBeforeUnmount(() => {
  undo.forEach((u) => u());
  undo = [];
  sync.stop();
  clock.stopTicker();
});
// System back closes the shell overlays (dialogs/sheets register themselves in AdaptiveSheet).
useOverlayHistory(() => ui.trayExpanded, () => { ui.trayExpanded = false; });
useOverlayHistory(() => ui.filtersShown, () => { ui.filtersShown = false; });
useOverlayHistory(() => ui.pickerOpen, () => { ui.pickerOpen = false; });
// Close transient UI on navigation.
watch(() => route.fullPath, () => { ui.pickerOpen = false; ui.resizing = null; });
</script>

<template>
  <div class="shell" data-testid="app-shell" :data-view="cal.view">
    <template v-if="isCalendar">
      <AppTopBar />
      <InstallPrompts part="hint" />
    </template>
    <ReauthBanner />
    <SyncErrorBanner />
    <FilterBar v-if="filterShown" />
    <div class="body">
      <NavigationRail v-if="isCalendar && !isPhone" :items="items" :model-value="activeView" @update:model-value="nav.switchView($event as ViewKind)" />
      <div class="col">
        <SwipeCarousel :disabled="swipeDisabled">
          <template v-if="route.meta.view"><template v-for="(h, i) in calendarHeaders" :key="i"><component :is="h.component" v-if="h.shown()" /></template></template>
        </SwipeCarousel>
        <component :is="t" v-for="(t, i) in trayComponents" :key="i" />
      </div>
    </div>
    <CreateFab v-if="isCalendar" />
    <NavigationBar v-if="isCalendar && isPhone" :items="items" :model-value="activeView" @update:model-value="nav.switchView($event as ViewKind)" />
    <component :is="dialogComp" v-if="dialogComp && ui.dialog" v-bind="ui.dialog.props" @close="ui.closeDialog()" />
    <Snackbar />
    <DragCat />
  </div>
</template>

<style scoped>
.shell { height: 100%; display: flex; flex-direction: column; min-height: 0; }
.body { flex: 1; min-height: 0; display: flex; }
.col { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
/* Desktop: the open tasks tray is a right-hand side panel. */
@media (min-width: 768px) { .col { flex-direction: row; } }
</style>
