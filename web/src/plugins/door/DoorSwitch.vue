<script setup lang="ts">
/** The "Show on door" switch row of the door plugin, for the list form and the list sheet. */
import { t } from '@/i18n';
import Switch from '@/components/m3/Switch.vue';

defineProps<{ modelValue: boolean; /** One line, no hint (the list sheet). */ compact?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <div class="row" :class="{ compact }" data-testid="tasklist-door">
    <div class="grow"><span class="lab">{{ t('plugins.door.label') }}</span><span v-if="!compact" class="sub">{{ t('plugins.door.hint') }}</span></div>
    <Switch :model-value="modelValue" :label="t('plugins.door.label')" data-testid="tasklist-door-switch" @update:model-value="emit('update:modelValue', $event)" />
  </div>
</template>

<style scoped>
.row { display: flex; align-items: center; gap: 12px; min-height: 44px; }
.grow { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.lab { font: var(--md-sys-typescale-body-large); }
.sub { font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant); }
.compact { min-height: 40px; }
.compact .lab { font: var(--md-sys-typescale-label-large); }
</style>
