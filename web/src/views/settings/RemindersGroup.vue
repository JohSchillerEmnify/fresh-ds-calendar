<script setup lang="ts">
/** Settings group Reminders (docs/settings-tree.md): where reminders arrive, appointments, the morning overview and task lists. */
import { onMounted, ref } from 'vue';
import type { NotifyPrefs } from '@/api/types';
import { api, ApiError } from '@/api/client';
import Switch from '@/components/m3/Switch.vue';
import ReminderEditor from '@/components/settings/ReminderEditor.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import TimeField from '@/components/settings/TimeField.vue';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { t } from '@/i18n';
import { disablePush, enablePush, pushEndpoint, pushSupported, refreshPushState } from '@/pwa/push';
import { useDeviceStore } from '@/stores/device';
import { usePrefsStore } from '@/stores/prefs';
import { useSyncStore } from '@/stores/sync';
import { useUiStore } from '@/stores/ui';

const prefs = usePrefsStore();
const device = useDeviceStore();
const ui = useUiStore();
const savePrefs = useSavePrefs();

/** Saves part of the notification preference (the whole object goes to the server, which merges it). */
function saveNotify(p: Partial<NotifyPrefs>) {
  void savePrefs({ notify: { ...prefs.notify, ...p } });
}

/** `reminders-push`: this browser gets the reminders as Web Push while the app is closed (hidden where push is unavailable). */
const pushAvailable = pushSupported();
const pushDenied = ref(false);
async function setPush(on: boolean) {
  pushDenied.value = false;
  if (!on) { await disablePush().catch(() => ui.notify(t('settings.saveFailed'))); return; }
  const r = await enablePush();
  if (r === 'denied') pushDenied.value = true;
  else if (r === 'failed') ui.notify(t('settings.reminders.push.failed'));
}

const tasksDefault = ref<number[]>([]);
onMounted(() => {
  void refreshPushState();
  void device.read('tasksCalendarReminders', () => api.tasksCalendarReminders()).then((r) => { tasksDefault.value = r.defaultReminders; }, () => undefined);
});
/** The task lists' default reminders, saved at once; the items on screen are read again because they carry the effective leads. */
async function saveTasks(minutes: number[]) {
  const before = tasksDefault.value;
  tasksDefault.value = minutes;
  try {
    const saved = await api.setTasksCalendarReminders(minutes);
    device.putFile('tasksCalendarReminders', saved);
    tasksDefault.value = saved.defaultReminders;
    void useSyncStore().resyncAfterWrite();
  } catch (e) {
    tasksDefault.value = before;
    ui.notify(e instanceof ApiError ? e.userMessage : t('settings.saveFailed'));
  }
}
</script>

<template>
  <template v-if="pushAvailable">
    <h2>{{ t('settingsNav.sub.where') }}</h2>
    <SettingRow id="push" :label="t('settingsNav.labels.push')" :hint="t('settingsNav.labels.pushHint')">
      <Switch :model-value="pushEndpoint !== null" :label="t('settingsNav.labels.push')" data-testid="reminders-push" @update:model-value="setPush" />
    </SettingRow>
    <p v-if="pushDenied" class="note" data-testid="reminders-push-denied">{{ t('settings.reminders.push.denied') }}</p>
  </template>

  <h2>{{ t('settingsNav.sub.appointments') }}</h2>
  <SettingRow id="notifyEvents" :label="t('settings.notifications.events.label')" :hint="t('settingsNav.labels.notifyEventsHint')">
    <Switch :model-value="prefs.notify.events" :label="t('settings.notifications.events.label')" data-testid="settings-notify-events" @update:model-value="saveNotify({ events: $event })" />
  </SettingRow>
  <SettingRow id="morning" :label="t('settings.notifications.morning.label')" :hint="t('settings.notifications.morning.hint')">
    <Switch :model-value="prefs.notify.morning" :label="t('settings.notifications.morning.label')" data-testid="settings-notify-morning" @update:model-value="saveNotify({ morning: $event })" />
  </SettingRow>
  <SettingRow v-if="prefs.notify.morning" id="morningTime" :label="t('settings.notifications.morning.time')">
    <TimeField :model-value="prefs.notify.morningTime" :label="t('settings.notifications.morning.time')" data-testid="settings-notify-morning-time" @update:model-value="saveNotify({ morningTime: $event })" />
  </SettingRow>

  <h2>{{ t('settingsNav.sub.tasklists') }}</h2>
  <SettingRow id="notifyTasklists" :label="t('settings.notifications.tasklists')" :hint="t('settingsNav.labels.notifyTasklistsHint')">
    <Switch :model-value="prefs.notify.tasklists" :label="t('settings.notifications.tasklists')" data-testid="reminders-tasklists" @update:model-value="saveNotify({ tasklists: $event })" />
  </SettingRow>
  <SettingRow id="tasklistDefaults" wide :label="t('settings.reminders.tasklists.default')">
    <ReminderEditor class="editor" :model-value="{ useDefault: false, minutes: tasksDefault }" prefix="tasks-default" data-testid="reminders-tasks-calendar" @update:model-value="saveTasks($event.minutes)" />
  </SettingRow>
</template>

<style scoped>
.editor { flex: 1; }
</style>
