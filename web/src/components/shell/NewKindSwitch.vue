<script setup lang="ts">
/** "Event | Task list" switch at the top of the one "new" dialog; re-opens the other body with the same date/time. */
import SegmentedButton from '@/components/m3/SegmentedButton.vue';
import { rememberNewKind, type NewKind } from '@/extensions/create';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ kind: NewKind; date: string; time: string | null }>();
const ui = useUiStore();
const options = [
  { value: 'event' as const, label: 'Event', testid: 'new-kind-event' },
  { value: 'tasklist' as const, label: 'Task list', testid: 'new-kind-tasklist' },
];

function change(k: NewKind) {
  if (k === props.kind) return;
  rememberNewKind(k);
  ui.openDialog(k, { mode: 'create', date: props.date, time: props.time });
}
</script>

<template>
  <SegmentedButton :model-value="kind" :options="options" label="New" data-testid="new-kind" @update:model-value="change" />
</template>
