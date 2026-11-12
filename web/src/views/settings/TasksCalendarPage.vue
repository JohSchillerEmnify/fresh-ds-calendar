<script setup lang="ts">
/** The page of the calendar that holds the task lists (Settings › Calendars): its colour, set like any calendar's. */
import CalendarColorRow from '@/components/settings/CalendarColorRow.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { t } from '@/i18n';
</script>

<template>
  <SettingSection>
    <SettingRow id="tasksCalendarColor" wide :label="t('calendar.event.fields.color')">
      <CalendarColorRow tasks />
    </SettingRow>
  </SettingSection>
</template>
