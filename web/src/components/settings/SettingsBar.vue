<script setup lang="ts">
/** The expressive top bar of every settings page: a tonal Back button and a bold 28 px title; 64 px high, 56 px in the Compact top bar size. */
import { IconArrowBack as IconBack } from '@/components/icons';
import IconButton from '@/components/m3/IconButton.vue';
import { useBarSize } from '@/composables/useBarSize';
import { t } from '@/i18n';

withDefaults(defineProps<{ title: string; backTestid?: string }>(), { backTestid: 'settings-back' });
defineEmits<{ back: [] }>();
const barSize = useBarSize().top;
</script>

<template>
  <header class="bar" data-testid="settings-bar" :data-size="barSize">
    <IconButton :label="t('settings.back')" variant="tonal" :data-testid="backTestid" @click="$emit('back')"><IconBack /></IconButton>
    <h1 data-testid="settings-title">{{ title }}</h1>
  </header>
</template>

<style scoped>
.bar { box-sizing: border-box; height: calc(var(--safe-top) + 64px); display: flex; align-items: center; gap: 12px; padding: var(--safe-top) 12px 0; position: sticky; top: 0; background: var(--md-sys-color-surface); z-index: 2; }
.bar[data-size='compact'] { height: calc(var(--safe-top) + 56px); }
.bar :deep(.icon-btn) { width: 40px; height: 40px; }
h1 { margin: 0; font: 700 calc(28px * var(--dz, 1))/36px var(--font); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
