<script setup lang="ts">
/** One calendar's settings page, also the task lists calendar's: whether it shows (same choice as its filter chip), its colour, its plan (feature calendar-off-plan) and its default reminders. */
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/m3/Button.vue';
import { ApiError } from '@/api/client';
import CalendarColorRow from '@/components/settings/CalendarColorRow.vue';
import Switch from '@/components/m3/Switch.vue';
import ReminderEditor from '@/components/settings/ReminderEditor.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import { planSummary } from '@/components/settings/planSummary';
import { allowContacts } from '@/features/calendar';
import { t } from '@/i18n';
import { calendarById, useCalendarsStore } from '@/stores/calendars';
import { useHolidaysStore } from '@/stores/holidays';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ calendarId: string }>();
const cals = useCalendarsStore();
const ui = useUiStore();
const router = useRouter();
const cal = computed(() => calendarById(props.calendarId));
onMounted(() => { void cals.load().catch(() => undefined); });

/** Takes the holiday calendar out of the person's Google list and returns to the calendars. */
async function removeHoliday() {
  try {
    await useHolidaysStore().remove(props.calendarId);
    void useSyncStore().resyncAfterWrite();
    void router.replace('/settings/calendars');
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : t('settingsNav.holidays.removeFailed'));
  }
}

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
      <SettingRow id="showCalendar" :label="t('settingsNav.labels.showCalendar')" :hint="cal.tasks ? undefined : t('settingsNav.labels.showCalendarHint')">
        <Switch :model-value="!cal.hidden" :label="t('settingsNav.labels.showCalendar')" data-testid="settings-calendar-shown" @update:model-value="cals.toggle(cal.id)" />
      </SettingRow>
      <SettingRow id="color" wide :label="t('calendar.event.fields.color')">
        <CalendarColorRow :calendar-id="cal.id" :tasks="cal.tasks" />
      </SettingRow>
      <SettingRow id="plan" link :label="t('settingsNav.labels.plan')" :hint="planSummary(cal.id)" testid="settings-calendar-plan" @open="ui.openDialog('calendar-plan', { calendarId: cal.id })" />
      <SettingRow v-if="!cal.virtual" id="defaultReminders" wide :label="t('settingsNav.labels.defaultReminders')" :hint="t('settings.reminders.intro')">
        <section class="rem" data-testid="reminders-calendar" :data-calendar-id="cal.id" :data-name="cal.name" :aria-label="cal.name">
          <ReminderEditor :model-value="{ useDefault: false, minutes: cal.defaultReminders ?? [] }" prefix="calendar-default" data-testid="reminders-calendar-list" @update:model-value="saveDefaults($event.minutes)" />
        </section>
      </SettingRow>
    </SettingSection>
    <SettingSection v-if="cal.virtual && cal.contactsPermission === 'missing'" data-testid="settings-contacts-access">
      <SettingRow id="contactsAccess" wide :label="t('settingsNav.labels.contactsAccess')" :hint="t('settingsNav.labels.contactsAccessHint')">
        <Button variant="outlined" data-testid="settings-contacts-grant" @click="allowContacts(true)">{{ t('settingsNav.labels.contactsAllow') }}</Button>
      </SettingRow>
    </SettingSection>
    <SettingSection v-if="cal.holiday">
      <SettingRow id="removeHoliday" wide :label="t('settingsNav.holidays.remove')" :hint="t('settingsNav.holidays.removeHint')">
        <Button variant="outlined" data-testid="holiday-calendar-remove" @click="removeHoliday">{{ t('settingsNav.holidays.remove') }}</Button>
      </SettingRow>
    </SettingSection>
  </template>
</template>

<style scoped>
.rem { flex: 1; }
</style>
