<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import IconYear from '~icons/material-symbols/calendar-month';
import IconMonth from '~icons/material-symbols/calendar-view-month';
import IconWeek from '~icons/material-symbols/calendar-view-week';
import IconDay from '~icons/material-symbols/calendar-view-day';
import AppTopBar from '@/components/shell/AppTopBar.vue';
import CreateFab from '@/components/shell/CreateFab.vue';
import FilterBar from '@/components/shell/FilterBar.vue';
import InstallPrompts from '@/components/shell/InstallPrompts.vue';
import SyncErrorBanner from '@/components/shell/SyncErrorBanner.vue';
import NavigationBar from '@/components/m3/NavigationBar.vue';
import NavigationRail from '@/components/m3/NavigationRail.vue';
import Snackbar from '@/components/m3/Snackbar.vue';
import type { NavItem } from '@/components/m3/types';
import { acquireViewport, isPhone } from '@/composables/useViewport';
import { useNav } from '@/composables/useNav';
import { bindSwipe } from '@/composables/useSwipe';
import { dialogs, trayComponents } from '@/extensions/registry';
import type { ViewKind } from '@/lib/dates';
import { initInstall } from '@/pwa/install';
import { useCalendarStore } from '@/stores/calendar';
import { useClockStore } from '@/stores/clock';
import { useFilters } from '@/composables/useFilters';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';

const route = useRoute();
const cal = useCalendarStore();
const ui = useUiStore();
const nav = useNav();
const sync = useSyncStore();
const clock = useClockStore();
const filters = useFilters();

const isCalendar = computed(() => !!route.meta.view);
const items: NavItem[] = [
  { id: 'year', label: 'Year', icon: IconYear, testid: 'view-switch-year' },
  { id: 'month', label: 'Month', icon: IconMonth, testid: 'view-switch-month' },
  { id: 'week', label: 'Week', icon: IconWeek, testid: 'view-switch-week' },
  { id: 'day', label: 'Day', icon: IconDay, testid: 'view-switch-day' },
];
const filterShown = computed(() => isCalendar.value && (ui.filtersShown || filters.active.value));
const dialogComp = computed(() => (ui.dialog ? dialogs[ui.dialog.kind] : undefined));

const swipeArea = ref<HTMLElement | null>(null);
let undo: Array<() => void> = [];
onMounted(() => {
  undo.push(acquireViewport(), initInstall());
  clock.startTicker();
  sync.start();
  if (swipeArea.value) {
    undo.push(bindSwipe(swipeArea.value, {
      onLeft: () => void nav.next(),
      onRight: () => void nav.prev(),
      disabled: () => ui.pickerOpen || !!ui.dialog || !isCalendar.value,
    }));
  }
});
onBeforeUnmount(() => {
  undo.forEach((u) => u());
  undo = [];
  sync.stop();
  clock.stopTicker();
});
// Close transient UI on navigation.
watch(() => route.fullPath, () => { ui.pickerOpen = false; ui.createMenuOpen = false; });
</script>

<template>
  <div class="shell" data-testid="app-shell" :data-view="cal.view">
    <template v-if="isCalendar">
      <AppTopBar />
      <InstallPrompts part="hint" />
    </template>
    <SyncErrorBanner />
    <FilterBar v-if="filterShown" />
    <div class="body">
      <NavigationRail v-if="isCalendar && !isPhone" :items="items" :model-value="cal.view" @update:model-value="nav.switchView($event as ViewKind)" />
      <div class="col">
        <main ref="swipeArea" class="main" data-testid="calendar-swipe-area">
          <RouterView />
        </main>
        <component :is="t" v-for="(t, i) in trayComponents" :key="i" />
      </div>
    </div>
    <CreateFab v-if="isCalendar" />
    <NavigationBar v-if="isCalendar && isPhone" :items="items" :model-value="cal.view" @update:model-value="nav.switchView($event as ViewKind)" />
    <component :is="dialogComp" v-if="dialogComp && ui.dialog" v-bind="ui.dialog.props" @close="ui.closeDialog()" />
    <Snackbar />
  </div>
</template>

<style scoped>
.shell { height: 100%; display: flex; flex-direction: column; min-height: 0; }
.body { flex: 1; min-height: 0; display: flex; }
.col { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.main { flex: 1; min-height: 0; display: flex; flex-direction: column; touch-action: pan-y; overflow: hidden; }
</style>
