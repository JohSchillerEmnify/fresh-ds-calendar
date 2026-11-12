<script setup lang="ts">
/** Settings group Calendars (docs/settings-tree.md): one row per calendar with its plan, each opening its own page, and the task lists calendar. */
import { computed, onMounted, ref } from 'vue';
import HolidayRegionSheet from '@/components/settings/HolidayRegionSheet.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { planSummary } from '@/components/settings/planSummary';
import { t } from '@/i18n';
import { useCalendarsStore } from '@/stores/calendars';
import { useDeviceStore } from '@/stores/device';

const cals = useCalendarsStore();
const others = computed(() => cals.list.filter((c) => !c.holiday));
const holidays = computed(() => cals.list.filter((c) => c.holiday));
const picking = ref(false);
const device = useDeviceStore();
// the task lists calendar is no list entry; its colour comes with the device sync
const tasksColor = computed(() => device.file<{ color: string }>('tasksCalendarColor')?.color);
onMounted(() => { void cals.load().catch(() => undefined); });
</script>

<template>
  <SettingSection>
    <SettingRow
      v-for="c in others" :id="`calendar:${c.id}`" :key="c.id" :to="`/settings/calendars/${encodeURIComponent(c.id)}`" :label="c.name"
      :hint="c.hidden ? t('settingsNav.calendar.hidden') : planSummary(c.id)" class="cal" :style="{ '--cal': c.color }"
    />
    <SettingRow id="tasksCalendar" to="/settings/calendars/tasks-calendar" :label="t('settingsNav.labels.tasksCalendar')" :hint="t('settingsNav.labels.tasksCalendarHint')" class="cal" :style="{ '--cal': tasksColor }" />
  </SettingSection>
  <SettingSection :title="t('settingsNav.holidays.title')" data-testid="settings-holidays">
    <SettingRow
      v-for="c in holidays" :id="`calendar:${c.id}`" :key="c.id" :to="`/settings/calendars/${encodeURIComponent(c.id)}`" :label="c.name"
      :hint="c.hidden ? t('settingsNav.calendar.hidden') : undefined" class="cal" :style="{ '--cal': c.color }"
    />
    <SettingRow id="addHolidayRegion" link :label="t('settingsNav.holidays.add')" :hint="t('settingsNav.holidays.addHint')" testid="settings-holiday-add" @open="picking = true" />
  </SettingSection>
  <HolidayRegionSheet v-if="picking" @close="picking = false" />
</template>

<style scoped>
.cal::before { content: ''; width: 12px; height: 12px; border-radius: 50%; background: var(--cal); flex: none; }
</style>
