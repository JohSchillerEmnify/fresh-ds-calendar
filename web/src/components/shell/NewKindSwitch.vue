<script setup lang="ts">
/** "Event | Task list" switch at the top of the one "new" dialog; re-opens the other body with the same date/time. */
import { computed } from 'vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import { rememberNewKind, type NewKind } from '@/extensions/create';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';

/** `time`: undefined = none chosen (each form uses its own default), null = all-day / untimed. */
const props = defineProps<{ kind: NewKind; date: string; time?: string | null }>();
const ui = useUiStore();
const options = computed(() => [
  { value: 'event' as const, label: t('calendar.create.event'), testid: 'new-kind-event' },
  { value: 'tasklist' as const, label: t('calendar.create.tasklist'), testid: 'new-kind-tasklist' },
]);

function change(k: NewKind) {
  if (k === props.kind) return;
  rememberNewKind(k);
  ui.openDialog(k, { mode: 'create', date: props.date, ...(props.time !== undefined ? { time: props.time } : {}) });
}
</script>

<template>
  <SegmentedButton :model-value="kind" :options="options" :label="t('calendar.create.kindLabel')" data-testid="new-kind" @update:model-value="change" />
</template>
