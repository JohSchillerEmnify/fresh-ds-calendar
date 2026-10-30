<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IconChevronLeft as IconPrev, IconChevronRight as IconNext, IconExpandMore as IconExpand, IconFilterList as IconFilter, IconSettingsOutline as IconSettings, IconToday, IconMenu } from '@/components/icons';
import Button from '@/components/m3/Button.vue';
import IconButton from '@/components/m3/IconButton.vue';
import TopAppBar from '@/components/m3/TopAppBar.vue';
import { useFilters } from '@/composables/useFilters';
import { datelessLab } from '@/features/labs/labs';
import { useNavPosition } from '@/composables/useNavPosition';
import { useNav } from '@/composables/useNav';
import { useBarSize } from '@/composables/useBarSize';
import { inPeriod } from '@/lib/dates';
import { isPhone, isSwipeScreen } from '@/composables/useViewport';
import { topBarWidgets } from '@/extensions/registry';
import { useCalendarStore } from '@/stores/calendar';
import { usePrefsStore } from '@/stores/prefs';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import InstallPrompts from './InstallPrompts.vue';
import MonthPicker from './MonthPicker.vue';
import SyncFailedButton from './SyncFailedButton.vue';
import SyncStatus from './SyncStatus.vue';
import { LeadingWidgets, TopBarScene } from '@/features/motivation';
import { useClockStore } from '@/stores/clock';
import { t } from '@/i18n';


const cal = useCalendarStore();
const ui = useUiStore();
const settings = useSettingsStore();
const prefs = usePrefsStore();
const nav = useNav();
const { position: navPosition } = useNavPosition();
/** The view switcher is the side menu: a menu button opens it and it replaces the filter and settings buttons (feature nav-expressive). */
const drawer = computed(() => navPosition.value === 'drawer');
const clock = useClockStore();
const router = useRouter();
const route = useRoute();
const filters = useFilters();
/** The header layout in force: the person's choice on a phone; desktop and tablets keep their own one row (feature header-layout). */
const barSize = useBarSize();
const layout = computed(() => (isPhone.value ? (barSize.top.value === 'expressive' ? 'two-rows' : 'one-row') : 'wide'));
/** A phone's bar (Expressive or Compact): the short date and Today as an icon, one row of controls (feature header-expressive). */
const oneRow = computed(() => layout.value !== 'wide');
/** Today is in the period the title names: the Today button is the today mark, filled then, outlined otherwise (feature header-layout). */
const todayShown = computed(() => inPeriod(cal.view, cal.anchor, clock.todayDate));
const filterOpen = computed(() => ui.filtersShown || filters.active.value);
/** A date-less Labs view (Now, Timeline): the title is the view's name and there is no moving through periods. */
const dateless = computed(() => datelessLab(route.meta.lab as string | undefined));

function toggleFilters() {
  if (filters.active.value) return; // always shown while a filter is active
  ui.filtersShown = !ui.filtersShown;
}
</script>

<template>
  <TopAppBar :data-layout="layout" :data-size="barSize.top.value">
    <template #background><TopBarScene :scene="settings.effectiveScene" :field-mode="settings.settings.sunflowers" /></template>
    <div class="grid">
      <div class="lead">
      <IconButton v-if="drawer" class="menu" :label="t('nav.menu')" data-testid="menu-button" aria-haspopup="dialog" @click="ui.sideMenuOpen = true"><IconMenu /></IconButton>
      <h1 v-if="route.meta.tasks" class="title" data-testid="tasks-title"><span class="t">{{ t('views.tasks') }}</span></h1>
      <h1 v-else-if="dateless" class="title" data-testid="view-title"><span class="t">{{ t(dateless.labelKey) }}</span></h1>
      <button v-else class="title" type="button" data-testid="period-title" aria-haspopup="dialog" :aria-expanded="ui.pickerOpen" @click="ui.pickerOpen = !ui.pickerOpen">
        <span class="t">{{ oneRow ? cal.shortTitle : cal.title }}</span><IconExpand class="chev" :class="{ up: ui.pickerOpen }" aria-hidden="true" />
      </button>
      </div>
      <div v-if="!route.meta.tasks && !dateless" class="nav">
        <!-- touch screens move by swiping the calendar: the arrows stay for screen readers and keyboards, out of sight (owner, 2026-10-26) -->
        <IconButton :class="{ 'sr-only': isSwipeScreen }" :label="t('calendar.topBar.previous')" data-testid="nav-prev" @click="nav.prev()"><IconPrev /></IconButton>
        <Button variant="tonal" class="today" :class="{ off: !todayShown }" data-testid="nav-today" :data-today-shown="todayShown" :aria-label="oneRow ? t('calendar.topBar.today') : undefined" :title="oneRow ? t('calendar.topBar.today') : undefined" @click="nav.today()"><span class="pill"><IconToday v-if="oneRow" /><template v-else>{{ t('calendar.topBar.today') }}</template></span></Button>
        <IconButton :class="{ 'sr-only': isSwipeScreen }" :label="t('calendar.topBar.next')" data-testid="nav-next" @click="nav.next()"><IconNext /></IconButton>
      </div>
      <div class="widgets">
        <slot name="leading-widgets">
          <LeadingWidgets :streak="prefs.streak" :today="() => clock.today" />
          <component :is="w" v-for="(w, i) in topBarWidgets.leading" :key="'l' + i" />
        </slot>
        <slot name="trailing-widgets"><component :is="w" v-for="(w, i) in topBarWidgets.trailing" :key="'t' + i" /></slot>
        <SyncFailedButton />
        <SyncStatus />
        <InstallPrompts part="button" />
      </div>
      <div class="actions">
        <span v-if="!route.meta.tasks && !drawer" class="fwrap">
          <IconButton :label="t('calendar.topBar.filters')" :pressed="filterOpen" data-testid="filter-button" @click="toggleFilters"><IconFilter /></IconButton>
          <b v-if="filters.count.value" class="badge" aria-hidden="true">{{ filters.count.value }}</b>
        </span>
        <IconButton v-if="!drawer" :label="t('calendar.topBar.settings')" data-testid="settings-button" @click="router.push('/settings')"><IconSettings /></IconButton>
      </div>
    </div>
    <MonthPicker v-if="ui.pickerOpen && !route.meta.tasks && !dateless" />
  </TopAppBar>
</template>

<style scoped>
.grid {
  display: grid; align-items: center; column-gap: 4px; padding: 2px 4px 2px 8px;
  grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'title actions' 'nav widgets';
}
.lead { grid-area: title; min-width: 0; display: flex; align-items: center; }
.lead .title { flex: 1; }
.title { margin: 0; min-width: 0; min-height: 48px; display: flex; align-items: center; gap: 4px; padding: 0 8px; border-radius: var(--md-sys-shape-corner-large); text-align: left; font: var(--md-sys-typescale-title-large); }
.t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chev { width: 24px; height: 24px; flex: none; transition: transform var(--md-sys-motion-duration-medium) var(--md-sys-motion-spring); }
.chev.up { transform: rotate(180deg); }
.nav { grid-area: nav; display: flex; align-items: center; gap: 2px; }
/* the m3 button's size rule and the ripple's position: relative outrank the global .sr-only: restate them so the arrows take no room */
.nav .sr-only { position: absolute; width: 1px; height: 1px; }
.today { padding: 0 16px; }
/* Today is not on screen: outlined on a solid surface fill, so a scene never shows through (on phones the pill carries the look) */
.today.off { background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); border: 1px solid var(--md-sys-color-outline); }
.widgets { grid-area: widgets; display: flex; align-items: center; justify-content: flex-end; gap: 2px; min-width: 0; }
.actions { grid-area: actions; display: flex; }
.fwrap { position: relative; display: inline-flex; }
.badge { position: absolute; top: 4px; right: 2px; min-width: 16px; height: 16px; border-radius: 8px; background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); font: var(--md-sys-typescale-label-small); display: flex; align-items: center; justify-content: center; padding: 0 4px; }
@media (min-width: 768px) {
  .grid { grid-template-columns: auto auto minmax(0, 1fr) auto; grid-template-areas: 'title nav widgets actions'; padding: 6px 12px; column-gap: 12px; }
  .title { font-size: 24px; }
}
/* Phones (features header-layout, header-expressive): one row of controls in both sizes; Expressive keeps the full 84 px scene
   below it, Compact is the 52 px row. The visuals may be smaller than 44 px; the hit areas are not. */
@media (max-width: 767.98px) {
  .title { font-size: 18px; line-height: 24px; }
  .grid { grid-template-columns: minmax(0, 1fr) auto auto auto; grid-template-rows: 48px; grid-template-areas: 'title nav widgets actions'; padding: 2px 2px 2px 0; column-gap: 0; align-content: start; }
  [data-size='expressive'] .grid { min-height: 84px; padding-top: 4px; }
  /* Expressive's plant keeps the full 44 px tap area; Compact's is 32 wide so the row stays one row */
  [data-size='expressive'] .widgets :deep(.lw-btn) { min-width: 44px; width: 44px; }
  .nav .today { padding: 0; background: transparent; width: 44px; }
  .nav .today :deep(.m3-layer), .nav .today :deep(.m3-ripple) { display: none; }
  .nav .today:focus-visible { outline: none; }
  .nav .today:focus-visible .pill { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
  .nav .today:is(:active, [data-pressed='true']) .pill { background: color-mix(in srgb, var(--md-sys-color-on-primary-container) 12%, var(--md-sys-color-primary-container)); }
  /* Today is the one filled button; off today's period it is outlined on a solid surface, so a scene never shows through */
  .pill { width: 40px; height: 40px; border-radius: 20px; background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
  .nav .today.off { background: transparent; border: 0; }
  .today.off .pill { background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); border: 1px solid var(--md-sys-color-outline); }
  .pill :deep(svg) { width: 24px; height: 24px; }
  .title { padding: 0 2px 0 8px; gap: 2px; }
  .chev { width: 20px; height: 20px; }
  .widgets { gap: 0; }
  .widgets :deep(.lw) { gap: 0; }
  .widgets :deep(.lw-btn) { min-width: 32px; width: 32px; min-height: 44px; padding: 0; }
  .widgets :deep([data-testid='streak-flame']) { width: 32px; justify-content: center; gap: 0; font-size: 14px; }
  .widgets :deep(.sf-flame) { width: 17px; height: 20px; }
  .widgets :deep([data-testid='sync-status']) { width: 24px; }
}
/* Today's drawn shape: on wide screens the tonal button itself, on phones a pill inside a larger tap area. */
.pill { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }
/* Left-handed mode (phone, touch tablet): the settings group and the leading widgets sit at the left, title and navigation at the right. */
html[data-hand='left'][data-touch] .actions { flex-direction: row-reverse; }
html[data-hand='left'][data-touch] .lead { flex-direction: row-reverse; }
html[data-hand='left'][data-touch] .widgets { justify-content: flex-start; }
/* On a phone the bar is the exact mirror of the right-handed one (owner, 2026-10-26), so a scene can simply be flipped:
   the title's text at the outer edge, the widgets in reverse order. */
@media (max-width: 767.98px) {
  html[data-hand='left'][data-touch] .title { flex-direction: row-reverse; }
  html[data-hand='left'][data-touch] .widgets { flex-direction: row-reverse; justify-content: flex-end; }
  html[data-hand='left'][data-touch] .widgets :deep(.lw) { flex-direction: row-reverse; }
  html[data-hand='left'][data-touch] .badge { right: auto; left: 2px; }
  html[data-hand='left'][data-touch] .grid { grid-template-columns: auto auto auto minmax(0, 1fr); grid-template-areas: 'actions widgets nav title'; padding-left: 2px; padding-right: 0; }
  html[data-hand='left'][data-touch] .title { padding: 0 8px 0 2px; }
}
@media (min-width: 768px) { html[data-hand='left'][data-touch] .grid { grid-template-columns: auto minmax(0, 1fr) auto auto; grid-template-areas: 'actions widgets nav title'; } }
</style>
