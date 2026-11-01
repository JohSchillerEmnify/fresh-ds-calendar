<script setup lang="ts">
/** Settings › Focus & calm › Bedtime: bedtime mode, its times, weekends, dynamic choices and one Reminder row (in-app and pushed). */
import { computed } from 'vue';
import type { BedtimeMode, BedtimePrefs } from '@/api/types';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import Switch from '@/components/m3/Switch.vue';
import RowSelect from '@/components/settings/RowSelect.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import TimeField from '@/components/settings/TimeField.vue';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { t } from '@/i18n';
import { usePrefsStore } from '@/stores/prefs';

const prefs = usePrefsStore();
const savePrefs = useSavePrefs();
const bt = computed(() => prefs.bedtime);

/** Saves part of the bedtime preference (the server merges it). */
function saveBedtime(p: Partial<BedtimePrefs>) {
  void savePrefs({ bedtime: p as BedtimePrefs });
}
const bedtimeModes = computed(() => (['fixed', 'dynamic'] as const).map((m) => ({ value: m, label: t(`bedtime.settings.mode.${m}`), testid: `settings-bedtime-mode-${m}` })));
/** The offered values plus the stored one, so a value set elsewhere still shows. */
const withCurrent = (offered: number[], current: number) => (offered.includes(current) ? offered : [...offered, current].sort((a, b) => a - b));
const sleepOptions = computed(() => withCurrent([6, 7, 8, 9, 10].map((h) => h * 60), bt.value.sleepMinutes).map((m) => ({ value: String(m), label: t('bedtime.settings.sleep.hours', { count: m / 60 }, m / 60) })));
const leadOptions = computed(() => withCurrent([0, 15, 30, 45, 60, 90, 120], bt.value.leadMinutes).map((m) => ({ value: String(m), label: m === 0 ? t('bedtime.settings.lead.none') : t('bedtime.settings.lead.minutes', { count: m }) })));
/** One Reminder: Off unless both the bedtime notification and a lead time are on. */
const reminder = computed(() => (prefs.notify.bedtime && bt.value.reminderMinutes > 0 ? bt.value.reminderMinutes : 0));
const reminderOptions = computed(() => withCurrent([0, 5, 10, 15, 30, 45, 60], reminder.value).map((m) => ({ value: String(m), label: m === 0 ? t('bedtime.settings.reminder.off') : t('bedtime.settings.reminder.minutes', { count: m }) })));
function saveReminder(minutes: number) {
  void savePrefs({ bedtime: { reminderMinutes: minutes } as BedtimePrefs, notify: { ...prefs.notify, bedtime: minutes > 0 } });
}
</script>

<template>
  <SettingRow id="bedtimeOn" :label="t('bedtime.settings.on.label')" :hint="t('bedtime.settings.on.hint')">
    <Switch :model-value="bt.enabled" :label="t('bedtime.settings.on.label')" data-testid="settings-bedtime-on" @update:model-value="saveBedtime({ enabled: $event })" />
  </SettingRow>
  <template v-if="bt.enabled">
    <SettingRow id="bedtimeMode" wide :label="t('bedtime.settings.mode.label')">
      <SegmentedButton :model-value="bt.mode" :options="bedtimeModes" :label="t('bedtime.settings.mode.label')" data-testid="settings-bedtime-mode" @update:model-value="saveBedtime({ mode: $event as BedtimeMode })" />
    </SettingRow>
    <SettingRow id="bedtimeTime" :label="t('bedtime.settings.bedtime')">
      <TimeField :model-value="bt.bedtime" :label="t('bedtime.settings.bedtime')" data-testid="settings-bedtime-time" @update:model-value="saveBedtime({ bedtime: $event })" />
    </SettingRow>
    <SettingRow id="wakeTime" :label="t('bedtime.settings.wake')">
      <TimeField :model-value="bt.wake" :label="t('bedtime.settings.wake')" data-testid="settings-bedtime-wake" @update:model-value="saveBedtime({ wake: $event })" />
    </SettingRow>
    <SettingRow id="weekend" :label="t('bedtime.settings.weekend.label')" :hint="t('bedtime.settings.weekend.hint')">
      <Switch :model-value="bt.weekendDifferent" :label="t('bedtime.settings.weekend.label')" data-testid="settings-bedtime-weekend" @update:model-value="saveBedtime({ weekendDifferent: $event })" />
    </SettingRow>
    <template v-if="bt.weekendDifferent">
      <SettingRow id="weekendBedtime" :label="t('bedtime.settings.weekendBedtime')">
        <TimeField :model-value="bt.weekendBedtime" :label="t('bedtime.settings.weekendBedtime')" data-testid="settings-bedtime-weekend-time" @update:model-value="saveBedtime({ weekendBedtime: $event })" />
      </SettingRow>
      <SettingRow id="weekendWake" :label="t('bedtime.settings.weekendWake')">
        <TimeField :model-value="bt.weekendWake" :label="t('bedtime.settings.weekendWake')" data-testid="settings-bedtime-weekend-wake" @update:model-value="saveBedtime({ weekendWake: $event })" />
      </SettingRow>
    </template>
    <template v-if="bt.mode === 'dynamic'">
      <p class="note" data-testid="settings-bedtime-dynamic-hint">{{ t('bedtime.settings.dynamicHint') }}</p>
      <SettingRow id="sleep" :label="t('bedtime.settings.sleep.label')">
        <RowSelect :model-value="String(bt.sleepMinutes)" :options="sleepOptions" :label="t('bedtime.settings.sleep.label')" data-testid="settings-bedtime-sleep" @update:model-value="saveBedtime({ sleepMinutes: Number($event) })" />
      </SettingRow>
      <SettingRow id="lead" :label="t('bedtime.settings.lead.label')">
        <RowSelect :model-value="String(bt.leadMinutes)" :options="leadOptions" :label="t('bedtime.settings.lead.label')" data-testid="settings-bedtime-lead" @update:model-value="saveBedtime({ leadMinutes: Number($event) })" />
      </SettingRow>
    </template>
    <SettingRow id="bedtimeReminder" :label="t('settingsNav.labels.bedtimeReminder')">
      <RowSelect :model-value="String(reminder)" :options="reminderOptions" :label="t('settingsNav.labels.bedtimeReminder')" data-testid="settings-bedtime-reminder" @update:model-value="saveReminder(Number($event))" />
    </SettingRow>
  </template>
</template>
