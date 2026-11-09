<script setup lang="ts">
/** The page of the calendar that holds the task lists (Settings › Calendars): whether Google shows it. */
import Switch from '@/components/m3/Switch.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { t } from '@/i18n';
import { usePrefsStore } from '@/stores/prefs';

const prefs = usePrefsStore();
const savePrefs = useSavePrefs();
</script>

<template>
  <SettingSection>
    <SettingRow id="tasksCalendarVisible" :label="t('settings.calendar.tasksCalendar.label')" :hint="t('settings.calendar.tasksCalendar.hint')">
      <Switch :model-value="prefs.tasksCalendarVisible" :label="t('settings.calendar.tasksCalendar.label')" data-testid="settings-tasks-calendar-visible" @update:model-value="savePrefs({ tasksCalendarVisible: $event })" />
    </SettingRow>
  </SettingSection>
</template>
