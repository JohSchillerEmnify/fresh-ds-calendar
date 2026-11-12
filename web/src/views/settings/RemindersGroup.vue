<script setup lang="ts">
/** Settings group Reminders (docs/settings-tree.md): where reminders arrive, appointments, the morning overview and task lists. */
import { onMounted, ref } from 'vue';
import type { NotifyPrefs } from '@/api/types';
import Switch from '@/components/m3/Switch.vue';
import SettingRow from '@/components/settings/SettingRow.vue';
import SettingSection from '@/components/settings/SettingSection.vue';
import TimeField from '@/components/settings/TimeField.vue';
import { useSavePrefs } from '@/composables/useSaveSettings';
import { t } from '@/i18n';
import { disablePush, enablePush, pushEndpoint, pushSupported, refreshPushState } from '@/pwa/push';
import { usePrefsStore } from '@/stores/prefs';
import { useUiStore } from '@/stores/ui';

const prefs = usePrefsStore();
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

onMounted(() => { void refreshPushState(); });
</script>

<template>
  <SettingSection v-if="pushAvailable" :title="t('settingsNav.sub.where')">
    <SettingRow id="push" :label="t('settingsNav.labels.push')" :hint="t('settingsNav.labels.pushHint')">
      <Switch :model-value="pushEndpoint !== null" :label="t('settingsNav.labels.push')" data-testid="reminders-push" @update:model-value="setPush" />
    </SettingRow>
    <p v-if="pushDenied" class="note" data-testid="reminders-push-denied">{{ t('settings.reminders.push.denied') }}</p>
  </SettingSection>

  <SettingSection :title="t('settingsNav.sub.appointments')">
  <SettingRow id="notifyEvents" :label="t('settings.notifications.events.label')" :hint="t('settingsNav.labels.notifyEventsHint')">
    <Switch :model-value="prefs.notify.events" :label="t('settings.notifications.events.label')" data-testid="settings-notify-events" @update:model-value="saveNotify({ events: $event })" />
  </SettingRow>
  <SettingRow id="morning" :label="t('settings.notifications.morning.label')" :hint="t('settings.notifications.morning.hint')">
    <Switch :model-value="prefs.notify.morning" :label="t('settings.notifications.morning.label')" data-testid="settings-notify-morning" @update:model-value="saveNotify({ morning: $event })" />
  </SettingRow>
  <SettingRow v-if="prefs.notify.morning" id="morningTime" :label="t('settings.notifications.morning.time')">
    <TimeField :model-value="prefs.notify.morningTime" :label="t('settings.notifications.morning.time')" data-testid="settings-notify-morning-time" @update:model-value="saveNotify({ morningTime: $event })" />
  </SettingRow>
  </SettingSection>

  <SettingSection :title="t('settingsNav.sub.tasklists')">
  <SettingRow id="notifyTasklists" :label="t('settings.notifications.tasklists')" :hint="t('settingsNav.labels.notifyTasklistsHint')">
    <Switch :model-value="prefs.notify.tasklists" :label="t('settings.notifications.tasklists')" data-testid="reminders-tasklists" @update:model-value="saveNotify({ tasklists: $event })" />
  </SettingRow>
  </SettingSection>
</template>
