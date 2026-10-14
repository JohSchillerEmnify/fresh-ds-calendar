<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IconChevronLeft as IconPrev, IconChevronRight as IconNext, IconExpandMore as IconExpand, IconFilterList as IconFilter, IconSettingsOutline as IconSettings } from '@/components/icons';
import Button from '@/components/m3/Button.vue';
import IconButton from '@/components/m3/IconButton.vue';
import TopAppBar from '@/components/m3/TopAppBar.vue';
import { useFilters } from '@/composables/useFilters';
import { useNav } from '@/composables/useNav';
import { topBarWidgets } from '@/extensions/registry';
import { useCalendarStore } from '@/stores/calendar';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import InstallPrompts from './InstallPrompts.vue';
import MonthPicker from './MonthPicker.vue';
import SyncStatus from './SyncStatus.vue';
import { LeadingWidgets, TopBarScene } from '@/features/motivation';
import { useClockStore } from '@/stores/clock';
import { t } from '@/i18n';


const cal = useCalendarStore();
const ui = useUiStore();
const settings = useSettingsStore();
const nav = useNav();
const clock = useClockStore();
const router = useRouter();
const route = useRoute();
const filters = useFilters();
const filterOpen = computed(() => ui.filtersShown || filters.active.value);

function toggleFilters() {
  if (filters.active.value) return; // always shown while a filter is active
  ui.filtersShown = !ui.filtersShown;
}
</script>

<template>
  <TopAppBar>
    <template #background><TopBarScene :scene="settings.effectiveScene" :field-mode="settings.settings.sunflowers" /></template>
    <div class="grid">
      <h1 v-if="route.meta.tasks" class="title" data-testid="tasks-title"><span class="t">{{ t('views.tasks') }}</span></h1>
      <button v-else class="title" type="button" data-testid="period-title" aria-haspopup="dialog" :aria-expanded="ui.pickerOpen" @click="ui.pickerOpen = !ui.pickerOpen">
        <span class="t">{{ cal.title }}</span><IconExpand class="chev" :class="{ up: ui.pickerOpen }" aria-hidden="true" />
      </button>
      <div v-if="!route.meta.tasks" class="nav">
        <IconButton :label="t('calendar.topBar.previous')" data-testid="nav-prev" @click="nav.prev()"><IconPrev /></IconButton>
        <Button variant="tonal" class="today" data-testid="nav-today" @click="nav.today()">{{ t('calendar.topBar.today') }}</Button>
        <IconButton :label="t('calendar.topBar.next')" data-testid="nav-next" @click="nav.next()"><IconNext /></IconButton>
      </div>
      <div class="widgets">
        <slot name="leading-widgets">
          <LeadingWidgets :streak-flame="settings.settings.streakFlame" :show-plant="settings.settings.plant" :today="() => clock.today" />
          <component :is="w" v-for="(w, i) in topBarWidgets.leading" :key="'l' + i" />
        </slot>
        <slot name="trailing-widgets"><component :is="w" v-for="(w, i) in topBarWidgets.trailing" :key="'t' + i" /></slot>
        <SyncStatus />
        <InstallPrompts part="button" />
      </div>
      <div class="actions">
        <span v-if="!route.meta.tasks" class="fwrap">
          <IconButton :label="t('calendar.topBar.filters')" :pressed="filterOpen" data-testid="filter-button" @click="toggleFilters"><IconFilter /></IconButton>
          <b v-if="filters.count.value" class="badge" aria-hidden="true">{{ filters.count.value }}</b>
        </span>
        <IconButton :label="t('calendar.topBar.settings')" data-testid="settings-button" @click="router.push('/settings')"><IconSettings /></IconButton>
      </div>
    </div>
    <MonthPicker v-if="ui.pickerOpen && !route.meta.tasks" />
  </TopAppBar>
</template>

<style scoped>
.grid {
  display: grid; align-items: center; column-gap: 4px; padding: 2px 4px 2px 8px;
  grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'title actions' 'nav widgets';
}
.title { margin: 0; grid-area: title; min-width: 0; min-height: 48px; display: flex; align-items: center; gap: 4px; padding: 0 8px; border-radius: var(--md-sys-shape-corner-large); text-align: left; font: var(--md-sys-typescale-title-large); }
.t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chev { width: 24px; height: 24px; flex: none; transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring); }
.chev.up { transform: rotate(180deg); }
.nav { grid-area: nav; display: flex; align-items: center; gap: 2px; }
.today { padding: 0 16px; }
.widgets { grid-area: widgets; display: flex; align-items: center; justify-content: flex-end; gap: 2px; min-width: 0; }
.actions { grid-area: actions; display: flex; }
.fwrap { position: relative; display: inline-flex; }
.badge { position: absolute; top: 4px; right: 2px; min-width: 16px; height: 16px; border-radius: 8px; background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); font: var(--md-sys-typescale-label-small); display: flex; align-items: center; justify-content: center; padding: 0 4px; }
@media (min-width: 768px) {
  .grid { grid-template-columns: auto auto minmax(0, 1fr) auto; grid-template-areas: 'title nav widgets actions'; padding: 6px 12px; column-gap: 12px; }
  .title { font-size: 24px; }
}
/* Left-handed mode (phone, touch tablet): the settings group and the leading widgets sit at the left, title and navigation at the right. */
html[data-hand='left'][data-touch] .actions { flex-direction: row-reverse; }
html[data-hand='left'][data-touch] .widgets { justify-content: flex-start; }
@media (max-width: 767.98px) {
  html[data-hand='left'][data-touch] .grid { grid-template-columns: auto minmax(0, 1fr); grid-template-areas: 'actions title' 'widgets nav'; padding: 2px 8px 2px 4px; }
  html[data-hand='left'][data-touch] .nav { justify-self: end; }
}
@media (min-width: 768px) { html[data-hand='left'][data-touch] .grid { grid-template-columns: auto minmax(0, 1fr) auto auto; grid-template-areas: 'actions widgets nav title'; } }
</style>
