<script setup lang="ts">
/** The question "Turn on task lists?" (feature tasklists-calendar-consent): the app adds an extra calendar to the person's Google account only after "Turn on". Closing it is "Not now". */
import AdaptiveSheet from '@/components/m3/AdaptiveSheet.vue';
import Button from '@/components/m3/Button.vue';
import { IconCalendarMonth } from '@/components/icons';
import { t } from '@/i18n';
import { useTasksCalendarStore } from '@/stores/tasksCalendar';

defineProps<{ open: boolean }>();
/** `close`: dismissed ("Not now"); `done`: turned on. */
const emit = defineEmits<{ close: []; done: [] }>();
const tasks = useTasksCalendarStore();

async function turnOn() {
  if (await tasks.answer(true)) emit('done');
}
</script>

<template>
  <AdaptiveSheet :open="open" :label="t('tasks.consent.title')" testid="tasks-consent" @close="emit('close')">
    <h2 class="t">{{ t('tasks.consent.title') }}</h2>
    <p class="m">{{ t('tasks.consent.body') }}</p>
    <p class="cal" data-testid="tasks-consent-calendar"><IconCalendarMonth class="ic" aria-hidden="true" />{{ t('tasks.consent.calendarName') }}</p>
    <p class="hint">{{ t('tasks.consent.hint') }}</p>
    <div class="actions">
      <Button variant="text" data-testid="tasks-consent-not-now" :disabled="tasks.busy" @click="emit('close')">{{ t('tasks.consent.notNow') }}</Button>
      <Button data-testid="tasks-consent-turn-on" :disabled="tasks.busy" @click="turnOn">{{ t('tasks.consent.turnOn') }}</Button>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.m { margin: 12px 0 0; font: var(--md-sys-typescale-body-large); color: var(--md-sys-color-on-surface-variant); }
.cal { display: flex; align-items: center; gap: 8px; margin: 16px 0 0; padding: 10px 12px; border-radius: var(--md-sys-shape-corner-medium); background: var(--md-sys-color-surface-container-high); font: var(--md-sys-typescale-label-large); }
.ic { width: 20px; height: 20px; flex: none; color: var(--md-sys-color-primary); }
.hint { margin: 12px 0 0; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
/* Left-handed mode (phone): the primary action is at the bottom left. */
html[data-hand='left'][data-touch] .actions { flex-direction: row-reverse; }
</style>
