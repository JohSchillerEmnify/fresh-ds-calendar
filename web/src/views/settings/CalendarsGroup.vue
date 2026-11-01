<script setup lang="ts">
/** Settings group Calendars (docs/settings-tree.md): one row per calendar with its plan, each opening its own page, and the task lists calendar. */
import { onMounted } from 'vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import { planSummary } from '@/components/settings/planSummary';
import { t } from '@/i18n';
import { useCalendarsStore } from '@/stores/calendars';

const cals = useCalendarsStore();
onMounted(() => { void cals.load().catch(() => undefined); });
</script>

<template>
  <SettingRow
    v-for="c in cals.list" :id="`calendar:${c.id}`" :key="c.id" :to="`/settings/calendars/${encodeURIComponent(c.id)}`" :label="c.name"
    :hint="c.hidden ? t('settingsNav.calendar.hidden') : planSummary(c.id)" class="cal" :style="{ '--cal': c.color }"
  />
  <SettingRow id="tasksCalendar" to="/settings/calendars/tasks-calendar" :label="t('settingsNav.labels.tasksCalendar')" :hint="t('settingsNav.labels.tasksCalendarHint')" />
</template>

<style scoped>
.cal::before { content: ''; width: 12px; height: 12px; border-radius: 50%; background: var(--cal); flex: none; }
</style>
