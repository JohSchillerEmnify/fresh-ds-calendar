<script setup lang="ts">
/** One calendar's settings page: whether it shows (same choice as its filter chip), its colour, its plan (feature calendar-off-plan) and its default reminders. */
import { computed, onMounted } from 'vue';
import { ApiError } from '@/api/client';
import CalendarColorRow from '@/components/settings/CalendarColorRow.vue';
import Switch from '@/components/m3/Switch.vue';
import ReminderEditor from '@/components/settings/ReminderEditor.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { planSummary } from '@/components/settings/planSummary';
import { t } from '@/i18n';
import { useCalendarsStore } from '@/stores/calendars';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ calendarId: string }>();
const cals = useCalendarsStore();
const ui = useUiStore();
const cal = computed(() => cals.list.find((c) => c.id === props.calendarId));
onMounted(() => { void cals.load().catch(() => undefined); });

/** Saves the default list; the items on screen are read again because they carry the effective leads. */
async function saveDefaults(minutes: number[]) {
  try {
    await cals.setDefaultReminders(props.calendarId, minutes);
    void useSyncStore().resyncAfterWrite();
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : t('settings.saveFailed'));
  }
}
</script>

<template>
  <template v-if="cal">
    <SettingSection>
      <SettingRow id="showCalendar" :label="t('settingsNav.labels.showCalendar')" :hint="t('settingsNav.labels.showCalendarHint')">
        <Switch :model-value="!cal.hidden" :label="t('settingsNav.labels.showCalendar')" data-testid="settings-calendar-shown" @update:model-value="cals.toggle(cal.id)" />
      </SettingRow>
      <SettingRow id="color" wide :label="t('calendar.event.fields.color')">
        <CalendarColorRow :calendar-id="cal.id" />
      </SettingRow>
      <SettingRow id="plan" link :label="t('settingsNav.labels.plan')" :hint="planSummary(cal.id)" testid="settings-calendar-plan" @open="ui.openDialog('calendar-plan', { calendarId: cal.id })" />
      <SettingRow id="defaultReminders" wide :label="t('settingsNav.labels.defaultReminders')" :hint="t('settings.reminders.intro')">
        <section class="rem" data-testid="reminders-calendar" :data-calendar-id="cal.id" :data-name="cal.name" :aria-label="cal.name">
          <ReminderEditor :model-value="{ useDefault: false, minutes: cal.defaultReminders ?? [] }" prefix="calendar-default" data-testid="reminders-calendar-list" @update:model-value="saveDefaults($event.minutes)" />
        </section>
      </SettingRow>
    </SettingSection>
  </template>
</template>

<style scoped>
.rem { flex: 1; }
</style>
