<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { IconCalendarMonth as IconYear, IconCalendarViewMonth as IconMonth, IconCalendarViewWeek as IconWeek, IconCalendarViewDay as IconDay, IconChecklist as IconTasks } from '@/components/icons';
import { visibleLabsViews } from '@/features/labs/labs';
import AppTopBar from '@/components/shell/AppTopBar.vue';
import CreateFab from '@/components/shell/CreateFab.vue';
import FilterBar from '@/components/shell/FilterBar.vue';
import InstallPrompts from '@/components/shell/InstallPrompts.vue';
import ReauthBanner from '@/components/shell/ReauthBanner.vue';
import SwipeCarousel from '@/components/shell/SwipeCarousel.vue';
import SyncErrorBanner from '@/components/shell/SyncErrorBanner.vue';
import LastUpdatedNote from '@/components/shell/LastUpdatedNote.vue';
import DragCat from '@/features/motivation/DragCat.vue';
import VersionLabel from '@/components/shell/VersionLabel.vue';
import SideMenu from '@/components/shell/SideMenu.vue';
import NavigationBar from '@/components/m3/NavigationBar.vue';
import NavigationRail from '@/components/m3/NavigationRail.vue';
import NavigationTabs from '@/components/m3/NavigationTabs.vue';
import Snackbar from '@/components/m3/Snackbar.vue';
import type { NavItem } from '@/components/m3/types';
import { applyLanguage, t } from '@/i18n';
import { acquireViewport, isPhone } from '@/composables/useViewport';
import { useNav } from '@/composables/useNav';
import { useNavPosition } from '@/composables/useNavPosition';
import { useBarSize } from '@/composables/useBarSize';
import { useLeftHand } from '@/composables/useLeftHand';
import { useBarHide } from '@/composables/useBarHide';
import { calendarHeaders, dialogs, trayComponents } from '@/extensions/registry';
import type { ViewKind } from '@/lib/dates';
import { api } from '@/api/client';
import { usePrefsStore } from '@/stores/prefs';
import { useTemplatesStore } from '@/features/tasklists/templatesStore';
import { useMotivationStore, useSceneRest } from '@/features/motivation';
import { isGestureClaimed, setSoundsEnabled, useAnimationLevel } from '@/motion';
import { initInstall } from '@/pwa/install';
import { useCalendarStore } from '@/stores/calendar';
import { useCalendarsStore } from '@/stores/calendars';
import { useClockStore } from '@/stores/clock';
import { useFilters } from '@/composables/useFilters';
import { useSyncStore } from '@/stores/sync';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { useOverlayHistory } from '@/lib/overlayHistory';

const route = useRoute();
const cal = useCalendarStore();
const ui = useUiStore();
const nav = useNav();
const sync = useSyncStore();
const clock = useClockStore();
const filters = useFilters();
const calendars = useCalendarsStore();
const settings = useSettingsStore();
const motivation = useMotivationStore();
const { position: navPosition, side: railSide } = useNavPosition();
const labs = usePrefsStore();
const leftHand = useLeftHand();
const barSize = useBarSize();
const barHide = useBarHide();
/** The bottom bar is slid away: only while the view switcher is the bottom bar. */
const barHidden = computed(() => barHide.hidden.value && navPosition.value === 'bottom');
useAnimationLevel(() => settings.settings.animationLevel, () => settings.settings.calmMode, () => settings.settings.ignoreSystemMotion);
// the season and holiday scenes move for ten seconds after opening (and after coming back), then rest
useSceneRest(() => settings.effectiveScene);
// the person's language choice (also arriving from another device) switches the UI at once, without a reload
watch(() => labs.language, (pref) => { void applyLanguage(pref); });
watch(() => settings.settings.sounds, (v) => setSoundsEnabled(v), { immediate: true });

const isCalendar = computed(() => !!route.meta.view || !!route.meta.lab);
/** Calendar views and the Tasks view share the shell: top bar, navigation, create button. */
const hasShell = computed(() => isCalendar.value || !!route.meta.tasks);
const activeView = computed(() => (route.meta.tasks ? 'tasks' : (route.meta.lab as string | undefined) ?? cal.view));
const baseItems = computed<NavItem[]>(() => [
  { id: 'year', label: t('views.year'), icon: IconYear, testid: 'view-switch-year' },
  { id: 'month', label: t('views.month'), icon: IconMonth, testid: 'view-switch-month' },
  { id: 'week', label: t('views.week'), icon: IconWeek, testid: 'view-switch-week' },
  { id: 'day', label: t('views.day'), icon: IconDay, testid: 'view-switch-day' },
  { id: 'tasks', label: t('views.tasks'), icon: IconTasks, testid: 'view-switch-tasks' },
]);
// Labs views are offered only with the Labs switch on and the view's own switch on, marked as experimental.
const items = computed<NavItem[]>(() => [
  ...baseItems.value,
  ...visibleLabsViews(labs.labs, labs.labsViews).map((v) => ({ id: v.id, label: t(v.labelKey), icon: v.icon, testid: `view-switch-${v.id}`, experimental: true })),
]);
/** A phone without a bottom bar and without the tray (Tasks, Labs views) still keeps clear of the bottom safe area. */
const edgePad = computed(() => hasShell.value && isPhone.value && navPosition.value !== 'bottom' && !route.meta.view);
const switchTo = (id: string) => { void nav.switchView(id as ViewKind | 'tasks'); };
const filterShown = computed(() => hasShell.value && !route.meta.tasks && (ui.filtersShown || filters.active.value));
const dialogComp = computed(() => (ui.dialog ? dialogs[ui.dialog.kind] : undefined));

/** Swipe navigation is off while a drag, picker, dialog or resize owns the screen, outside the calendar, and on views that pan sideways themselves. */
const swipeDisabled = () => !!route.meta.noSwipe || isGestureClaimed() || ui.pickerOpen || !!ui.dialog || !!ui.resizing || !isCalendar.value;
let undo: Array<() => void> = [];
onMounted(() => {
  undo.push(acquireViewport(), initInstall(), api.onMotivationChanged(() => { void motivation.refresh(); }));
  clock.startTicker();
  // the sign-in page has no data to sync (and every call would be refused)
  if (!route.meta.public) {
    sync.start();
    // the device takes in what changed on the server since it last asked, also for days never opened
    void sync.syncNow('open');
    void calendars.load().catch((e) => sync.reportError(e));
    // per-person data kept on the device: read at start so the first saved last known state has them
    void useTemplatesStore().load().catch((e) => sync.reportError(e));
    void labs.load();
  }
});
onBeforeUnmount(() => {
  undo.forEach((u) => u());
  undo = [];
  sync.stop();
  clock.stopTicker();
});
// CSS (FAB, tray, snackbar) follows the position through one attribute on <html>
watch(navPosition, (p) => { document.documentElement.dataset.navPos = p; }, { immediate: true });
watch(barSize.bottom, (v) => { document.documentElement.dataset.barSize = v; }, { immediate: true });
watch(barHidden, (v) => { document.documentElement.dataset.barHidden = String(v); }, { immediate: true });
// System back closes the shell overlays (dialogs/sheets register themselves in AdaptiveSheet).
useOverlayHistory(() => ui.trayExpanded, () => { ui.trayExpanded = false; });
useOverlayHistory(() => ui.filtersShown, () => { ui.filtersShown = false; });
useOverlayHistory(() => ui.pickerOpen, () => { ui.pickerOpen = false; });
// Close transient UI on navigation.
watch(() => route.fullPath, () => { ui.pickerOpen = false; ui.resizing = null; barHide.show(); });
</script>

<template>
  <div class="shell" data-testid="app-shell" :data-view="cal.view">
    <template v-if="hasShell">
      <AppTopBar />
      <NavigationTabs v-if="navPosition === 'top'" :items="items" :model-value="activeView" @update:model-value="switchTo" />
      <InstallPrompts part="hint" />
    </template>
    <ReauthBanner />
    <SyncErrorBanner />
    <LastUpdatedNote />
    <FilterBar v-if="filterShown" />
    <div class="body" :class="{ 'edge-pad': edgePad }">
      <NavigationRail v-if="hasShell && navPosition === 'rail'" :items="items" :model-value="activeView" :phone="isPhone" :side="railSide" @update:model-value="switchTo" />
      <div class="col">
        <SwipeCarousel :disabled="swipeDisabled">
          <template v-if="route.meta.view"><template v-for="(h, i) in calendarHeaders" :key="i"><component :is="h.component" v-if="h.shown()" /></template></template>
        </SwipeCarousel>
        <component :is="t" v-for="(t, i) in trayComponents" :key="i" />
      </div>
    </div>
    <CreateFab v-if="hasShell" />
    <NavigationBar v-if="hasShell && navPosition === 'bottom'" :items="items" :size="barSize.bottom.value" :hidden="barHidden" :model-value="activeView" @update:model-value="switchTo" />
    <SideMenu v-if="hasShell && navPosition === 'drawer'" :items="items" :model-value="activeView" :side="leftHand ? 'right' : 'left'" @update:model-value="switchTo" />
    <component :is="dialogComp" v-if="dialogComp && ui.dialog" v-bind="ui.dialog.props" @close="ui.closeDialog()" />
    <VersionLabel v-if="hasShell && labs.versionInCorner" :raised="isPhone" />
    <Snackbar />
    <DragCat />
  </div>
</template>

<style scoped>
.shell { height: 100%; display: flex; flex-direction: column; min-height: 0; overflow: clip; } /* the app never scrolls as a whole: overlays (month picker scrim) must not extend the document */
.body { flex: 1; min-height: 0; display: flex; }
.body.edge-pad { padding-bottom: var(--safe-bottom); }
.col { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
/* Desktop: the open tasks tray is a right-hand side panel. */
@media (min-width: 768px) { .col { flex-direction: row; } }
</style>
