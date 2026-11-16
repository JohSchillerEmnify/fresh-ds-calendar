<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { appTimeout, type Disposer } from '@/lib/timers';
import { useUiStore } from '@/stores/ui';

/** The check-in message is a kit snackbar (auto-hides after 4 s); this only hands it over and tells when it is gone. */
const SHOWN_MS = 4000;
const props = defineProps<{ message: { id: number; text: string } | null }>();
const emit = defineEmits<{ hide: [] }>();
const ui = useUiStore();
let stop: Disposer | null = null;

watch(
  () => props.message?.id,
  () => {
    stop?.();
    stop = null;
    if (!props.message) return;
    ui.notify(props.message.text, { testid: 'streak-message', duration: SHOWN_MS });
    stop = appTimeout(() => { stop = null; emit('hide'); }, SHOWN_MS);
  },
  { immediate: true },
);
onBeforeUnmount(() => stop?.());
</script>

<template>
  <span hidden />
</template>
