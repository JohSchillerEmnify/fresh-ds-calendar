<script setup lang="ts">
/** A settings group page (feature settings-groups): `/settings/<group>`, the sub-pages Bedtime and Task lists calendar, and a calendar's page; Back goes one level up. */
import { computed, type Component } from 'vue';
import SettingsShell from '@/components/settings/SettingsShell.vue';
import type { GroupId } from '@/components/settings/catalog';
import { t } from '@/i18n';
import { useCalendarsStore } from '@/stores/calendars';
import AccountGroup from './settings/AccountGroup.vue';
import AppearanceGroup from './settings/AppearanceGroup.vue';
import BedtimePage from './settings/BedtimePage.vue';
import CalendarPage from './settings/CalendarPage.vue';
import CalendarsGroup from './settings/CalendarsGroup.vue';
import FocusGroup from './settings/FocusGroup.vue';
import LabsGroup from './settings/LabsGroup.vue';
import RemindersGroup from './settings/RemindersGroup.vue';
import TaskListsGroup from './settings/TaskListsGroup.vue';
import TasksCalendarPage from './settings/TasksCalendarPage.vue';
import ViewsGroup from './settings/ViewsGroup.vue';
import WidgetsGroup from './settings/WidgetsGroup.vue';

const props = defineProps<{ group: GroupId; page?: string }>();
const GROUPS: Record<GroupId, Component> = {
  calendars: CalendarsGroup, views: ViewsGroup, tasklists: TaskListsGroup, reminders: RemindersGroup,
  appearance: AppearanceGroup, focus: FocusGroup, widgets: WidgetsGroup, labs: LabsGroup, account: AccountGroup,
};
const cals = useCalendarsStore();

/** What the page shows: the group, one of its fixed sub-pages, or a calendar. */
const view = computed(() => {
  const groupTitle = t(`settingsNav.groups.${props.group}.title`);
  if (!props.page) return { component: GROUPS[props.group], title: groupTitle, up: '/settings', props: {} };
  const up = `/settings/${props.group}`;
  if (props.page === 'bedtime') return { component: BedtimePage, title: t('settings.sections.bedtime'), up, props: {} };
  if (props.page === 'tasks-calendar') return { component: TasksCalendarPage, title: t('settingsNav.labels.tasksCalendar'), up, props: {} };
  const name = cals.list.find((c) => c.id === props.page)?.name ?? '';
  return { component: CalendarPage, title: name, up, props: { calendarId: props.page } };
});
</script>

<template>
  <SettingsShell :title="view.title" :up="view.up">
    <div class="group" data-testid="settings-group-page" :data-group="view.title" :data-group-id="page ? `${group}/${page}` : group">
      <component :is="view.component" v-bind="view.props" />
    </div>
  </SettingsShell>
</template>

<style scoped>
.group { display: flex; flex-direction: column; gap: 4px; }
</style>
