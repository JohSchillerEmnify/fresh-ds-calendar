<script setup lang="ts">
/**
 * Reminders settings (`/settings/reminders`, feature reminders): one section per calendar with
 * Google's default reminder list of that calendar, edited like an event's list and saved at once (`calendarList.patch`,
 * popup only); read-only calendars too (Google first, else the app keeps them, see API.md). Then "Task lists": the switch whether the app reminds about
 * task lists (`prefs.notify.tasklists`, off by default) and the tasks calendar's default list.
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IconArrowBack as IconBack } from '@/components/icons';
import { api, ApiError } from '@/api/client';
import IconButton from '@/components/m3/IconButton.vue';
import Switch from '@/components/m3/Switch.vue';
import ReminderEditor from '@/components/settings/ReminderEditor.vue';
import { useCalendarsStore } from '@/stores/calendars';
import { useDeviceStore } from '@/stores/device';
import { useItemsStore } from '@/stores/items';
import { usePrefsStore } from '@/stores/prefs';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';
import { disablePush, enablePush, pushEndpoint, pushSupported, refreshPushState } from '@/pwa/push';

const router = useRouter();
const cals = useCalendarsStore();
const prefs = usePrefsStore();
const ui = useUiStore();
const device = useDeviceStore();
const items = useItemsStore();

/** Calendars the person has not switched off (their own hide choice), in the app's order. */
const shown = computed(() => cals.list.filter((c) => !c.hidden));
const tasksDefault = ref<number[]>([]);

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

onMounted(() => {
  void refreshPushState();
  void cals.load().catch(() => undefined);
  void device.read('tasksCalendarReminders', () => api.tasksCalendarReminders()).then((r) => { tasksDefault.value = r.defaultReminders; }, () => undefined);
});

function back() {
  if (window.history.state?.back) router.back();
  else router.push('/settings');
}

/** The items on screen carry the effective leads, so they are read again after a default changed. */
function refreshItems() {
  void items.refreshVisible().catch(() => undefined);
}

async function saveCalendar(id: string, minutes: number[]) {
  try {
    await cals.setDefaultReminders(id, minutes);
    refreshItems();
  } catch (e) {
    ui.notify(e instanceof ApiError ? e.userMessage : t('settings.saveFailed'));
  }
}

async function saveTasks(minutes: number[]) {
  const before = tasksDefault.value;
  tasksDefault.value = minutes;
  try {
    const saved = await api.setTasksCalendarReminders(minutes);
    device.putFile('tasksCalendarReminders', saved);
    tasksDefault.value = saved.defaultReminders;
    refreshItems();
  } catch (e) {
    tasksDefault.value = before;
    ui.notify(e instanceof ApiError ? e.userMessage : t('settings.saveFailed'));
  }
}

async function setTaskListSwitch(on: boolean) {
  try { await prefs.set({ notify: { ...prefs.notify, tasklists: on } }); } catch (e) { ui.notify(e instanceof ApiError ? e.userMessage : t('settings.saveFailed')); }
}
</script>

<template>
  <section class="page" data-testid="reminders-settings">
    <header class="bar">
      <IconButton :label="t('settings.back')" data-testid="reminders-back" @click="back"><IconBack /></IconButton>
      <h1>{{ t('settings.reminders.title') }}</h1>
    </header>
    <div class="content">
      <p class="sub note">{{ t('settings.reminders.intro') }}</p>
      <section v-for="c in shown" :key="c.id" class="card" data-testid="reminders-calendar" :data-calendar-id="c.id" :data-name="c.name" :aria-label="c.name">
        <h2><i class="dot" :style="{ background: c.color }" aria-hidden="true" />{{ c.name }}</h2>
        <ReminderEditor :model-value="{ useDefault: false, minutes: c.defaultReminders ?? [] }" prefix="calendar-default" data-testid="reminders-calendar-list" @update:model-value="saveCalendar(c.id, $event.minutes)" />
      </section>
      <section v-if="pushAvailable" class="card" data-testid="reminders-push-section">
        <h2>{{ t('settings.reminders.push.title') }}</h2>
        <div class="row"><div class="grow"><span class="lab">{{ t('settings.reminders.push.label') }}</span><span class="sub">{{ t('settings.reminders.push.hint') }}</span></div><Switch :model-value="pushEndpoint !== null" :label="t('settings.reminders.push.label')" data-testid="reminders-push" @update:model-value="setPush" /></div>
        <p v-if="pushDenied" class="sub note" data-testid="reminders-push-denied">{{ t('settings.reminders.push.denied') }}</p>
      </section>
      <section class="card" data-testid="reminders-tasklists-section">
        <h2>{{ t('settings.reminders.tasklists.title') }}</h2>
        <div class="row"><div class="grow"><span class="lab">{{ t('settings.reminders.tasklists.switch.label') }}</span><span class="sub">{{ t('settings.reminders.tasklists.switch.hint') }}</span></div><Switch :model-value="prefs.notify.tasklists" :label="t('settings.reminders.tasklists.switch.label')" data-testid="reminders-tasklists" @update:model-value="setTaskListSwitch" /></div>
        <span class="lab sublab">{{ t('settings.reminders.tasklists.default') }}</span>
        <ReminderEditor :model-value="{ useDefault: false, minutes: tasksDefault }" prefix="tasks-default" data-testid="reminders-tasks-calendar" @update:model-value="saveTasks($event.minutes)" />
      </section>
    </div>
  </section>
</template>

<style scoped>
.page { height: 100%; overflow-y: auto; overflow-x: clip; background: var(--md-sys-color-surface); padding-bottom: calc(24px + var(--safe-bottom)); }
.bar { display: flex; align-items: center; gap: 4px; padding: calc(var(--safe-top) + 8px) 8px 8px; position: sticky; top: 0; background: var(--md-sys-color-surface); z-index: 2; }
h1 { margin: 0; font: var(--md-sys-typescale-title-large); }
.content { display: flex; flex-direction: column; gap: 12px; padding: 4px 12px 0; max-width: 640px; margin: 0 auto; }
.card { background: var(--md-sys-color-surface-container-low); border-radius: var(--md-sys-shape-corner-extra-large); padding: 8px 16px 16px; display: flex; flex-direction: column; gap: 8px; }
h2 { margin: 0; padding: 12px 0 0; font: var(--md-sys-typescale-title-medium); color: var(--md-sys-color-primary); display: flex; align-items: center; gap: 8px; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
.row { display: flex; align-items: center; gap: 12px; min-height: 56px; }
.grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.lab { font: var(--md-sys-typescale-body-large); }
.sub { font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.sublab { color: var(--md-sys-color-on-surface-variant); font: var(--md-sys-typescale-label-large); }
.note { margin: 0; }
/* Left-handed mode (phone, touch tablet): the switch at the left start of the row, the label after it. */
html[data-hand='left'][data-touch] .row { flex-direction: row-reverse; }
</style>
