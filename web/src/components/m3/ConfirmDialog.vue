<script setup lang="ts">
import AdaptiveSheet from './AdaptiveSheet.vue';
import Button from './Button.vue';

/** Delete / discard confirmation (confirm-dialog, confirm-ok, confirm-cancel). */
withDefaults(defineProps<{ open: boolean; title: string; message?: string; okLabel?: string }>(), { okLabel: 'Delete' });
defineEmits<{ ok: []; cancel: [] }>();
</script>

<template>
  <AdaptiveSheet :open="open" :label="title" testid="confirm-dialog" @close="$emit('cancel')">
    <h2 class="t">{{ title }}</h2>
    <p v-if="message" class="m">{{ message }}</p>
    <div class="actions">
      <Button variant="text" data-testid="confirm-cancel" @click="$emit('cancel')">Cancel</Button>
      <Button data-testid="confirm-ok" @click="$emit('ok')">{{ okLabel }}</Button>
    </div>
  </AdaptiveSheet>
</template>

<style scoped>
.t { margin: 8px 0 0; font: var(--md-sys-typescale-title-large); }
.m { margin: 8px 0 0; color: var(--md-sys-color-on-surface-variant); }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
</style>
