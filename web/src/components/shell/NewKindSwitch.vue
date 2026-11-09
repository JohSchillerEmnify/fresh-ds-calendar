<script setup lang="ts">
/** "Event | Task list | Birthday" switch at the top of the one "new" dialog (the create menu); re-opens the other body with the same date/time and the typed title. */
import { computed } from 'vue';
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import { rememberNewKind, type NewKind } from '@/extensions/create';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';

/** The dialog bodies the switch offers: the two remembered kinds, and a birthday (never remembered: the "+" opens an event or a list). */
type Kind = NewKind | 'birthday';

/** `time`: undefined = none chosen (each form uses its own default), null = all-day / untimed. `minutes`: a drawn block's length. */
const props = defineProps<{ kind: Kind; date: string; time?: string | null; minutes?: number; title?: string }>();
const ui = useUiStore();
const options = computed(() => [
  { value: 'event' as const, label: t('calendar.create.event'), testid: 'new-kind-event' },
  { value: 'tasklist' as const, label: t('calendar.create.tasklist'), testid: 'new-kind-tasklist' },
  { value: 'birthday' as const, label: t('calendar.create.birthday'), testid: 'create-birthday' },
]);

function change(k: Kind) {
  if (k === props.kind) return;
  if (k !== 'birthday') rememberNewKind(k);
  ui.openDialog(k, { mode: 'create', ...(k === 'birthday' ? { birthday: true } : {}), date: props.date, ...(props.title ? { title: props.title } : {}), ...(props.time !== undefined ? { time: props.time } : {}), ...(props.minutes && k !== 'birthday' ? { minutes: props.minutes } : {}) });
}
</script>

<template>
  <SegmentedButton :model-value="kind" :options="options" :label="t('calendar.create.kindLabel')" data-testid="new-kind" @update:model-value="change" />
</template>
