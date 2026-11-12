<script setup lang="ts">
/** Settings group Calendars (docs/settings-tree.md): one row per calendar with its colour dot and plan, each opening its own page; the task lists calendar is one of them. */
import { computed, onMounted, ref } from 'vue';
import HolidayRegionSheet from '@/components/settings/HolidayRegionSheet.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { planSummary } from '@/components/settings/planSummary';
import { t } from '@/i18n';
import { useCalendarsStore } from '@/stores/calendars';

const cals = useCalendarsStore();
// the task lists calendar is a row like the others, last
const others = computed(() => [...cals.list.filter((c) => !c.holiday), ...(cals.tasksCalendar ? [cals.tasksCalendar] : [])]);
const holidays = computed(() => cals.list.filter((c) => c.holiday));
const picking = ref(false);
onMounted(() => { void cals.load().catch(() => undefined); });
</script>

<template>
  <SettingSection>
    <SettingRow
      v-for="c in others" :id="c.tasks ? 'tasksCalendar' : `calendar:${c.id}`" :key="c.id" :to="c.tasks ? '/settings/calendars/tasks-calendar' : `/settings/calendars/${encodeURIComponent(c.id)}`" :label="c.name"
      :hint="c.hidden ? t('settingsNav.calendar.hidden') : planSummary(c.id)" class="cal" :style="{ '--cal': c.color }"
    />
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
